import type { Mongo } from 'meteor/mongo';

import ChangeStreamRegistry from './ChangeStreamRegistry';
import ChildDeMultiplexer from './ChildDeMultiplexer';
import { ExtractPrimaryKeys, LinkChild, LinkChildOptions } from './LinkChild';
import PublicationContext, {
  MeteorPublicationContext,
} from './PublicationContext';
import type { MongoDoc, WithoutId } from './types';
import filterFields, { FieldProjection } from './utils/filterFields';

export type Matcher<T extends MongoDoc = MongoDoc> = (
  doc: Partial<WithoutId<T>>
) => boolean;

type Options<T extends MongoDoc = MongoDoc> = {
  matcher?: Matcher<T>;
  fields?: FieldProjection;
  skipPublication?: boolean;
};

class Link<T extends MongoDoc = MongoDoc> {
  private readonly children: ChildDeMultiplexer<T>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly nodes: Set<Link<T> | LinkChild<any, any>>;

  private readonly matcher: Matcher<T>;

  private readonly fields: FieldProjection | undefined;

  private readonly collection: Mongo.Collection<T>;

  private readonly selector: Mongo.Selector<T>;

  /** @internal */
  public readonly publicationContext: PublicationContext<T>;

  private readonly context: MeteorPublicationContext<T>;

  private stopListener:
    | ReturnType<typeof ChangeStreamRegistry.addListener>
    | undefined;

  private firstRun = true;

  constructor(
    context: MeteorPublicationContext<T>,
    collection: Mongo.Collection<T>,
    selector: Mongo.Selector<T>,
    matcher: Matcher<T>,
    options?: Options<T>
  ) {
    this.context = context;
    this.publicationContext = new PublicationContext(
      context,
      collection.rawCollection().collectionName
    );
    this.collection = collection;
    this.selector = selector;
    this.matcher = matcher;
    this.fields = options?.fields;
    this.children = new ChildDeMultiplexer<T>();
    this.nodes = new Set([this]);
  }

  /** @internal */
  public root = (): Link<T> => {
    return this;
  };

  /** @internal */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setNode = (child: LinkChild<any, any>): void => {
    this.nodes.add(child);
  };

  /** @internal */
  public getNode = (
    collectionName: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Link<T> | LinkChild<any, any> | undefined => {
    return [...this.nodes].find(
      (child) => child.publicationContext.collectionName === collectionName
    );
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

  private added = (_id: string, doc: WithoutId<T>): void => {
    if (!this.matcher(doc)) return;
    this.publicationContext.addToRegistry(_id, [_id]);
    this.publicationContext.added(_id, this.filterFields(doc));
    this.children.parentAdded(_id, doc);
    if (!this.firstRun) this.children.commit();
  };

  private changed = (
    _id: string,
    fields: Partial<WithoutId<T>>,
    doc: T
  ): void => {
    const hasForeignKey = this.publicationContext.hasChildId(_id);
    const match = this.matcher(doc);

    if (match && !hasForeignKey) {
      this.added(_id, doc);
      return;
    }
    if (!hasForeignKey) return;
    if (!match) {
      this.removed(_id);
      return;
    }

    this.publicationContext.changed(_id, this.filterFields(fields));
    this.children.parentChanged(_id, doc);
    this.children.commit();
  };

  private replaced = (_id: string, doc: T): void => {
    const hasForeignKey = this.publicationContext.hasChildId(_id);
    const match = this.matcher(doc);

    if (match && !hasForeignKey) {
      this.added(_id, doc);
      return;
    }
    if (!hasForeignKey) return;
    if (!match) {
      this.removed(_id);
      return;
    }

    this.publicationContext.replaced(_id, this.filterFields(doc));
    this.children.parentChanged(_id, doc);
    this.children.commit();
  };

  private removed = (_id: string): void => {
    if (!this.publicationContext.hasChildId(_id)) return;
    this.publicationContext.removeFromRegistry(_id);
    this.publicationContext.removed(_id);
    this.children.parentRemoved(_id);
    this.children.commit();
  };

  public observe(): void {
    this.collection.find(this.selector).forEach(({ _id, ...doc }) => {
      this.added(_id, doc);
    });
    this.firstRun = false;
    this.children.commit();
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
    this.context.onStop(() => this.stop());
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

export default Link;
