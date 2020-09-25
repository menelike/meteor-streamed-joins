import type { Mongo } from 'meteor/mongo';

import { ChildBase, ChildBaseOptions } from './base/ChildBase';
import type { RootBase } from './base/RootBase';
import type DocumentMatcher from './DocumentMatcher';
import { LinkChild } from './LinkChild';
import type { ExtractPrimaryKeys, LinkChildOptions } from './LinkChild';
import type { MeteorPublicationContext } from './PublicationContext';
import QueryResolver from './QueryResolver';
import type { MongoDoc, WithoutId } from './types';

export type LinkChildSelectorOptions = {
  fields?: ChildBaseOptions['fields'];
  skipPublication?: ChildBaseOptions['skipPublication'];
};

export type ExtractSelector<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> = (document: Partial<WithoutId<P>>) => DocumentMatcher<T> | undefined;

type ParentAdded<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> = {
  type: 'parentAdded';
  payload: {
    sourceId: string;
    doc: Partial<WithoutId<P>>;
    matcher: DocumentMatcher<T>;
  };
};

type ParentChanged<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> = {
  type: 'parentChanged';
  payload: {
    sourceId: string;
    doc: WithoutId<P>;
    matcher: DocumentMatcher<T>;
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
    doc: WithoutId<T>;
  };
};

type Changed<T extends MongoDoc = MongoDoc> = {
  type: 'changed';
  payload: {
    id: string;
    fields: Partial<WithoutId<T>>;
    doc: WithoutId<T>;
  };
};

type Replaced<T extends MongoDoc = MongoDoc> = {
  type: 'replaced';
  payload: {
    id: string;
    doc: WithoutId<T>;
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
  | ParentAdded<P, T>
  | ParentChanged<P, T>
  | ParentRemoved
  | Added<T>
  | Changed<T>
  | Replaced<T>
  | Removed
>;

export class LinkChildSelector<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> extends ChildBase<P, T> {
  private readonly resolver: ExtractSelector<P, T>;

  private readonly queryResolver: QueryResolver<T>;

  private queue: Queue<P, T>;

  private queueDocs: Record<string, T>;

  constructor(
    context: MeteorPublicationContext<T>,
    collection: Mongo.Collection<T>,
    resolver: ExtractSelector<P, T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parent: RootBase<P> | ChildBase<any, any>,
    options?: LinkChildOptions | undefined
  ) {
    super(context, collection, parent, {
      fields: options?.fields,
      skipPublication: !!options?.skipPublication,
    });
    this.resolver = resolver;
    this.queryResolver = new QueryResolver<T>();
    this.queue = [];
    this.queueDocs = {};
  }

  /** @internal */
  public commit(): void {
    const { queue } = this;
    this.queue = [];

    const selectors: Map<string, Mongo.Selector<T>> = new Map();
    // prefetch all documents into queueDocs
    // in order to avoid multiple queries against the db
    queue.forEach((q) => {
      switch (q.type) {
        case 'parentAdded':
        case 'parentChanged': {
          if (this.queryResolver.has(q.payload.sourceId, q.payload.matcher))
            break;
          selectors.set(q.payload.sourceId, q.payload.matcher.selector);
          break;
        }
        case 'parentRemoved': {
          selectors.delete(q.payload.sourceId);
          break;
        }
        case 'added':
        case 'changed':
        case 'replaced': {
          this.queueDocs[q.payload.id] = {
            _id: q.payload.id,
            ...q.payload.doc,
          } as T;
          break;
        }
        case 'removed': {
          delete this.queueDocs[q.payload.id];
          break;
        }
        /* istanbul ignore next */
        default:
      }
    });

    if (selectors.size) {
      this.collection
        .find(
          // @ts-ignore
          {
            $or: [...selectors.values()],
          }
        )
        .forEach((doc) => {
          this.queueDocs[doc._id] = doc;
        });
    }

    queue.forEach((q) => {
      switch (q.type) {
        case 'parentAdded': {
          this.queryResolver.add(q.payload.sourceId, q.payload.matcher);
          const keys = Object.values(this.queueDocs)
            .filter((doc) => q.payload.matcher.match(doc))
            .map((doc) => doc._id);
          this.publicationContext.addToRegistry(q.payload.sourceId, keys);
          break;
        }
        case 'parentChanged': {
          // don't do anything if the parent has returned an equal matcher
          if (this.queryResolver.has(q.payload.sourceId, q.payload.matcher))
            break;
          this.queryResolver.add(q.payload.sourceId, q.payload.matcher);
          const keys = Object.values(this.queueDocs)
            .filter((doc) => q.payload.matcher.match(doc))
            .map((doc) => doc._id);
          this.publicationContext.replaceFromRegistry(
            q.payload.sourceId,
            keys || /* istanbul ignore next */ []
          );
          break;
        }
        case 'parentRemoved': {
          this.queryResolver.delete(q.payload.sourceId);
          this.publicationContext.removeFromRegistry(q.payload.sourceId);
          break;
        }
        case 'added': {
          const [matched] = this.queryResolver.match(q.payload.doc);
          if (!matched.length) return;
          // register this document with every matching source
          matched.forEach((sourceId) => {
            this.publicationContext.addToRegistry(sourceId, [q.payload.id]);
          });
          break;
        }
        case 'changed': {
          const [matched, nonMatched] = this.queryResolver.match(q.payload.doc);
          if (nonMatched.length) {
            // otherwise remove it for every sourceId which doesn't match
            // we don't care if the child is registered for that source
            // let the registry handle those cases
            nonMatched.forEach((sourceId) => {
              this.publicationContext.removeFromRegistry(sourceId);
            });
          }

          // register this child with every matching sourceId
          matched.forEach((sourceId) => {
            this.publicationContext.addToRegistry(sourceId, [q.payload.id]);
          });

          this.publicationContext.changed(
            q.payload.id,
            this.filterFields(q.payload.fields)
          );
          this.children.parentChanged(q.payload.id, q.payload.doc);
          break;
        }
        case 'replaced': {
          const [matched, nonMatched] = this.queryResolver.match(q.payload.doc);
          if (nonMatched.length) {
            // otherwise remove it for every sourceId which doesn't match
            // we don't care if the child is registered for that source
            // let the registry handle those cases
            nonMatched.forEach((sourceId) => {
              this.publicationContext.removeFromRegistry(sourceId);
            });
          }

          // register this child with every matching sourceId
          matched.forEach((sourceId) => {
            this.publicationContext.addToRegistry(sourceId, [q.payload.id]);
          });

          this.publicationContext.replaced(
            q.payload.id,
            this.filterFields(q.payload.doc)
          );
          this.children.parentChanged(q.payload.id, q.payload.doc);
          break;
        }
        case 'removed': {
          // if the child is not present just ignore it
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
    const { queueDocs } = this;
    this.queueDocs = {};

    const added: Array<{ _id: string } & Partial<WithoutId<T>>> = [];
    const removed: Array<string> = [];
    if (this.publicationContext.addedChildrenIds.size) {
      Object.values(queueDocs).forEach((document) => {
        const { _id, ...doc } = document;
        const docFields = this.filterFields(doc);
        if (!this.publicationContext.addedChildrenIds.has(_id)) return;
        added.push({ _id, ...docFields });
        // only add the dangling document when this instance is the primary
        if (this.publicationContext.isPrimaryForChildId(_id)) {
          this.publicationContext.added(_id, docFields);
        }
      });
    }
    if (this.publicationContext.removedChildrenIds.size) {
      this.publicationContext.removedChildrenIds.forEach((_id) => {
        this.publicationContext.removed(_id);
        removed.push(_id);
      });
    }

    added.forEach(({ _id, ...doc }) => {
      this.children.parentAdded(_id, doc as Partial<WithoutId<T>>);
    });

    removed.forEach((_id) => {
      this.children.parentRemoved(_id);
    });

    this.children.commit();
  }

  // handle add from parent
  /** @internal */
  public parentAdded = (sourceId: string, doc: Partial<WithoutId<P>>): void => {
    const matcher = this.resolver(doc);

    if (matcher) {
      this.queue.push({
        type: 'parentAdded',
        payload: { sourceId, doc, matcher },
      });
    } else {
      this.parentRemoved(sourceId);
    }
  };

  // handle change from parent
  /** @internal */
  public parentChanged = (sourceId: string, doc: WithoutId<P>): void => {
    const matcher = this.resolver(doc);

    if (matcher) {
      this.queue.push({
        type: 'parentChanged',
        payload: { sourceId, doc, matcher },
      });
    } else {
      this.parentRemoved(sourceId);
    }
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

  private added = (id: string, doc: WithoutId<T>): void => {
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
    doc: WithoutId<T>
  ): void => {
    const hasForeignKey = this.publicationContext.hasChildId(id);
    const match = this.queryResolver.some(doc);
    // if there is a match but the key itself does not exist yet
    // it must be a new document
    if (match && !hasForeignKey) {
      this.added(id, doc);
      return;
    }

    // if it did not exist it can does not need to be removed or changed
    if (!hasForeignKey) return;

    // if it does not match to any selector it must be removed
    if (!match) {
      this.removed(id);
      return;
    }

    // the document has existed before and matches so it must be an update
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
  private replaced = (id: string, doc: WithoutId<T>): void => {
    const hasForeignKey = this.publicationContext.hasChildId(id);
    const match = this.queryResolver.some(doc);

    // if there is a match but the key itself does not exist yet
    // it must be a new document
    if (match && !hasForeignKey) {
      this.added(id, doc);
      return;
    }

    // if it did not exist it can does not need to be removed or replaced
    if (!hasForeignKey) return;

    // if it does not match to any selector it must be removed
    if (!match) {
      this.removed(id);
      return;
    }

    // the document has existed before and matches so it must be an update
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
