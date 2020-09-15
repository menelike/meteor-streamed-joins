import ForeignKeyRegistry from './ForeignKeyRegistry';

describe('ForeignKeyRegistry', () => {
  it('instantiates without crash', () => {
    expect.assertions(2);

    const registry = new ForeignKeyRegistry();
    expect(registry.added.size).toBe(0);
    expect(registry.removed.size).toBe(0);
  });

  it('adds empty childId', () => {
    expect.assertions(2);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'testSourceId', []);
    expect(registry.added.size).toBe(0);
    expect(registry.removed.size).toBe(0);
  });

  it('adds a new childId', () => {
    expect.assertions(4);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'testSourceId', ['a']);
    expect(registry.added).toEqual(new Set(['a']));
    expect(registry.removed).toEqual(new Set());
    registry.clear();
    registry.add('testId', 'testSourceId', ['a']);
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set());
  });

  it('has childId', () => {
    expect.assertions(3);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'testSourceId', ['a']);
    expect(registry.hasChildId('testId', 'a')).toBeTruthy();
    expect(registry.hasChildId('testId', 'unknown')).toBeFalsy();
    registry.remove('testId', 'testSourceId');
    expect(registry.hasChildId('testId', 'a')).toBeFalsy();
  });

  it('keeps multiple references to the same childId', () => {
    expect.assertions(3);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'sourceIdA', ['a']);
    registry.add('testId', 'sourceIdB', ['a']);
    expect(registry.hasChildId('testId', 'a')).toBeTruthy();
    registry.remove('testId', 'sourceIdA');
    expect(registry.hasChildId('testId', 'a')).toBeTruthy();
    registry.remove('testId', 'sourceIdB');
    expect(registry.hasChildId('testId', 'a')).toBeFalsy();
  });

  it('calls replaced without existing source', () => {
    expect.assertions(5);

    const registry = new ForeignKeyRegistry();
    registry.replace('testId', 'sourceIdA', ['a', 'b', 'c']);
    expect(registry.hasChildId('testId', 'a')).toBeTruthy();
    expect(registry.hasChildId('testId', 'b')).toBeTruthy();
    expect(registry.hasChildId('testId', 'c')).toBeTruthy();

    expect(registry.added).toEqual(new Set(['a', 'b', 'c']));
    expect(registry.removed).toEqual(new Set());
  });

  it('diffs when replaced', () => {
    expect.assertions(11);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'sourceIdA', ['a', 'b', 'c']);
    expect(registry.hasChildId('testId', 'a')).toBeTruthy();
    expect(registry.hasChildId('testId', 'b')).toBeTruthy();
    expect(registry.hasChildId('testId', 'c')).toBeTruthy();
    registry.clear();
    registry.replace('testId', 'sourceIdA', ['a', 'c', 'd']);
    expect(registry.hasChildId('testId', 'a')).toBeTruthy();
    expect(registry.hasChildId('testId', 'b')).toBeFalsy();
    expect(registry.hasChildId('testId', 'c')).toBeTruthy();
    expect(registry.hasChildId('testId', 'd')).toBeTruthy();

    expect(registry.added).toEqual(new Set(['d']));
    expect(registry.removed).toEqual(new Set(['b']));
    registry.clear();
    registry.replace('testId', 'sourceIdA', ['a', 'c', 'd']);
    expect(registry.added).toEqual(new Set([]));
    expect(registry.removed).toEqual(new Set([]));
  });

  it('removed from deleted when added after', () => {
    expect.assertions(4);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'sourceIdA', ['a']);
    registry.clear();
    registry.remove('testId', 'sourceIdA');
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set(['a']));
    registry.add('testId', 'sourceIdA', ['a']);
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set());
  });

  it('do not cause changes when add, change and remove happen in one phase', () => {
    expect.assertions(2);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'sourceIdA', ['a', 'b', 'c']);
    registry.replace('testId', 'sourceIdA', ['a', 'b', 'd']);
    registry.remove('testId', 'sourceIdA');
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set());
  });

  it('keeps multiple references to the same childId from different parents', () => {
    expect.assertions(11);

    const registry = new ForeignKeyRegistry();
    registry.add('testIdA', 'sourceIdA', ['a']);
    registry.add('testIdB', 'sourceIdA', ['a']);
    expect(registry.hasChildId('testIdA', 'a')).toBeTruthy();
    expect(registry.hasChildId('testIdB', 'a')).toBeTruthy();
    expect(registry.added).toEqual(new Set(['a']));
    expect(registry.removed).toEqual(new Set());
    registry.remove('testIdA', 'sourceIdA');
    expect(registry.added).toEqual(new Set(['a']));
    expect(registry.removed).toEqual(new Set());
    expect(registry.hasChildId('testIdA', 'a')).toBeFalsy();
    expect(registry.hasChildId('testIdB', 'a')).toBeTruthy();
    registry.remove('testIdB', 'sourceIdA');
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set());
    expect(registry.hasChildId('testIdB', 'a')).toBeFalsy();
  });

  it('set primary on childId with multiple parents', () => {
    expect.assertions(6);

    const registry = new ForeignKeyRegistry();
    registry.add('testIdA', 'sourceIdA', ['a']);
    registry.add('testIdA', 'sourceIdB', ['a']);
    registry.add('testIdB', 'sourceIdA', ['a']);
    expect(registry.isPrimaryForChildId('testIdA', 'a')).toBeTruthy();
    expect(registry.isPrimaryForChildId('testIdB', 'a')).toBeFalsy();
    registry.remove('testIdA', 'sourceIdA');
    expect(registry.isPrimaryForChildId('testIdA', 'a')).toBeTruthy();
    expect(registry.isPrimaryForChildId('testIdB', 'a')).toBeFalsy();
    registry.remove('testIdA', 'sourceIdB');
    expect(registry.isPrimaryForChildId('testIdA', 'a')).toBeFalsy();
    expect(registry.isPrimaryForChildId('testIdB', 'a')).toBeTruthy();
  });
});
