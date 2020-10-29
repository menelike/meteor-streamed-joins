import type { Mongo } from 'meteor/mongo';

import { ChildBase, ChildBaseOptions } from './base/ChildBase';
import type { RootBase } from './base/RootBase';
import DocumentMatcher from './DocumentMatcher';
import { LinkChild } from './LinkChild';
import type { ExtractPrimaryKeys, LinkChildOptions } from './LinkChild';
import type { MeteorPublicationContext } from './PublicationContext';
import QueryResolver from './QueryResolver';
import type { MongoDoc, StringOrObjectID } from './types';
import { objectIdToString } from './utils/idGeneration';

export type LinkChildSelectorOptions = {
  fields?: ChildBaseOptions['fields'];
  skipPublication?: ChildBaseOptions['skipPublication'];
};

export type ExtractSelector<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> = (document: P) => Mongo.Selector<T> | undefined;

type ParentAdded<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> = {
  type: 'parentAdded';
  payload: {
    sourceId: StringOrObjectID;
    doc: P;
    matcher: DocumentMatcher<T>;
  };
};

type ParentChanged<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> = {
  type: 'parentChanged';
  payload: {
    sourceId: StringOrObjectID;
    doc: P;
    matcher: DocumentMatcher<T>;
  };
};

type ParentRemoved = {
  type: 'parentRemoved';
  payload: {
    sourceId: StringOrObjectID;
  };
};

type Added<T extends MongoDoc = MongoDoc> = {
  type: 'added';
  payload: {
    id: StringOrObjectID;
    doc: T;
  };
};

type Changed<T extends MongoDoc = MongoDoc> = {
  type: 'changed';
  payload: {
    id: StringOrObjectID;
    doc: T;
  };
};

type Removed = {
  type: 'removed';
  payload: {
    id: StringOrObjectID;
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
    options: LinkChildSelectorOptions | undefined
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
          if (
            this.queryResolver.has(
              objectIdToString(q.payload.sourceId),
              q.payload.matcher
            )
          )
            break;
          selectors.set(
            objectIdToString(q.payload.sourceId),
            q.payload.matcher.selector
          );
          break;
        }
        case 'parentRemoved': {
          selectors.delete(objectIdToString(q.payload.sourceId));
          break;
        }
        case 'added':
        case 'changed': {
          this.queueDocs[objectIdToString(q.payload.id)] = q.payload.doc;
          break;
        }
        case 'removed': {
          delete this.queueDocs[objectIdToString(q.payload.id)];
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
          this.queueDocs[objectIdToString(doc._id)] = doc;
        });
    }

    queue.forEach((q) => {
      switch (q.type) {
        case 'parentAdded': {
          this.queryResolver.add(
            objectIdToString(q.payload.sourceId),
            q.payload.matcher
          );
          const keys = Object.values(this.queueDocs)
            .filter((doc) => q.payload.matcher.match(doc))
            .map((doc) => doc._id);
          this.publicationContext.addToRegistry(
            objectIdToString(q.payload.sourceId),
            keys.map((key) => objectIdToString(key))
          );
          break;
        }
        case 'parentChanged': {
          // don't do anything if the parent has returned an equal matcher
          if (
            this.queryResolver.has(
              objectIdToString(q.payload.sourceId),
              q.payload.matcher
            )
          )
            break;
          this.queryResolver.add(
            objectIdToString(q.payload.sourceId),
            q.payload.matcher
          );
          const keys = Object.values(this.queueDocs)
            .filter((doc) => q.payload.matcher.match(doc))
            .map((doc) => doc._id);
          this.publicationContext.replaceFromRegistry(
            objectIdToString(q.payload.sourceId),
            (keys || /* istanbul ignore next */ []).map((key) =>
              objectIdToString(key)
            )
          );
          break;
        }
        case 'parentRemoved': {
          this.queryResolver.delete(objectIdToString(q.payload.sourceId));
          this.publicationContext.removeFromRegistry(
            objectIdToString(q.payload.sourceId)
          );
          break;
        }
        case 'added': {
          const [matched] = this.queryResolver.match(q.payload.doc);
          if (!matched.length) return;
          // register this document with every matching source
          matched.forEach((sourceId) => {
            this.publicationContext.addToRegistry(sourceId, [
              objectIdToString(q.payload.id),
            ]);
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
              this.publicationContext.removeFromRegistry(sourceId, [
                objectIdToString(q.payload.id),
              ]);
            });
          }

          // register this child with every matching sourceId
          matched.forEach((sourceId) => {
            this.publicationContext.addToRegistry(sourceId, [
              objectIdToString(q.payload.id),
            ]);
          });

          const diffedFields = this.diffDocumentWithPublished(
            objectIdToString(q.payload.id),
            q.payload.doc
          );
          this.publicationContext.changed(
            objectIdToString(q.payload.id),
            diffedFields
          );
          this.children.parentChanged(q.payload.id, q.payload.doc);
          break;
        }
        case 'removed': {
          // if the child is not present just ignore it
          if (
            !this.publicationContext.hasChildId(objectIdToString(q.payload.id))
          )
            break;
          this.publicationContext.removeChildFromRegistry(
            objectIdToString(q.payload.id)
          );
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

    const added: Array<T> = [];
    const removed: Array<string> = [];
    if (this.publicationContext.addedChildrenIds.size) {
      Object.values(queueDocs).forEach((document) => {
        const { _id, ...doc } = document;
        const docFields = this.filterFields(doc);
        if (
          !this.publicationContext.addedChildrenIds.has(objectIdToString(_id))
        )
          return;
        added.push(document);
        // only add the dangling document when this instance is the primary
        if (
          this.publicationContext.isPrimaryForChildId(objectIdToString(_id))
        ) {
          this.publicationContext.added(objectIdToString(_id), docFields);
        }
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
  public parentAdded = (sourceId: StringOrObjectID, doc: P): void => {
    const selector = this.resolver(doc);

    if (selector) {
      const matcher = new DocumentMatcher<T>(selector);
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
  public parentChanged = (sourceId: StringOrObjectID, doc: P): void => {
    const selector = this.resolver(doc);

    if (selector) {
      const matcher = new DocumentMatcher<T>(selector);
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
  public parentRemoved = (sourceId: StringOrObjectID): void => {
    this.queue.push({
      type: 'parentRemoved',
      payload: {
        sourceId,
      },
    });
  };

  private added = (id: StringOrObjectID, doc: T): void => {
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
  private changed = (id: StringOrObjectID, doc: T): void => {
    const hasForeignKey = this.publicationContext.hasChildId(
      objectIdToString(id)
    );
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
        doc,
      },
    });
    this.commit();
    this.flush();
  };

  // handle replace events from change streams
  private replaced = (id: StringOrObjectID, doc: T): void => {
    this.changed(id, doc);
  };

  // removes a child even if still related to the parent
  // which happens when the child is removed before all
  // related parents have been removed, counterpart wise to this.added()
  private removed = (id: StringOrObjectID): void => {
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
