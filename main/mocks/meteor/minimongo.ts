import type { Mongo } from 'meteor/mongo';
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
import { compileDocumentSelector } from 'minimongo/lib/selector';

import type { MongoDoc } from '../../src/types';

type MatcherType<T extends MongoDoc = MongoDoc> = (doc: Partial<T>) => boolean;

class Matcher<T extends MongoDoc = MongoDoc> {
  private readonly selector: Mongo.Selector<T>;

  private readonly matcher: MatcherType<T>;

  constructor(selector: Mongo.Selector<T>) {
    this.selector = selector;
    this.matcher = compileDocumentSelector(selector);
  }

  public _docMatcher = jest
    .fn<{ result: boolean }, [Partial<T>]>()
    .mockImplementation((doc) => ({ result: this.matcher(doc) }));
}

export const Minimongo = {
  Matcher,
};
