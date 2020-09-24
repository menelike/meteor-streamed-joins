import type { Mongo } from 'meteor/mongo';

import type { MongoDoc, WithoutId } from './types';

export type Matcher<T extends MongoDoc = MongoDoc> = (
  doc: Partial<WithoutId<T>>
) => boolean;

class DocumentMatcher<T extends MongoDoc = MongoDoc> {
  public readonly selector: Mongo.Selector<T>;

  private readonly matcher: Matcher<T>;

  private readonly id: string;

  constructor(selector: Mongo.Selector<T>, matcher: Matcher<T>) {
    this.selector = selector;
    this.matcher = matcher;
    // Todo won't work with regex instances in selector
    this.id = JSON.stringify(this.selector);
  }

  public match(doc: Partial<WithoutId<T>>): boolean {
    return this.matcher(doc);
  }

  public isEqual(matcher: DocumentMatcher<T>): boolean {
    return matcher.id === this.id;
  }
}

export default DocumentMatcher;
