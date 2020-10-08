import DocumentMatcher from './DocumentMatcher';
import QueryResolver from './QueryResolver';

describe('QueryResolver', () => {
  it('instantiates without crash', () => {
    const resolver = new QueryResolver();
    expect(resolver).toBeTruthy();
  });

  it('adds a matcher', () => {
    const resolver = new QueryResolver();
    const matcher = new DocumentMatcher({});
    resolver.add('testId', matcher);
    expect(resolver.has('testId', matcher)).toBeTruthy();
  });

  it('deletes a matcher', () => {
    const resolver = new QueryResolver();
    const matcher = new DocumentMatcher({});
    resolver.add('testId', matcher);
    expect(resolver.has('testId', matcher)).toBeTruthy();
    resolver.delete('testId');
    expect(resolver.has('testId', matcher)).toBeFalsy();
  });

  it('has a matcher', () => {
    const resolver = new QueryResolver();
    const matcher = new DocumentMatcher({ foo: 'bar' });
    const sameMatcher = new DocumentMatcher({ foo: 'bar' });
    const differentMatcher = new DocumentMatcher({ foo: 'not bar' });
    resolver.add('testId', matcher);
    expect(resolver.has('testId', matcher)).toBeTruthy();
    expect(resolver.has('testId', sameMatcher)).toBeTruthy();
    expect(resolver.has('testId', differentMatcher)).toBeFalsy();
    expect(resolver.has('unknown', matcher)).toBeFalsy();
  });

  it('document matches at least once', () => {
    const resolver = new QueryResolver();
    const matcher = new DocumentMatcher({ dont: 'match' });
    const otherMatcher = new DocumentMatcher({ do: 'match' });
    resolver.add('a', matcher);
    resolver.add('b', otherMatcher);
    expect(resolver.some({ _id: 'someId', no: 'match' })).toBeFalsy();
    expect(resolver.some({ _id: 'someId', do: 'match' })).toBeTruthy();
  });

  it('gets a list of matched and non-matched matcher', () => {
    const resolver = new QueryResolver();
    const matcherA = new DocumentMatcher({ a: 'exists' });
    const matcherB = new DocumentMatcher({ b: 'exists' });
    const matcherC = new DocumentMatcher({ c: 'exists' });
    const matcherD = new DocumentMatcher({ d: 'exists' });
    resolver.add('a', matcherA);
    resolver.add('b', matcherB);
    resolver.add('c', matcherC);
    resolver.add('d', matcherD);
    expect(resolver.match({ _id: 'someId', a: 'exists', c: 'exists' })).toEqual(
      [
        ['a', 'c'],
        ['b', 'd'],
      ]
    );
  });
});
