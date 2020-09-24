import DocumentMatcher from './DocumentMatcher';
import QueryResolver from './QueryResolver';

describe('QueryResolver', () => {
  it('instantiates without crash', () => {
    const resolver = new QueryResolver();
    expect(resolver).toBeTruthy();
  });

  it('adds a matcher', () => {
    const resolver = new QueryResolver();
    const matcher = new DocumentMatcher({}, jest.fn());
    resolver.add('testId', matcher);
    expect(resolver.has('testId', matcher)).toBeTruthy();
  });

  it('deletes a matcher', () => {
    const resolver = new QueryResolver();
    const matcher = new DocumentMatcher({}, jest.fn());
    resolver.add('testId', matcher);
    expect(resolver.has('testId', matcher)).toBeTruthy();
    resolver.delete('testId');
    expect(resolver.has('testId', matcher)).toBeFalsy();
  });

  it('has a matcher', () => {
    const resolver = new QueryResolver();
    const matcher = new DocumentMatcher({ foo: 'bar' }, jest.fn());
    const sameMatcher = new DocumentMatcher({ foo: 'bar' }, jest.fn());
    const differentMatcher = new DocumentMatcher({ foo: 'not bar' }, jest.fn());
    resolver.add('testId', matcher);
    expect(resolver.has('testId', matcher)).toBeTruthy();
    expect(resolver.has('testId', sameMatcher)).toBeTruthy();
    expect(resolver.has('testId', differentMatcher)).toBeFalsy();
    expect(resolver.has('unknown', matcher)).toBeFalsy();
  });

  it('document matches at least once', () => {
    const resolver = new QueryResolver();
    const matcher = new DocumentMatcher({}, () => false);
    let otherMatcher = new DocumentMatcher({}, () => false);
    resolver.add('a', matcher);
    resolver.add('b', otherMatcher);
    expect(resolver.some({})).toBeFalsy();
    otherMatcher = new DocumentMatcher({}, () => true);
    resolver.add('a', matcher);
    resolver.add('b', otherMatcher);
    expect(resolver.some({})).toBeTruthy();
  });

  it('gets a list of matched and non-matched matcher', () => {
    const resolver = new QueryResolver();
    const matcherA = new DocumentMatcher({}, () => true);
    const matcherB = new DocumentMatcher({}, () => false);
    const matcherC = new DocumentMatcher({}, () => true);
    const matcherD = new DocumentMatcher({}, () => false);
    resolver.add('a', matcherA);
    resolver.add('b', matcherB);
    resolver.add('c', matcherC);
    resolver.add('d', matcherD);
    expect(resolver.match({})).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ]);
  });
});
