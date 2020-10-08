import type DocumentMatcher from './DocumentMatcher';
import type { MongoDoc } from './types';

class QueryResolver<T extends MongoDoc = MongoDoc> {
  private readonly matcherMap: Map<string, DocumentMatcher<T>> = new Map();

  public add(id: string, matcher: DocumentMatcher<T>): void {
    this.matcherMap.set(id, matcher);
  }

  public delete(id: string): void {
    this.matcherMap.delete(id);
  }

  public has(id: string, matcher: DocumentMatcher<T>): boolean {
    const currentMatcher = this.matcherMap.get(id);
    if (!currentMatcher) return false;
    return currentMatcher.isEqual(matcher);
  }

  public some(doc: T): boolean {
    return [...this.matcherMap.values()].some((matcher) => matcher.match(doc));
  }

  public match(doc: T): [Array<string>, Array<string>] {
    const matchedIds: Array<string> = [];
    const nonMatchedIds: Array<string> = [];

    this.matcherMap.forEach((matcher, key) => {
      if (matcher.match(doc)) matchedIds.push(key);
      else nonMatchedIds.push(key);
    });

    return [matchedIds, nonMatchedIds];
  }
}

export default QueryResolver;
