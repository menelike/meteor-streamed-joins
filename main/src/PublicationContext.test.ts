import MeteorPublicationMock from '../tests/MeteorPublicationMock';

import ForeignKeyRegistry from './ForeignKeyRegistry';
import PublicationContext from './PublicationContext';

const CollectionName = 'testCollectionName';

const meteorPublicationMock = new MeteorPublicationMock();

beforeEach(() => {
  meteorPublicationMock.stop();
  jest.clearAllMocks();
});

describe('PublicationContext', () => {
  it('creates new foreignKeyRegistry', () => {
    expect.assertions(2);

    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName
    );

    context.addToRegistry('key', ['a']);
    expect(context.addedChildrenIds).toEqual(new Set('a'));
    context.addedChildrenIds.delete('a');
    context.removeFromRegistry('key');
    expect(context.removedChildrenIds).toEqual(new Set('a'));
  });

  it('sets foreignKeyRegistry as arg', () => {
    expect.assertions(2);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );

    expect(context.addedChildrenIds).toBe(foreignKeyRegistry.added);
    expect(context.removedChildrenIds).toBe(foreignKeyRegistry.removed);
  });

  it('adds foreignKey', () => {
    expect.assertions(13);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );

    // nothing should be called as foreignKey has not been registered before
    context.added('foreignKeyA', {});
    expect(meteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.removed).toHaveBeenCalledTimes(0);
    expect(context.addedChildrenIds).toEqual(new Set());
    expect(context.removedChildrenIds).toEqual(new Set());
    expect(context.hasChildId('foreignKeyA')).toBeFalsy();

    context.addToRegistry('testSource', ['foreignKeyA']);
    expect(context.hasChildId('foreignKeyA')).toBeTruthy();
    expect(context.addedChildrenIds).toEqual(new Set(['foreignKeyA']));
    expect(context.removedChildrenIds).toEqual(new Set());

    const doc = {};
    context.added('foreignKeyA', doc);
    expect(meteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(meteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      CollectionName,
      'foreignKeyA',
      doc
    );
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('has foreign key after added', () => {
    expect.assertions(2);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );

    expect(context.hasChildId('foreignKeyA')).toBeFalsy();
    context.addToRegistry('testSourceId', ['foreignKeyA']);
    expect(context.hasChildId('foreignKeyA')).toBeTruthy();
  });

  it('calls clear before adding', () => {
    expect.assertions(5);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );

    context.addToRegistry('testSource', ['foreignKeyA']);
    context.added('foreignKeyA', {});

    expect(context.hasChildId('foreignKeyA')).toBeTruthy();
    expect(
      foreignKeyRegistry.isPrimaryForChildId(context.id, 'foreignKeyA')
    ).toBeTruthy();
    expect(meteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('changed foreignKey as primary handler', () => {
    expect.assertions(4);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.added('foreignKeyA', {});

    const fields = { some: 'thing' };
    context.changed('foreignKeyA', fields);
    expect(meteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(1);
    expect(meteorPublicationMock.changed).toHaveBeenNthCalledWith(
      1,
      CollectionName,
      'foreignKeyA',
      fields
    );
    expect(meteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('changed foreignKey but not as primary handler', () => {
    expect.assertions(3);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );
    foreignKeyRegistry.add('primaryHandlerId', 'testSource', ['foreignKeyA']);
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.added('foreignKeyA', {});

    context.changed('foreignKeyA', { some: 'thing' });
    expect(meteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('removed foreignKey', () => {
    expect.assertions(7);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );
    context.addToRegistry('testSource', ['foreignKeyA']);
    context.added('foreignKeyA', {});
    expect(context.hasChildId('foreignKeyA')).toBeTruthy();
    expect(
      foreignKeyRegistry.isPrimaryForChildId(context.id, 'foreignKeyA')
    ).toBeTruthy();

    context.removeFromRegistry('testSource');
    expect(context.removedChildrenIds).toEqual(new Set(['foreignKeyA']));

    context.removed('foreignKeyA');
    expect(meteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(meteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      CollectionName,
      'foreignKeyA'
    );
  });

  it('removed unknown foreignKey', () => {
    expect.assertions(5);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );

    expect(context.hasChildId('nonExistingSource')).toBeFalsy();
    expect(
      foreignKeyRegistry.isPrimaryForChildId(context.id, 'nonExistingSource')
    ).toBeFalsy();

    // test removal of unknown keys
    context.removed('nonExistingSource');
    expect(meteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('changes empty fields', () => {
    expect.assertions(2);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry }
    );

    context.addToRegistry('sourceId', ['fk']);
    context.changed('fk', {});
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    context.changed('fk', { not: 'empty' });
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(1);
  });

  it('skips publication', () => {
    expect.assertions(3);

    const foreignKeyRegistry = new ForeignKeyRegistry();
    const context = new PublicationContext(
      meteorPublicationMock,
      CollectionName,
      { foreignKeyRegistry, skipPublication: true }
    );

    context.addToRegistry('sourceId', ['foreignKeyA']);
    context.added('foreignKeyA', {});
    context.changed('foreignKeyA', { some: 'thing' });
    context.removeFromRegistry('sourceId');
    context.removed('foreignKeyA');

    expect(meteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(meteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });
});
