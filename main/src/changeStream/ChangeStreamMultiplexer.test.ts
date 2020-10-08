/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Collection } from 'mongodb';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';

import MongoMemoryReplSet from '../../tests/MongoMemoryReplSet';
import sleep from '../../tests/sleep';
import { waitUntilHaveBeenCalledTimes } from '../../tests/waitUntil';

import ChangeStreamMultiplexer from './ChangeStreamMultiplexer';

const mongoDB = new MongoMemoryReplSet();

const COLLECTION_NAME = 'test';

const DEFAULT_WAIT_IN_MS = 250;

let multiplexer: ChangeStreamMultiplexer | undefined;

let TestCollection: Collection<any>;

const listenerMock = {
  added: jest.fn(),
  changed: jest.fn(),
  replaced: jest.fn(),
  removed: jest.fn(),
};

beforeAll(async () => {
  await mongoDB.connect();
  TestCollection = await mongoDB.db().createCollection(COLLECTION_NAME);
});

afterEach(async () => {
  if (multiplexer) {
    await multiplexer._stop();
    multiplexer = undefined;
  }
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME).deleteMany({});

  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('ChangeStreamMultiplexer', () => {
  it('starts and stops when needed/not needed', async () => {
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

    expect(multiplexer.isWatching()).toBeFalsy();

    multiplexer.addListener(listenerMock);
    expect(multiplexer.isWatching()).toBeTruthy();

    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenNthCalledWith(1, 'change', expect.any(Function));

    await multiplexer.removeListener(listenerMock);

    expect(multiplexer.isWatching()).toBeFalsy();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('starts watching for changes without listeners', async () => {
    expect.assertions(5);

    multiplexer = new ChangeStreamMultiplexer(TestCollection, {
      keepRunning: true,
    });
    expect(multiplexer.isWatching()).toBeTruthy();
    await sleep(DEFAULT_WAIT_IN_MS);

    multiplexer.addListener(listenerMock);

    await TestCollection.insertOne({
      _id: new ObjectID().toHexString(),
    });
    await waitUntilHaveBeenCalledTimes(listenerMock.added, 1);
    expect(listenerMock.added).toHaveBeenCalledTimes(1);

    await multiplexer._stop();

    multiplexer = new ChangeStreamMultiplexer(TestCollection, {
      keepRunning: false,
    });
    expect(multiplexer.isWatching()).toBeFalsy();
    multiplexer.addListener(listenerMock);

    await TestCollection.insertOne({
      _id: new ObjectID().toHexString(),
    });
    // since we did not wait/slept after adding the listener
    // the inserted document has not called any listener
    await waitUntilHaveBeenCalledTimes(listenerMock.added, 2);
    expect(listenerMock.added).toHaveBeenCalledTimes(1);

    await TestCollection.insertOne({
      _id: new ObjectID().toHexString(),
    });
    await waitUntilHaveBeenCalledTimes(listenerMock.added, 2);
    expect(listenerMock.added).toHaveBeenCalledTimes(2);
  });

  it('fire on insert', async () => {
    expect.assertions(2);

    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      nested: {
        bar: 'test',
      },
    };
    multiplexer = new ChangeStreamMultiplexer(TestCollection);

    multiplexer.addListener(listenerMock);

    await sleep(DEFAULT_WAIT_IN_MS);

    await TestCollection.insertOne(document);

    await waitUntilHaveBeenCalledTimes(listenerMock.added, 1);

    expect(listenerMock.added).toHaveBeenCalledTimes(1);
    expect(listenerMock.added).toHaveBeenNthCalledWith(
      1,
      document._id,
      document,
      expect.objectContaining({
        operationType: 'insert',
        ns: { db: 'undefined', coll: 'test' },
        documentKey: { _id: document._id },
        fullDocument: document,
      })
    );
  });

  it('fire on update', async () => {
    expect.assertions(2);

    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      nested: {
        bar: 'test',
      },
    };
    await TestCollection.insertOne(document);
    multiplexer = new ChangeStreamMultiplexer(TestCollection);

    multiplexer.addListener(listenerMock);

    await sleep(DEFAULT_WAIT_IN_MS);

    await TestCollection.updateOne(
      { _id: document._id },
      { $set: { name: 'changedFoo', 'nested.bar': 'changedTest' } }
    );

    await waitUntilHaveBeenCalledTimes(listenerMock.changed, 1);

    expect(listenerMock.changed).toHaveBeenCalledTimes(1);
    expect(listenerMock.changed).toHaveBeenNthCalledWith(
      1,
      document._id,
      {
        name: 'changedFoo',
        nested: {
          bar: 'changedTest',
        },
      },
      {
        _id: document._id,
        name: 'changedFoo',
        nested: {
          bar: 'changedTest',
        },
      },
      expect.objectContaining({
        operationType: 'update',
        ns: { db: 'undefined', coll: 'test' },
        documentKey: { _id: document._id },
        updateDescription: {
          updatedFields: { name: 'changedFoo', 'nested.bar': 'changedTest' },
          removedFields: [],
        },
        fullDocument: {
          _id: document._id,
          name: 'changedFoo',
          nested: {
            bar: 'changedTest',
          },
        },
      })
    );
  });

  it('fire on replace', async () => {
    expect.assertions(2);

    const document = { _id: new ObjectID().toHexString(), name: 'foo' };
    await TestCollection.insertOne(document);
    multiplexer = new ChangeStreamMultiplexer(TestCollection);

    multiplexer.addListener(listenerMock);

    await sleep(DEFAULT_WAIT_IN_MS);

    await TestCollection.replaceOne(
      { _id: document._id },
      { name: 'changedFoo', nested: { bar: 'changed' } }
    );

    await waitUntilHaveBeenCalledTimes(listenerMock.replaced, 1);

    expect(listenerMock.replaced).toHaveBeenCalledTimes(1);
    expect(listenerMock.replaced).toHaveBeenNthCalledWith(
      1,
      document._id,
      {
        _id: document._id,
        name: 'changedFoo',
        nested: { bar: 'changed' },
      },
      expect.objectContaining({
        operationType: 'replace',
        ns: { db: 'undefined', coll: 'test' },
        documentKey: { _id: document._id },
        fullDocument: {
          _id: document._id,
          name: 'changedFoo',
          nested: { bar: 'changed' },
        },
      })
    );
  });

  it('fire on remove', async () => {
    expect.assertions(2);

    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      nested: {
        bar: 'test',
      },
    };
    await TestCollection.insertOne(document);

    multiplexer = new ChangeStreamMultiplexer(TestCollection);

    multiplexer.addListener(listenerMock);

    await sleep(DEFAULT_WAIT_IN_MS);

    await TestCollection.deleteOne({ _id: document._id });

    await waitUntilHaveBeenCalledTimes(listenerMock.removed, 1);

    expect(listenerMock.removed).toHaveBeenCalledTimes(1);
    expect(listenerMock.removed).toHaveBeenNthCalledWith(
      1,
      document._id,
      expect.objectContaining({
        operationType: 'delete',
        ns: { db: 'undefined', coll: 'test' },
        documentKey: { _id: document._id },
      })
    );
  });

  it('merge removed fields on update', async () => {
    expect.assertions(2);

    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      toRemove: 'deleteMe',
      nested: {
        bar: 'test',
      },
    };
    await TestCollection.insertOne(document);
    multiplexer = new ChangeStreamMultiplexer(TestCollection);

    multiplexer.addListener(listenerMock);

    await sleep(DEFAULT_WAIT_IN_MS);

    await TestCollection.updateOne(
      { _id: document._id },
      { $set: { name: 'changedFoo' }, $unset: { toRemove: '' } }
    );

    await waitUntilHaveBeenCalledTimes(listenerMock.changed, 1);

    expect(listenerMock.changed).toHaveBeenCalledTimes(1);
    expect(listenerMock.changed).toHaveBeenNthCalledWith(
      1,
      document._id,
      {
        name: 'changedFoo',
        toRemove: undefined,
      },
      {
        _id: document._id,
        name: 'changedFoo',
        nested: {
          bar: 'test',
        },
      },
      expect.objectContaining({
        operationType: 'update',
        ns: { db: 'undefined', coll: 'test' },
        documentKey: { _id: document._id },
        updateDescription: {
          updatedFields: { name: 'changedFoo' },
          removedFields: ['toRemove'],
        },
        fullDocument: {
          _id: document._id,
          name: 'changedFoo',
          nested: {
            bar: 'test',
          },
        },
      })
    );
  });

  it('merge removed fields on replace', async () => {
    expect.assertions(2);

    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      toRemove: 'deleteMe',
    };
    await TestCollection.insertOne(document);
    multiplexer = new ChangeStreamMultiplexer(TestCollection);

    multiplexer.addListener(listenerMock);

    await sleep(DEFAULT_WAIT_IN_MS);

    await TestCollection.replaceOne(
      { _id: document._id },
      { name: 'changedFoo' }
    );

    await waitUntilHaveBeenCalledTimes(listenerMock.replaced, 1);

    expect(listenerMock.replaced).toHaveBeenCalledTimes(1);
    expect(listenerMock.replaced).toHaveBeenNthCalledWith(
      1,
      document._id,
      {
        _id: document._id,
        name: 'changedFoo',
      },
      expect.objectContaining({
        operationType: 'replace',
        ns: { db: 'undefined', coll: 'test' },
        documentKey: { _id: document._id },
        fullDocument: {
          _id: document._id,
          name: 'changedFoo',
        },
      })
    );
  });

  it('ignore unknown operation', async () => {
    expect.assertions(4);

    multiplexer = new ChangeStreamMultiplexer(TestCollection);
    multiplexer.addListener(listenerMock);

    await sleep(DEFAULT_WAIT_IN_MS);

    // @ts-ignore
    multiplexer.onChange({
      // @ts-ignore
      operationType: 'unknown',
      documentKey: {
        _id: new ObjectID().toHexString(),
      },
    });

    expect(listenerMock.added).toHaveBeenCalledTimes(0);
    expect(listenerMock.changed).toHaveBeenCalledTimes(0);
    expect(listenerMock.replaced).toHaveBeenCalledTimes(0);
    expect(listenerMock.removed).toHaveBeenCalledTimes(0);
  });

  it('receives undefined fullDocument on replace', async () => {
    expect.assertions(5);

    multiplexer = new ChangeStreamMultiplexer(TestCollection);
    multiplexer.addListener(listenerMock);

    await sleep(DEFAULT_WAIT_IN_MS);

    const _id = new ObjectID().toHexString();

    expect(() => {
      // @ts-ignore
      multiplexer.onChange({
        // @ts-ignore
        operationType: 'replace',
        documentKey: {
          _id,
        },
        // @ts-ignore
        fullDocument: undefined,
      });
    }).toThrowError('received replace OP without a full document');
    expect(listenerMock.added).toHaveBeenCalledTimes(0);
    expect(listenerMock.changed).toHaveBeenCalledTimes(0);
    expect(listenerMock.replaced).toHaveBeenCalledTimes(0);
    expect(listenerMock.removed).toHaveBeenCalledTimes(0);
  });
});
