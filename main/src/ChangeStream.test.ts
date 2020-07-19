// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';

import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';

import ChangeStream from './ChangeStream';
import ChangeStreamRegistry from './ChangeStreamRegistry';
import MongoObserver from './MongoObserver';
import { WatchObserveCallBacks } from './types';

const mongoDB = new MongoMemoryReplSet();

const COLLECTION_NAME = 'test';

const DEFAULT_WAIT_IN_MS = 250;

let changeStream: ChangeStream | undefined;

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(COLLECTION_NAME);
});

afterEach(async () => {
  if (changeStream) {
    changeStream.stop();
    changeStream = undefined;
  }
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME).deleteMany({});
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('ChangeStream', () => {
  it('fire on changed', async () => {
    expect.assertions(4);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      nested: {
        name: 'bar',
      },
      toRemove: 'deleteMe',
    };
    await collection.insertOne(document);

    const hasForeignKeyMock = jest.fn();
    const observer = ({
      foreignKeyRegistry: {
        hasForeignKey: hasForeignKeyMock,
      },
    } as unknown) as MongoObserver;
    changeStream = new ChangeStream(observer);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    changeStream.observe(collection, listener);

    await sleep(DEFAULT_WAIT_IN_MS);

    hasForeignKeyMock.mockReturnValueOnce(true);
    await collection.updateOne(
      { _id: document._id },
      {
        $set: { name: 'changedFoo', nested: { name: 'changedBar' } },
        $unset: { toRemove: '' },
      }
    );

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(1);
    expect(listener.changed.mock.calls[0][0]).toBe(document._id);
    expect(listener.changed.mock.calls[0][1]).toEqual({
      name: 'changedFoo',
      nested: {
        name: 'changedBar',
      },
      toRemove: undefined,
    });

    changeStream.stop();

    await sleep(DEFAULT_WAIT_IN_MS);

    hasForeignKeyMock.mockReturnValueOnce(true);
    await collection.updateOne(
      { _id: document._id },
      {
        $set: { name: 'something' },
      }
    );

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(1);
  });

  it('pass field projection', async () => {
    expect.assertions(3);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
      nested: {
        name: 'bar',
      },
      toRemove: 'deleteMe',
    };
    await collection.insertOne(document);

    const hasForeignKeyMock = jest.fn();
    const observer = ({
      foreignKeyRegistry: {
        hasForeignKey: hasForeignKeyMock,
      },
    } as unknown) as MongoObserver;
    changeStream = new ChangeStream(observer);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    changeStream.observe(collection, listener, {
      fields: {
        nested: 1,
        toRemove: 1,
      },
    });

    await sleep(DEFAULT_WAIT_IN_MS);

    hasForeignKeyMock.mockReturnValueOnce(true);
    await collection.updateOne(
      { _id: document._id },
      {
        $set: { name: 'changedFoo', nested: { name: 'changedBar' } },
        $unset: { toRemove: '' },
      }
    );

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(1);
    expect(listener.changed.mock.calls[0][0]).toBe(document._id);
    expect(listener.changed.mock.calls[0][1]).toEqual({
      nested: {
        name: 'changedBar',
      },
      toRemove: undefined,
    });
  });

  it('do not call observer with empty object', async () => {
    expect.assertions(1);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
    };
    await collection.insertOne(document);

    const hasForeignKeyMock = jest.fn();
    const observer = ({
      foreignKeyRegistry: {
        hasForeignKey: hasForeignKeyMock,
      },
    } as unknown) as MongoObserver;
    changeStream = new ChangeStream(observer);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    changeStream.observe(collection, listener, {
      fields: {
        doesNotExist: 1,
      },
    });

    await sleep(DEFAULT_WAIT_IN_MS);

    hasForeignKeyMock.mockReturnValueOnce(true);
    await collection.updateOne(
      { _id: document._id },
      {
        $set: { name: 'changedFoo' },
      }
    );

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(0);
  });

  it('do not call observer if foreign key is unknown', async () => {
    expect.assertions(1);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const document = {
      _id: new ObjectID().toHexString(),
      name: 'foo',
    };
    await collection.insertOne(document);

    const hasForeignKeyMock = jest.fn();
    const observer = ({
      foreignKeyRegistry: {
        hasForeignKey: hasForeignKeyMock,
      },
    } as unknown) as MongoObserver;
    changeStream = new ChangeStream(observer);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    changeStream.observe(collection, listener, {
      fields: {
        doesNotExist: 1,
      },
    });

    await sleep(DEFAULT_WAIT_IN_MS);

    hasForeignKeyMock.mockReturnValueOnce(false);
    await collection.updateOne(
      { _id: document._id },
      {
        $set: { name: 'changedFoo' },
      }
    );

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(listener.changed.mock.calls.length).toBe(0);
  });

  it('call stop', () => {
    expect.assertions(2);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const hasForeignKeyMock = jest.fn();
    const observer = ({
      foreignKeyRegistry: {
        hasForeignKey: hasForeignKeyMock,
      },
    } as unknown) as MongoObserver;
    changeStream = new ChangeStream(observer);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    expect(changeStream.stop()).toBeFalsy();

    changeStream.observe(collection, listener);

    expect(changeStream.stop()).toBeTruthy();
  });

  it('throw on added or removed', () => {
    expect.assertions(2);

    let callback: WatchObserveCallBacks | undefined;
    jest
      .spyOn(ChangeStreamRegistry, 'addListener')
      .mockImplementation((col, cb) => {
        callback = cb;
        return jest.fn();
      });

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const hasForeignKeyMock = jest.fn();
    const observer = ({
      foreignKeyRegistry: {
        hasForeignKey: hasForeignKeyMock,
      },
    } as unknown) as MongoObserver;
    changeStream = new ChangeStream(observer);
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    changeStream.observe(collection, listener);
    try {
      // eslint-disable-next-line no-unused-expressions
      callback?.added([]);
    } catch (err) {
      expect(err.toString()).toBe('Error: not supported');
    }

    try {
      // eslint-disable-next-line no-unused-expressions
      callback?.removed([]);
    } catch (err) {
      expect(err.toString()).toBe('Error: not supported');
    }
  });
});
