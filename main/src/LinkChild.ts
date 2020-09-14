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
      existingForeignKeyRegistry?.publicationContext.foreignKeyRegistry
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
    if (this.publicationContext.addedForeignKeys.size) {
      this.collection
        .find(
          // @ts-ignore
          {
            _id: { $in: [...this.publicationContext.addedForeignKeys] },
          },
          { fields: this.fields }
        )
        .forEach((document) => {
          const { _id, ...doc } = document;
          added.push(document);
          this.publicationContext.added(_id, doc);
        });
    }
    if (this.publicationContext.removedForeignKeys.size) {
      this.publicationContext.removedForeignKeys.forEach((_id) => {
        this.publicationContext.removed(_id);
        removed.push(_id);
      });
    }
    this.publicationContext.clear();

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

  // handle change events from change streams
  /** @internal */
  public changed = (
    _id: string,
    fields: Partial<WithoutId<T>>,
    doc: WithoutId<T>
  ): void => {
    if (!this.publicationContext.hasForeignKey(_id)) return;
    this.publicationContext.changed(_id, this.filterFields(fields));
    this.children.parentChanged(_id, doc);
    this.commit();
  };

  // handle replace events from change streams
  /** @internal */
  public replaced = (_id: string, doc: WithoutId<T>): void => {
    if (!this.publicationContext.hasForeignKey(_id)) return;
    this.publicationContext.replaced(_id, this.filterFields(doc));
    this.children.parentChanged(_id, doc);
    this.commit();
  };

  /* istanbul ignore next */
  private noop = (): void => undefined;

  /** @internal */
  public observe(): void {
    this.stopListener = ChangeStreamRegistry.addListener<T>(
      this.collection.rawCollection(),
      {
        added: this.noop,
        changed: this.changed,
        replaced: this.replaced,
        removed: this.noop,
      }
    );
    this.children.observe();
  }

  /** @internal */
  public stop(): boolean {
    if (this.stopListener) {
      this.stopListener();
      this.stopListener = undefined;
      return true;
    }

    this.children.stop();

    return false;
  }
}