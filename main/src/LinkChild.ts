import { Mongo } from 'meteor/mongo';

import ChangeStreamRegistry from './ChangeStreamRegistry';
import ChildDeMultiplexer from './ChildDeMultiplexer';
import Link from './Link';
import PublicationContext, {
  MeteorPublicationContext,
} from './PublicationContext';
import type { MongoDoc, WithoutId } from './types';
import filterFields, { FieldProjection } from './utils/filterFields';

export type LinkChildOptions = {
  fields?: FieldProjection;
  skipPublication?: boolean;
};

export type ExtractPrimaryKeys<T extends MongoDoc = MongoDoc> = (
  document: Partial<WithoutId<T>>
) => string[] | undefined;

export class LinkChild<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> {
  private readonly children: ChildDeMultiplexer<T>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly parent: Link<P> | LinkChild<any, P>;

  private readonly fields: FieldProjection | undefined;

  private readonly collection: Mongo.Collection<T>;

  private readonly resolver: ExtractPrimaryKeys<P>;

  private stopListener:
    | ReturnType<typeof ChangeStreamRegistry.addListener>
    | undefined;

  /** @internal */
  public readonly publicationContext: PublicationContext<T>;

  private readonly context: MeteorPublicationContext<T>;

  constructor(
    context: MeteorPublicationContext<T>,
    collection: Mongo.Collection<T>,
    resolver: ExtractPrimaryKeys<P>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parent: Link<P> | LinkChild<any, P>,
    options?: LinkChildOptions | undefined
  ) {
    this.context = context;
    this.collection = collection;
    this.resolver = resolver;
    this.parent = parent;
    this.fields = options?.fields;
    this.children = new ChildDeMultiplexer<T>();

    const { collectionName } = collection.rawCollection();
    const existingForeignKeyRegistry = this.root().getNode(collectionName);
    this.publicationContext = new PublicationContext(
      context,
      collection.rawCollection().collectionName,
      {
        foreignKeyRegistry:
          existingForeignKeyRegistry?.publicationContext.foreignKeyRegistry,
        skipPublication: options?.skipPublication,
      }
    );
    this.root().setNode(this);
  }

  /** @internal */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public root = (): Link<any> => {
    return this.parent.root();
  };

  public link = <C extends MongoDoc = MongoDoc>(
    collection: Mongo.Collection<C>,
    resolver: ExtractPrimaryKeys<T>,
    options?: LinkChildOptions
  ): LinkChild<T, C> => {
    const child = new LinkChild<T, C>(
      this.context as MeteorPublicationContext<C>,
      collection,
      resolver,
      this,
      options
    );

    this.children.link<C>(child);

    return child;
  };

  private filterFields = (
    doc: Partial<WithoutId<T>>
  ): Partial<WithoutId<T>> => {
    if (this.fields) return filterFields(this.fields, doc);

    return doc;
  };

  /** @internal */
  public commit(): void {
    const added: Array<T> = [];
    const removed: Array<string> = [];
    if (this.publicationContext.addedChildrenIds.size) {
      this.collection
        .find(
          // @ts-ignore
          {
            _id: { $in: [...this.publicationContext.addedChildrenIds] },
          },
          { fields: this.fields }
        )
        .forEach((document) => {
          const { _id, ...doc } = document;
          added.push(document);
          this.publicationContext.added(_id, doc);
        });
    }
    if (this.publicationContext.removedChildrenIds.size) {
      this.publicationContext.removedChildrenIds.forEach((_id) => {
        this.publicationContext.removed(_id);
        removed.push(_id);
      });
    }

    added.forEach(({ _id, ...doc }) => {
      this.children.parentAdded(_id, doc);
    });

    removed.forEach((_id) => {
      this.children.parentRemoved(_id);
    });

    this.children.commit();
  }

  // handle add from parent
  /** @internal */
  public parentAdded = (
    sourceId: string,
    parentDoc: Partial<WithoutId<P>>
  ): void => {
    const keys = this.resolver(parentDoc);
    if (keys) this.publicationContext.addToRegistry(sourceId, keys);
  };

  // handle change from parent
  /** @internal */
  public parentChanged = (sourceId: string, doc: WithoutId<P>): void => {
    const keys = this.resolver(doc);
    this.publicationContext.replaceFromRegistry(sourceId, keys || []);
  };

  // handle remove from parent
  /** @internal */
  public parentRemoved = (sourceId: string): void => {
    this.publicationContext.removeFromRegistry(sourceId);
  };

  // handle added events from change streams
  // this is only used in cases where a linked document has been inserted
  // after the related document e.g. the insertion order/foreign key
  // relationship has been broken
  private added = (_id: string, doc: WithoutId<T>): void => {
    if (!this.publicationContext.addedChildrenIds.has(_id)) return;
    // only add the dangling document when this instance is the primary
    if (this.publicationContext.isPrimaryForChildId(_id)) {
      this.publicationContext.added(_id, this.filterFields(doc));
    }
    this.children.parentAdded(_id, doc);
  };

  // handle change events from change streams
  private changed = (
    _id: string,
    fields: Partial<WithoutId<T>>,
    doc: WithoutId<T>
  ): void => {
    if (!this.publicationContext.hasChildId(_id)) return;
    this.publicationContext.changed(_id, this.filterFields(fields));
    this.children.parentChanged(_id, doc);
    this.commit();
  };

  // handle replace events from change streams
  private replaced = (_id: string, doc: WithoutId<T>): void => {
    if (!this.publicationContext.hasChildId(_id)) return;
    this.publicationContext.replaced(_id, this.filterFields(doc));
    this.children.parentChanged(_id, doc);
    this.commit();
  };

  /* istanbul ignore next */
  private removed = (): void => undefined;

  /** @internal */
  public observe(): void {
    this.stopListener = ChangeStreamRegistry.addListener<T>(
      this.collection.rawCollection(),
      {
        added: this.added,
        changed: this.changed,
        replaced: this.replaced,
        removed: this.removed,
      }
    );
    this.children.observe();
  }

  /** @internal */
  public stop = async (): Promise<void> => {
    const { stopListener } = this;
    this.stopListener = undefined;

    if (stopListener) await stopListener();

    await this.children.stop();
  };
}
