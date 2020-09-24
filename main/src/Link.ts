import type { Mongo } from 'meteor/mongo';

import type { RootBaseOptions } from './base/RootBase';
import { RootBase } from './base/RootBase';
import type { Matcher } from './DocumentMatcher';
import type { ExtractPrimaryKeys, LinkChildOptions } from './LinkChild';
import { LinkChild } from './LinkChild';
import type {
  ExtractSelector,
  LinkChildSelectorOptions,
} from './LinkChildSelector';
import { LinkChildSelector } from './LinkChildSelector';
import type { MeteorPublicationContext } from './PublicationContext';
import type { MongoDoc, WithoutId } from './types';

type Options<T extends MongoDoc = MongoDoc> = {
  matcher?: Matcher<T>;
  fields?: RootBaseOptions['fields'];
  skipPublication?: boolean;
};

class Link<T extends MongoDoc = MongoDoc> extends RootBase<T> {
  private readonly matcher: Matcher<T>;

  private readonly selector: Mongo.Selector<T>;

  private firstRun = true;

  constructor(
    context: MeteorPublicationContext<T>,
    collection: Mongo.Collection<T>,
    selector: Mongo.Selector<T>,
    matcher: Matcher<T>,
    options?: Options<T>
  ) {
    super(context, collection, { fields: options?.fields });
    this.selector = selector;
    this.matcher = matcher;
  }

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
    this.addListener({
      added: this.added,
      changed: this.changed,
      replaced: this.replaced,
      removed: this.removed,
    });
    this.context.onStop(this.stop);
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

export default Link;
