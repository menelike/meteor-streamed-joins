import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';

import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';

import ChangeStream from './ChangeStream';
import MongoObserver from './MongoObserver';
import type { MeteorObserverChanges } from './types';
import { MongoDoc } from './types';

const mongoDB = new MongoMemoryReplSet();

const DEFAULT_WAIT_IN_MS = 150;

// one thread can have multiple users
// a user can be related to many threads
const SOURCE_NAME = 'threads';
const DRAIN_NAME = 'users';

let mongoObserver: MongoObserver | undefined;

const firstThreadId = new ObjectID().toHexString();
const secondThreadId = new ObjectID().toHexString();

const userAId = new ObjectID().toHexString();
const userBId = new ObjectID().toHexString();
const userCId = new ObjectID().toHexString();
const userDId = new ObjectID().toHexString();

const threads = [
  {
    _id: firstThreadId,
    title: 'first',
    userIds: [userAId, userBId, userCId],
  },
  {
    _id: secondThreadId,
    name: 'second',
    userIds: [userAId, userDId],
  },
];
const users = [
  {
    _id: userAId,
    name: 'userA',
  },
  {
    _id: userBId,
    name: 'userB',
  },
  {
    _id: userCId,
    name: 'userC',
  },
  {
    _id: userDId,
    name: 'userD',
  },
];

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(SOURCE_NAME);
  await mongoDB.db().createCollection(DRAIN_NAME);
});

beforeEach(async () => {
  const sourceCollection = mongoDB.db().collection(SOURCE_NAME);
  const drainCollection = mongoDB.db().collection(DRAIN_NAME);

  await sourceCollection.insertMany(threads);
  await drainCollection.insertMany(users);
});

afterEach(async () => {
  if (mongoObserver) {
    mongoObserver.stop();
    mongoObserver = undefined;
  }
  const db = mongoDB.db();
  await db.collection(SOURCE_NAME).deleteMany({});
  await db.collection(DRAIN_NAME).deleteMany({});
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('MongoObserver', () => {
  it('handle added', () => {
    expect.assertions(4);

    let callback: MeteorObserverChanges | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserverChanges): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    const observeChangesCallback = {
      added: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      changed: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      removed: jest.fn(),
    };

    const watchObserveCallBack = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    mongoObserver = new MongoObserver();

    mongoObserver.observe(
      cursorMock,
      observeChangesCallback,
      watchObserveCallBack
    );
    if (!callback) throw Error('callback not set');

    expect(observeChangesCallback.added).toHaveBeenNthCalledWith(1, threads[0]);
    expect(watchObserveCallBack.added).toHaveBeenNthCalledWith(1, [
      userAId,
      userBId,
      userCId,
    ]);

    callback.added(threads[1]);
    expect(observeChangesCallback.added).toHaveBeenNthCalledWith(2, threads[1]);
    expect(watchObserveCallBack.added).toHaveBeenNthCalledWith(2, [userDId]);
  });

  it('handle added and removed', () => {
    expect.assertions(6);

    let callback: MeteorObserverChanges | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserverChanges): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    const observeChangesCallback = {
      added: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      changed: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      removed: jest.fn(),
    };

    const watchObserveCallBack = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    mongoObserver = new MongoObserver();

    mongoObserver.observe(
      cursorMock,
      observeChangesCallback,
      watchObserveCallBack
    );
    if (!callback) throw Error('callback not set');

    expect(observeChangesCallback.added).toHaveBeenNthCalledWith(1, threads[0]);
    expect(watchObserveCallBack.added).toHaveBeenNthCalledWith(1, [
      userAId,
      userBId,
      userCId,
    ]);

    callback.added(threads[1]);

    expect(observeChangesCallback.added).toHaveBeenNthCalledWith(2, threads[1]);
    expect(watchObserveCallBack.added).toHaveBeenNthCalledWith(2, [userDId]);

    callback.removed(threads[0]);
    expect(observeChangesCallback.removed).toHaveBeenNthCalledWith(
      1,
      threads[0]
    );
    expect(watchObserveCallBack.removed).toHaveBeenNthCalledWith(1, [
      userBId,
      userCId,
    ]);
  });

  it('handle added and changed', () => {
    expect.assertions(5);

    let callback: MeteorObserverChanges | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserverChanges): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    const observeChangesCallback = {
      added: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      changed: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      removed: jest.fn(),
    };

    const watchObserveCallBack = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    mongoObserver = new MongoObserver();

    mongoObserver.observe(
      cursorMock,
      observeChangesCallback,
      watchObserveCallBack
    );
    if (!callback) throw Error('callback not set');

    expect(observeChangesCallback.added).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining(threads[0])
    );
    expect(watchObserveCallBack.added).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([userAId, userBId, userCId])
    );

    // userBId removed, userDId added
    const changedFirstThread = { ...threads[0], userIds: [userAId, userDId] };

    callback.changed(changedFirstThread, threads[0]);

    expect(observeChangesCallback.changed).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining(changedFirstThread),
      expect.objectContaining(threads[0])
    );
    expect(watchObserveCallBack.added).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([userDId])
    );
    expect(watchObserveCallBack.removed).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([userBId])
    );
  });

  it('handle db changes in drain', async () => {
    expect.assertions(1);

    let callback: MeteorObserverChanges | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserverChanges): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    const observeChangesCallback = {
      added: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      changed: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      removed: jest.fn(),
    };

    const watchObserveCallBack = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    mongoObserver = new MongoObserver();

    mongoObserver.observe(
      cursorMock,
      observeChangesCallback,
      watchObserveCallBack
    );
    if (!callback) throw Error('callback not set');
    const drainCollection = mongoDB.db().collection(DRAIN_NAME);

    const changeStream = new ChangeStream(mongoObserver);
    changeStream.observe(drainCollection, watchObserveCallBack);

    await sleep(DEFAULT_WAIT_IN_MS);
    await drainCollection.updateOne(
      { _id: userAId },
      { $set: { name: 'changed' } }
    );
    await sleep(DEFAULT_WAIT_IN_MS);
    expect(watchObserveCallBack.changed).toHaveBeenNthCalledWith(
      1,
      userAId,
      { name: 'changed' },
      expect.anything()
    );
  });

  it('close handle', () => {
    expect.assertions(2);

    let callback: MeteorObserverChanges | undefined;
    const stopMock = jest.fn();
    const cursorMock = {
      observe: (cb: MeteorObserverChanges): Meteor.LiveQueryHandle => {
        callback = cb;
        // first run
        callback.added(threads[0]);
        return {
          stop: stopMock,
        };
      },
    } as Mongo.Cursor<MongoDoc>;

    const observeChangesCallback = {
      added: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      changed: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      removed: jest.fn(),
    };

    const watchObserveCallBack = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    mongoObserver = new MongoObserver();
    mongoObserver.stop();
    expect(stopMock).toHaveBeenCalledTimes(0);
    mongoObserver.observe(
      cursorMock,
      observeChangesCallback,
      watchObserveCallBack
    );
    if (!callback) throw Error('callback not set');
    mongoObserver.stop();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('add, change and remove on first run', () => {
    expect.assertions(6);

    let callback: MeteorObserverChanges | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserverChanges): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
        callback.changed({ ...threads[0], title: 'changed' }, threads[0]);
        callback.removed({ ...threads[0], title: 'changed' });
      },
    } as Mongo.Cursor<MongoDoc>;

    const observeChangesCallback = {
      added: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      changed: jest.fn().mockImplementation((doc) => {
        return doc.userIds;
      }),
      removed: jest.fn(),
    };

    const watchObserveCallBack = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    mongoObserver = new MongoObserver();
    mongoObserver.observe(
      cursorMock,
      observeChangesCallback,
      watchObserveCallBack
    );
    if (!callback) throw Error('callback not set');

    expect(observeChangesCallback.added).toHaveBeenNthCalledWith(1, threads[0]);
    expect(observeChangesCallback.changed).toHaveBeenNthCalledWith(
      1,
      { ...threads[0], title: 'changed' },
      threads[0]
    );
    expect(observeChangesCallback.removed).toHaveBeenNthCalledWith(1, {
      ...threads[0],
      title: 'changed',
    });
    expect(watchObserveCallBack.added).toHaveBeenCalledTimes(0);
    expect(watchObserveCallBack.changed).toHaveBeenCalledTimes(0);
    expect(watchObserveCallBack.removed).toHaveBeenCalledTimes(0);
  });
});
