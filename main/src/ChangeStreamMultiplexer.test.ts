import type { Collection } from 'mongodb';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';

import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';

import ChangeStreamMultiplexer from './ChangeStreamMultiplexer';

const mongoDB = new MongoMemoryReplSet();

const COLLECTION_NAME = 'test';

const DEFAULT_WAIT_IN_MS = 250;

let multiplexer: ChangeStreamMultiplexer | undefined;

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(COLLECTION_NAME);
});

afterEach(async () => {
  if (multiplexer) {
    multiplexer._stop();
    multiplexer = undefined;
  }
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME).deleteMany({});
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('ChangeStreamMultiplexer', () => {
  it('starts and stops when needed/not needed', () => {
    expect.assertions(6);

    const onMock = jest.fn();
    const closeMock = jest.fn();
    const watchMock = jest.fn().mockImplementation(() => ({
      on: onMock,
      close: closeMock,
    }));
    const collection = ({
      watch: watchMock,
    } as unknown) as Collection;

    multiplexer = new ChangeStreamMultiplexer(collection);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    expect(multiplexer.isWatching()).toBeFalsy();

    multiplexer.addListener(listener);
    expect(multiplexer.isWatching()).toBeTruthy();

    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenNthCalledWith(1, 'change', expect.any(Function));

    multiplexer.removeListener(listener);

    expect(multiplexer.isWatching()).toBeFalsy();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('fire on update', async () => {
    expect.assertions(5);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      nested: {
        bar: 'test',
      },
    };
    await collection.insertOne(document);
    multiplexer = new ChangeStreamMultiplexer(collection);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    multiplexer.addListener(listener);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.updateOne(
      { _id: document._id },
      { $set: { name: 'changedFoo', 'nested.bar': 'changedTest' } }
    );

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(1);
    expect(listener.changed.mock.calls[0][0]).toBe(document._id);
    expect(listener.changed.mock.calls[0][1]).toEqual({
      name: 'changedFoo',
      'nested.bar': 'changedTest',
    });
    expect(listener.changed.mock.calls[0][2]).toBeFalsy();
    expect(listener.changed.mock.calls[0][3]).toMatchObject({
      operationType: 'update',
      ns: { db: 'undefined', coll: 'test' },
      documentKey: { _id: document._id },
      updateDescription: {
        updatedFields: { name: 'changedFoo', 'nested.bar': 'changedTest' },
        removedFields: [],
      },
      meteor: { fields: { name: 'changedFoo', 'nested.bar': 'changedTest' } },
    });
  });

  it('fire on replace', async () => {
    expect.assertions(5);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const document = { _id: new ObjectID().toHexString(), name: 'foo' };
    await collection.insertOne(document);
    multiplexer = new ChangeStreamMultiplexer(collection);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    multiplexer.addListener(listener);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.replaceOne(
      { _id: document._id },
      { name: 'changedFoo', nested: { bar: 'changed' } }
    );

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(1);
    expect(listener.changed.mock.calls[0][0]).toBe(document._id);
    expect(listener.changed.mock.calls[0][1]).toEqual({
      name: 'changedFoo',
      nested: { bar: 'changed' },
    });
    expect(listener.changed.mock.calls[0][2]).toBeTruthy();
    expect(listener.changed.mock.calls[0][3]).toMatchObject({
      operationType: 'replace',
      ns: { db: 'undefined', coll: 'test' },
      documentKey: { _id: document._id },
      fullDocument: {
        _id: document._id,
        name: 'changedFoo',
        nested: { bar: 'changed' },
      },
      meteor: { fields: { name: 'changedFoo', nested: { bar: 'changed' } } },
    });
  });

  it('merge removed fields on update', async () => {
    expect.assertions(5);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      toRemove: 'deleteMe',
      nested: {
        bar: 'test',
      },
    };
    await collection.insertOne(document);
    multiplexer = new ChangeStreamMultiplexer(collection);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    multiplexer.addListener(listener);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.updateOne(
      { _id: document._id },
      { $set: { name: 'changedFoo' }, $unset: { toRemove: '' } }
    );

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(1);
    expect(listener.changed.mock.calls[0][0]).toBe(document._id);
    expect(listener.changed.mock.calls[0][1]).toEqual({
      name: 'changedFoo',
      toRemove: undefined,
    });
    expect(listener.changed.mock.calls[0][2]).toBeFalsy();
    expect(listener.changed.mock.calls[0][3]).toMatchObject({
      operationType: 'update',
      ns: { db: 'undefined', coll: 'test' },
      documentKey: { _id: document._id },
      updateDescription: {
        updatedFields: { name: 'changedFoo' },
        removedFields: ['toRemove'],
      },
      meteor: { fields: { name: 'changedFoo', toRemove: undefined } },
    });
  });

  it('merge removed fields on replace', async () => {
    expect.assertions(8);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      toRemove: 'deleteMe',
    };
    await collection.insertOne(document);
    multiplexer = new ChangeStreamMultiplexer(collection);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    multiplexer.addListener(listener);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.replaceOne({ _id: document._id }, { name: 'changedFoo' });

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(1);
    expect(listener.changed.mock.calls[0][0]).toBe(document._id);
    // Todo no diff received on replace, hence toRemove not determined and missing
    expect(listener.changed.mock.calls[0][1]).toEqual({
      name: 'changedFoo',
    });
    expect(listener.changed.mock.calls.length).toBe(1);
    expect(listener.changed.mock.calls[0][0]).toBe(document._id);
    expect(listener.changed.mock.calls[0][1]).toEqual({ name: 'changedFoo' });
    expect(listener.changed.mock.calls[0][2]).toBeTruthy();
    // Todo no diff received on replace
    //  hence meteor.fields.toRemove not determined and missing
    expect(listener.changed.mock.calls[0][3]).toMatchObject({
      operationType: 'replace',
      ns: { db: 'undefined', coll: 'test' },
      documentKey: { _id: document._id },
      fullDocument: { _id: document._id, name: 'changedFoo' },
      meteor: { fields: { name: 'changedFoo' } },
    });
  });
});
