import ForeignKeyRegistry from './ForeignKeyRegistry';

describe('ForeignKeyRegistry', () => {
  it('instantiates without crash', () => {
    expect.assertions(2);

    const registry = new ForeignKeyRegistry();
    expect(registry.added.size).toBe(0);
    expect(registry.removed.size).toBe(0);
  });

  it('adds empty foreignKeys', () => {
    expect.assertions(2);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'testSourceId', []);
    expect(registry.added.size).toBe(0);
    expect(registry.removed.size).toBe(0);
  });

  it('adds a new foreignKey', () => {
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

  it('has foreignKey', () => {
    expect.assertions(3);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'testSourceId', ['a']);
    expect(registry.hasForeignKey('testId', 'a')).toBeTruthy();
    expect(registry.hasForeignKey('testId', 'unknown')).toBeFalsy();
    registry.remove('testId', 'testSourceId');
    expect(registry.hasForeignKey('testId', 'a')).toBeFalsy();
  });

  it('keeps multiple references to the same foreignKey', () => {
    expect.assertions(3);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'sourceIdA', ['a']);
    registry.add('testId', 'sourceIdB', ['a']);
    expect(registry.hasForeignKey('testId', 'a')).toBeTruthy();
    registry.remove('testId', 'sourceIdA');
    expect(registry.hasForeignKey('testId', 'a')).toBeTruthy();
    registry.remove('testId', 'sourceIdB');
    expect(registry.hasForeignKey('testId', 'a')).toBeFalsy();
  });

  it('calls replaced without existing source', () => {
    expect.assertions(5);

    const registry = new ForeignKeyRegistry();
    registry.replace('testId', 'sourceIdA', ['a', 'b', 'c']);
    expect(registry.hasForeignKey('testId', 'a')).toBeTruthy();
    expect(registry.hasForeignKey('testId', 'b')).toBeTruthy();
    expect(registry.hasForeignKey('testId', 'c')).toBeTruthy();

    expect(registry.added).toEqual(new Set(['a', 'b', 'c']));
    expect(registry.removed).toEqual(new Set());
  });

  it('diffs when replaced', () => {
    expect.assertions(11);

    const registry = new ForeignKeyRegistry();
    registry.add('testId', 'sourceIdA', ['a', 'b', 'c']);
    expect(registry.hasForeignKey('testId', 'a')).toBeTruthy();
    expect(registry.hasForeignKey('testId', 'b')).toBeTruthy();
    expect(registry.hasForeignKey('testId', 'c')).toBeTruthy();
    registry.clear();
    registry.replace('testId', 'sourceIdA', ['a', 'c', 'd']);
    expect(registry.hasForeignKey('testId', 'a')).toBeTruthy();
    expect(registry.hasForeignKey('testId', 'b')).toBeFalsy();
    expect(registry.hasForeignKey('testId', 'c')).toBeTruthy();
    expect(registry.hasForeignKey('testId', 'd')).toBeTruthy();

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

  it('keeps multiple references to the same foreignKey from different ids', () => {
    expect.assertions(11);

    const registry = new ForeignKeyRegistry();
    registry.add('testIdA', 'sourceIdA', ['a']);
    registry.add('testIdB', 'sourceIdA', ['a']);
    expect(registry.hasForeignKey('testIdA', 'a')).toBeTruthy();
    expect(registry.hasForeignKey('testIdB', 'a')).toBeTruthy();
    expect(registry.added).toEqual(new Set(['a']));
    expect(registry.removed).toEqual(new Set());
    registry.remove('testIdA', 'sourceIdA');
    expect(registry.added).toEqual(new Set(['a']));
    expect(registry.removed).toEqual(new Set());
    expect(registry.hasForeignKey('testIdA', 'a')).toBeFalsy();
    expect(registry.hasForeignKey('testIdB', 'a')).toBeTruthy();
    registry.remove('testIdB', 'sourceIdA');
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set());
    expect(registry.hasForeignKey('testIdB', 'a')).toBeFalsy();
  });

  it('set primary on foreign key with multiple ids', () => {
    expect.assertions(6);

    const registry = new ForeignKeyRegistry();
    registry.add('testIdA', 'sourceIdA', ['a']);
    registry.add('testIdA', 'sourceIdB', ['a']);
    registry.add('testIdB', 'sourceIdA', ['a']);
    expect(registry.isPrimaryForForeignKey('testIdA', 'a')).toBeTruthy();
    expect(registry.isPrimaryForForeignKey('testIdB', 'a')).toBeFalsy();
    registry.remove('testIdA', 'sourceIdA');
    expect(registry.isPrimaryForForeignKey('testIdA', 'a')).toBeTruthy();
    expect(registry.isPrimaryForForeignKey('testIdB', 'a')).toBeFalsy();
    registry.remove('testIdA', 'sourceIdB');
    expect(registry.isPrimaryForForeignKey('testIdA', 'a')).toBeFalsy();
    expect(registry.isPrimaryForForeignKey('testIdB', 'a')).toBeTruthy();
  });
});
