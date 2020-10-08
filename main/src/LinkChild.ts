import type { Mongo } from 'meteor/mongo';

import { ChildBase, ChildBaseOptions } from './base/ChildBase';
import type { RootBase } from './base/RootBase';
import { LinkChildSelector } from './LinkChildSelector';
import type {
  ExtractSelector,
  LinkChildSelectorOptions,
} from './LinkChildSelector';
import type { MeteorPublicationContext } from './PublicationContext';
import type { MongoDoc, WithoutId } from './types';

export type LinkChildOptions = {
  fields?: ChildBaseOptions['fields'];
  skipPublication?: ChildBaseOptions['skipPublication'];
};

export type ExtractPrimaryKeys<P extends MongoDoc = MongoDoc> = (
  document: P
) => string[] | undefined;

type ParentAdded<T extends MongoDoc = MongoDoc> = {
  type: 'parentAdded';
  payload: {
    sourceId: string;
    doc: T;
  };
};

type ParentChanged<T extends MongoDoc = MongoDoc> = {
  type: 'parentChanged';
  payload: {
    sourceId: string;
    doc: T;
  };
};

type ParentRemoved = {
  type: 'parentRemoved';
  payload: {
    sourceId: string;
  };
};

type Added<T extends MongoDoc = MongoDoc> = {
  type: 'added';
  payload: {
    id: string;
    doc: T;
  };
};

type Changed<T extends MongoDoc = MongoDoc> = {
  type: 'changed';
  payload: {
    id: string;
    fields: Partial<WithoutId<T>>;
    doc: T;
  };
};

type Replaced<T extends MongoDoc = MongoDoc> = {
  type: 'replaced';
  payload: {
    id: string;
    doc: T;
  };
};

type Removed = {
  type: 'removed';
  payload: {
    id: string;
  };
};

type Queue<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> = Array<
  | ParentAdded<P>
  | ParentChanged<P>
  | ParentRemoved
  | Added<T>
  | Changed<T>
  | Replaced<T>
  | Removed
>;

export class LinkChild<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> extends ChildBase<P, T> {
  private readonly resolver: ExtractPrimaryKeys<P>;

  private queue: Queue<P, T>;

  constructor(
    context: MeteorPublicationContext<T>,
    collection: Mongo.Collection<T>,
    resolver: ExtractPrimaryKeys<P>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parent: RootBase<P> | ChildBase<any, any>,
    options: LinkChildOptions | undefined
  ) {
    super(context, collection, parent, {
      fields: options?.fields,
      skipPublication: !!options?.skipPublication,
    });
    this.resolver = resolver;
    this.queue = [];
  }

  /** @internal */
  public commit(): void {
    const { queue } = this;
    this.queue = [];

    queue.forEach((q) => {
      switch (q.type) {
        case 'parentAdded': {
          const keys = this.resolver(q.payload.doc);
          if (keys) {
            this.publicationContext.addToRegistry(q.payload.sourceId, keys);
          }
          break;
        }
        case 'parentChanged': {
          const keys = this.resolver(q.payload.doc);

          this.publicationContext.replaceFromRegistry(
            q.payload.sourceId,
            keys || /* istanbul ignore next */ []
          );
          break;
        }
        case 'parentRemoved': {
          this.publicationContext.removeFromRegistry(q.payload.sourceId);
          break;
        }
        case 'added': {
          if (!this.publicationContext.addedChildrenIds.has(q.payload.id))
            break;

          this.publicationContext.added(
            q.payload.id,
            this.filterFields(q.payload.doc)
          );
          this.children.parentAdded(q.payload.id, q.payload.doc);
          break;
        }
        case 'changed': {
          if (!this.publicationContext.hasChildId(q.payload.id)) break;

          this.publicationContext.changed(
            q.payload.id,
            this.filterFields(q.payload.fields)
          );
          this.children.parentChanged(q.payload.id, q.payload.doc);
          break;
        }
        case 'replaced': {
          if (!this.publicationContext.hasChildId(q.payload.id)) break;
          this.publicationContext.replaced(
            q.payload.id,
            this.filterFields(q.payload.doc)
          );
          this.children.parentChanged(q.payload.id, q.payload.doc);
          break;
        }
        case 'removed': {
          if (!this.publicationContext.hasChildId(q.payload.id)) break;
          this.publicationContext.removeChildFromRegistry(q.payload.id);
          break;
        }
        /* istanbul ignore next */
        default:
      }
    });
  }

  /** @internal */
  public flush(): void {
    const added: Array<T> = [];
    const removed: Array<string> = [];
    if (this.publicationContext.addedChildrenIds.size) {
      this.collection
        .find(
          // @ts-ignore
          {
            _id: { $in: [...this.publicationContext.addedChildrenIds] },
          }
        )
        .forEach((document) => {
          const { _id, ...doc } = document;
          added.push(document);
          this.publicationContext.added(_id, this.filterFields(doc));
        });
    }
    if (this.publicationContext.removedChildrenIds.size) {
      this.publicationContext.removedChildrenIds.forEach((_id) => {
        this.publicationContext.removed(_id);
        removed.push(_id);
      });
    }

    added.forEach((doc) => {
      this.children.parentAdded(doc._id, doc);
    });

    removed.forEach((_id) => {
      this.children.parentRemoved(_id);
    });

    this.children.commit();
  }

  // handle add from parent
  /** @internal */
  public parentAdded = (sourceId: string, doc: P): void => {
    this.queue.push({
      type: 'parentAdded',
      payload: { sourceId, doc },
    });
  };

  // handle change from parent
  /** @internal */
  public parentChanged = (sourceId: string, doc: P): void => {
    this.queue.push({
      type: 'parentChanged',
      payload: { sourceId, doc },
    });
  };

  // handle remove from parent
  /** @internal */
  public parentRemoved = (sourceId: string): void => {
    this.queue.push({
      type: 'parentRemoved',
      payload: {
        sourceId,
      },
    });
  };

  // handle added events from change streams
  // this is only used in cases where a linked document has been inserted
  // after the related document e.g. the insertion order/foreign key
  // relationship has been broken
  private added = (id: string, doc: T): void => {
    this.queue.push({
      type: 'added',
      payload: {
        id,
        doc,
      },
    });
    this.commit();
    this.flush();
  };

  // handle change events from change streams
  private changed = (
    id: string,
    fields: Partial<WithoutId<T>>,
    doc: T
  ): void => {
    this.queue.push({
      type: 'changed',
      payload: {
        id,
        fields,
        doc,
      },
    });
    this.commit();
    this.flush();
  };

  // handle replace events from change streams
  private replaced = (id: string, doc: T): void => {
    this.queue.push({
      type: 'replaced',
      payload: {
        id,
        doc,
      },
    });
    this.commit();
    this.flush();
  };

  // removes a child even if still related to the parent
  // which happens when the child is removed before all
  // related parents have been removed, counterpart wise to this.added()
  private removed = (id: string): void => {
    this.queue.push({
      type: 'removed',
      payload: {
        id,
      },
    });
    this.commit();
    this.flush();
  };

  /** @internal */
  public observe(): void {
    this.addListener({
      added: this.added,
      changed: this.changed,
      replaced: this.replaced,
      removed: this.removed,
    });
  }

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

  public select = <C extends MongoDoc = MongoDoc>(
    collection: Mongo.Collection<C>,
    resolver: ExtractSelector<T, C>,
    options?: LinkChildSelectorOptions
  ): LinkChildSelector<T, C> => {
    const child = new LinkChildSelector<T, C>(
      this.context as MeteorPublicationContext<C>,
      collection,
      resolver,
      this,
      options
    );

    this.children.link<C>(child);

    return child;
  };
}
