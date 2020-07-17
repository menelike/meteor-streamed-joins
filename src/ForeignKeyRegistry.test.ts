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
    registry.add('testCollection', []);
    expect(registry.added.size).toBe(0);
    expect(registry.removed.size).toBe(0);
  });

  it('adds a new foreignKey', () => {
    expect.assertions(4);

    const registry = new ForeignKeyRegistry();
    registry.add('sourceId', ['a']);
    expect(registry.added).toEqual(new Set(['a']));
    expect(registry.removed).toEqual(new Set());
    registry.clear();
    registry.add('sourceId', ['a']);
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set());
  });

  it('has foreignKey', () => {
    expect.assertions(3);

    const registry = new ForeignKeyRegistry();
    registry.add('sourceId', ['a']);
    expect(registry.hasForeignKey('a')).toBeTruthy();
    expect(registry.hasForeignKey('unknown')).toBeFalsy();
    registry.remove('sourceId');
    expect(registry.hasForeignKey('a')).toBeFalsy();
  });

  it('keeps multiple references to the same foreignKey', () => {
    expect.assertions(3);

    const registry = new ForeignKeyRegistry();
    registry.add('sourceIdA', ['a']);
    registry.add('sourceIdB', ['a']);
    expect(registry.hasForeignKey('a')).toBeTruthy();
    registry.remove('sourceIdA');
    expect(registry.hasForeignKey('a')).toBeTruthy();
    registry.remove('sourceIdB');
    expect(registry.hasForeignKey('a')).toBeFalsy();
  });

  it('diffs when replaced', () => {
    expect.assertions(11);

    const registry = new ForeignKeyRegistry();
    registry.add('sourceIdA', ['a', 'b', 'c']);
    expect(registry.hasForeignKey('a')).toBeTruthy();
    expect(registry.hasForeignKey('b')).toBeTruthy();
    expect(registry.hasForeignKey('c')).toBeTruthy();
    registry.clear();
    registry.replace('sourceIdA', ['a', 'c', 'd']);
    expect(registry.hasForeignKey('a')).toBeTruthy();
    expect(registry.hasForeignKey('b')).toBeFalsy();
    expect(registry.hasForeignKey('c')).toBeTruthy();
    expect(registry.hasForeignKey('d')).toBeTruthy();

    expect(registry.added).toEqual(new Set(['d']));
    expect(registry.removed).toEqual(new Set(['b']));
    registry.clear();
    registry.replace('sourceIdA', ['a', 'c', 'd']);
    expect(registry.added).toEqual(new Set([]));
    expect(registry.removed).toEqual(new Set([]));
  });

  it('removed from deleted when added after', () => {
    expect.assertions(4);

    const registry = new ForeignKeyRegistry();
    registry.add('sourceIdA', ['a']);
    registry.clear();
    registry.remove('sourceIdA');
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set(['a']));
    registry.add('sourceIdA', ['a']);
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set());
  });

  it('do not cause changes when add, change and remove happen in one phase', () => {
    expect.assertions(2);

    const registry = new ForeignKeyRegistry();
    registry.add('sourceIdA', ['a', 'b', 'c']);
    registry.replace('sourceIdA', ['a', 'b', 'd']);
    registry.remove('sourceIdA');
    expect(registry.added).toEqual(new Set());
    expect(registry.removed).toEqual(new Set());
  });
});
