import type { Mongo } from 'meteor/mongo';

import type { MongoDoc } from './types';

// @ts-ignore
const Minimongo = global.Package?.minimongo?.Minimongo;

export type Matcher<T extends MongoDoc = MongoDoc> = (
  doc: Partial<T>
) => { result: boolean };

class DocumentMatcher<T extends MongoDoc = MongoDoc> {
  public readonly selector: Mongo.Selector<T>;

  private readonly matcher: Matcher<T>;

  private readonly id: string;

  constructor(selector: Mongo.Selector<T>) {
    this.selector = selector;
    // @ts-ignore
    this.matcher = new Minimongo.Matcher<T>(selector)._docMatcher;
    // Todo won't work with regex instances in selector
    this.id = JSON.stringify(this.selector);
  }

  public match(doc: Partial<T>): boolean {
    return this.matcher(doc).result;
  }

  public isEqual(matcher: DocumentMatcher<T>): boolean {
    return matcher.id === this.id;
  }
}

export default DocumentMatcher;
