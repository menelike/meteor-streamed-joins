import MeteorPublicationMock from '../tests/MeteorPublicationMock';

import ForeignKeyRegistry from './ForeignKeyRegistry';
import PublicationContext from './PublicationContext';

const CollectionName = 'testCollectionName';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PublicationContext', () => {
  it('creates new foreignKeyRegistry', () => {
    expect.assertions(2);

    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName
    );

    context.addToRegistry('key', ['a']);
    expect(context.addedForeignKeys).toEqual(new Set('a'));
    context.clear();
    context.removeFromRegistry('key');
    expect(context.removedForeignKeys).toEqual(new Set('a'));
  });

  it('sets foreignKeyRegistry as arg', () => {
    expect.assertions(2);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );

    expect(context.addedForeignKeys).toBe(foreignKeyRegistry.added);
    expect(context.removedForeignKeys).toBe(foreignKeyRegistry.removed);
  });

  it('adds foreignKey', () => {
    expect.assertions(13);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );

    // nothing should be called as foreignKey has not been registered before
    context.added('foreignKeyA', {});
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
    expect(context.addedForeignKeys).toEqual(new Set());
    expect(context.removedForeignKeys).toEqual(new Set());
    expect(context.hasForeignKey('foreignKeyA')).toBeFalsy();

    context.addToRegistry('testSource', ['foreignKeyA']);
    expect(context.hasForeignKey('foreignKeyA')).toBeTruthy();
    expect(context.addedForeignKeys).toEqual(new Set(['foreignKeyA']));
    expect(context.removedForeignKeys).toEqual(new Set());

    const doc = {};
    context.added('foreignKeyA', doc);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledWith(
      CollectionName,
      'foreignKeyA',
      doc
    );
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('has foreign key after added', () => {
    expect.assertions(2);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );

    expect(context.hasForeignKey('foreignKeyA')).toBeFalsy();
    context.addToRegistry('testSourceId', ['foreignKeyA']);
    expect(context.hasForeignKey('foreignKeyA')).toBeTruthy();
  });

  it('calls clear before adding', () => {
    expect.assertions(5);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );

    context.addToRegistry('testSource', ['foreignKeyA']);
    context.clear();

    expect(context.hasForeignKey('foreignKeyA')).toBeTruthy();
    expect(
      foreignKeyRegistry.isPrimaryForForeignKey(context.id, 'foreignKeyA')
    ).toBeTruthy();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('changed foreignKey as primary handler', () => {
    expect.assertions(4);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.clear();

    const fields = { some: 'thing' };
    context.changed('foreignKeyA', fields);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledWith(
      CollectionName,
      'foreignKeyA',
      fields
    );
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('changed foreignKey but not as primary handler', () => {
    expect.assertions(3);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );
    foreignKeyRegistry.add('primaryHandlerId', 'testSource', ['foreignKeyA']);
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.clear();

    context.changed('foreignKeyA', {});
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('replaced foreignKey as primary handler', () => {
    expect.assertions(5);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.clear();

    const doc = {};
    context.replaced('foreignKeyA', doc);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledWith(
      CollectionName,
      'foreignKeyA'
    );
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledWith(
      CollectionName,
      'foreignKeyA',
      doc
    );
  });

  it('replaced foreignKey but not as primary handler', () => {
    expect.assertions(3);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );
    foreignKeyRegistry.add('primaryHandlerId', 'testSource', ['foreignKeyA']);
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.clear();

    context.replaced('foreignKeyA', {});
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('removed foreignKey', () => {
    expect.assertions(7);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.clear();
    expect(context.hasForeignKey('foreignKeyA')).toBeTruthy();
    expect(
      foreignKeyRegistry.isPrimaryForForeignKey(context.id, 'foreignKeyA')
    ).toBeTruthy();

    context.removeFromRegistry('testSource');
    expect(context.removedForeignKeys).toEqual(new Set(['foreignKeyA']));

    context.removed('foreignKeyA');
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledWith(
      CollectionName,
      'foreignKeyA'
    );
  });

  it('calls clear before removal', () => {
    expect.assertions(6);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.clear();
    expect(context.hasForeignKey('foreignKeyA')).toBeTruthy();
    expect(
      foreignKeyRegistry.isPrimaryForForeignKey(context.id, 'foreignKeyA')
    ).toBeTruthy();

    context.removeFromRegistry('testSource');
    expect(context.removedForeignKeys).toEqual(new Set(['foreignKeyA']));

    context.clear();
    context.removed('foreignKeyA');
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('removed unknown foreignKey', () => {
    expect.assertions(5);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );

    expect(context.hasForeignKey('nonExistingSource')).toBeFalsy();
    expect(
      foreignKeyRegistry.isPrimaryForForeignKey(context.id, 'nonExistingSource')
    ).toBeFalsy();

    // test removal of unknown keys
    context.removed('nonExistingSource');
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('changes empty fields', () => {
    expect.assertions(2);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      MeteorPublicationMock,
      CollectionName,
      foreignKeyRegistry
    );

    context.addToRegistry('sourceId', ['fk']);
    context.changed('fk', {});
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    context.changed('fk', { not: 'empty' });
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
  });
});
