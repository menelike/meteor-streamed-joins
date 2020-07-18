import type { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';

import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';

import ChangeStream from './ChangeStream';
import MongoObserver from './MongoObserver';
import type {
  MeteorObserveCallbacks,
  MeteorObserveChangesCallbacks,
  WatchObserveCallBacks,
} from './types';
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

const observeCallbacks = {
  added: jest.fn().mockImplementation((doc) => {
    return doc.userIds;
  }),
  changed: jest.fn().mockImplementation((doc) => {
    return doc.userIds;
  }),
  removed: jest.fn(),
};

const observeChangesCallbacks: MeteorObserveChangesCallbacks = {
  added: jest.fn().mockImplementation((id, fields) => {
    return fields.userIds || [];
  }),
  changed: jest.fn().mockImplementation((id, fields) => {
    return fields.userIds || [];
  }),
  removed: jest.fn(),
};

const observeChangesMock: MeteorObserveChangesCallbacks = {
  added: jest.fn(),
  changed: jest.fn(),
  removed: jest.fn(),
};

const observeMock: MeteorObserveCallbacks = {
  added: jest.fn(),
  changed: jest.fn(),
  removed: jest.fn(),
};

const watchObserveCallBacks: WatchObserveCallBacks = {
  added: jest.fn(),
  changed: jest.fn(),
  removed: jest.fn(),
};

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(SOURCE_NAME);
  await mongoDB.db().createCollection(DRAIN_NAME);
});

beforeEach(async () => {
  jest.clearAllMocks();

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
  it('handle added on observe()', () => {
    expect.assertions(4);

    let callback: MeteorObserveCallbacks | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserveCallbacks): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();

    mongoObserver.observe(cursorMock, observeCallbacks, watchObserveCallBacks);
    if (!callback) throw Error('callback not set');

    expect(observeCallbacks.added).toHaveBeenNthCalledWith(1, threads[0]);
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(1, [
      userAId,
      userBId,
      userCId,
    ]);

    callback.added(threads[1]);
    expect(observeCallbacks.added).toHaveBeenNthCalledWith(2, threads[1]);
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(2, [userDId]);
  });

  it('handle added on observeChanges()', () => {
    expect.assertions(4);

    let callback: MeteorObserveChangesCallbacks | undefined;
    const cursorMock = {
      observeChanges: (cb: MeteorObserveChangesCallbacks): void => {
        callback = cb;
        // first run
        callback.added(firstThreadId, {
          title: threads[0].title,
          userIds: threads[0].userIds,
        });
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();

    mongoObserver.observeChanges(
      cursorMock,
      observeChangesCallbacks,
      watchObserveCallBacks
    );
    if (!callback) throw Error('callback not set');

    expect(observeChangesCallbacks.added).toHaveBeenNthCalledWith(
      1,
      firstThreadId,
      {
        title: threads[0].title,
        userIds: threads[0].userIds,
      }
    );
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(1, [
      userAId,
      userBId,
      userCId,
    ]);

    callback.added(secondThreadId, {
      title: threads[1].title,
      userIds: threads[1].userIds,
    });
    expect(observeChangesCallbacks.added).toHaveBeenNthCalledWith(
      2,
      secondThreadId,
      {
        title: threads[1].title,
        userIds: threads[1].userIds,
      }
    );
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(2, [userDId]);
  });

  it('handle added and removed on observe()', () => {
    expect.assertions(6);

    let callback: MeteorObserveCallbacks | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserveCallbacks): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();

    mongoObserver.observe(cursorMock, observeCallbacks, watchObserveCallBacks);
    if (!callback) throw Error('callback not set');

    expect(observeCallbacks.added).toHaveBeenNthCalledWith(1, threads[0]);
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(1, [
      userAId,
      userBId,
      userCId,
    ]);

    callback.added(threads[1]);

    expect(observeCallbacks.added).toHaveBeenNthCalledWith(2, threads[1]);
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(2, [userDId]);

    callback.removed(threads[0]);
    expect(observeCallbacks.removed).toHaveBeenNthCalledWith(1, threads[0]);
    expect(watchObserveCallBacks.removed).toHaveBeenNthCalledWith(1, [
      userBId,
      userCId,
    ]);
  });

  it('handle added and removed on observeChanges()', () => {
    expect.assertions(6);

    let callback: MeteorObserveChangesCallbacks | undefined;
    const cursorMock = {
      observeChanges: (cb: MeteorObserveChangesCallbacks): void => {
        callback = cb;
        // first run
        callback.added(firstThreadId, {
          title: threads[0].title,
          userIds: threads[0].userIds,
        });
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();

    mongoObserver.observeChanges(
      cursorMock,
      observeChangesCallbacks,
      watchObserveCallBacks
    );
    if (!callback) throw Error('callback not set');

    expect(observeChangesCallbacks.added).toHaveBeenNthCalledWith(
      1,
      firstThreadId,
      {
        title: threads[0].title,
        userIds: threads[0].userIds,
      }
    );
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(1, [
      userAId,
      userBId,
      userCId,
    ]);

    callback.added(secondThreadId, {
      title: threads[1].title,
      userIds: threads[1].userIds,
    });

    expect(observeChangesCallbacks.added).toHaveBeenNthCalledWith(
      2,
      secondThreadId,
      {
        title: threads[1].title,
        userIds: threads[1].userIds,
      }
    );
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(2, [userDId]);

    callback.removed(firstThreadId);
    expect(observeChangesCallbacks.removed).toHaveBeenNthCalledWith(
      1,
      firstThreadId
    );
    expect(watchObserveCallBacks.removed).toHaveBeenNthCalledWith(1, [
      userBId,
      userCId,
    ]);
  });

  it('handle added and changed on observe()', () => {
    expect.assertions(5);

    let callback: MeteorObserveCallbacks | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserveCallbacks): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();

    mongoObserver.observe(cursorMock, observeCallbacks, watchObserveCallBacks);
    if (!callback) throw Error('callback not set');

    expect(observeCallbacks.added).toHaveBeenNthCalledWith(1, threads[0]);
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(1, [
      userAId,
      userBId,
      userCId,
    ]);

    // userBId removed, userDId added
    const changedFirstThread = {
      ...threads[0],
      userIds: [userAId, userCId, userDId],
    };

    callback.changed(changedFirstThread, threads[0]);

    expect(observeCallbacks.changed).toHaveBeenNthCalledWith(
      1,
      changedFirstThread,
      threads[0]
    );
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(2, [userDId]);
    expect(watchObserveCallBacks.removed).toHaveBeenNthCalledWith(1, [userBId]);
  });

  it('handle added and changed on observeChanges()', () => {
    expect.assertions(5);

    let callback: MeteorObserveChangesCallbacks | undefined;
    const cursorMock = {
      observeChanges: (cb: MeteorObserveChangesCallbacks): void => {
        callback = cb;
        // first run
        callback.added(firstThreadId, {
          title: threads[0].title,
          userIds: threads[0].userIds,
        });
      },
    } as Mongo.Cursor<MongoDoc>;

    const observeChangesCallback: MeteorObserveChangesCallbacks = {
      added: jest.fn().mockImplementation((id, fields) => {
        return fields.userIds || [];
      }),
      changed: jest.fn().mockImplementation((id, fields) => {
        return fields.userIds || [];
      }),
      removed: jest.fn(),
    };

    mongoObserver = new MongoObserver();

    mongoObserver.observeChanges(
      cursorMock,
      observeChangesCallback,
      watchObserveCallBacks
    );
    if (!callback) throw Error('callback not set');

    expect(observeChangesCallback.added).toHaveBeenNthCalledWith(
      1,
      firstThreadId,
      { title: threads[0].title, userIds: threads[0].userIds }
    );
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(1, [
      userAId,
      userBId,
      userCId,
    ]);

    // userBId removed, userDId added
    callback.changed(firstThreadId, { userIds: [userAId, userCId, userDId] });

    expect(observeChangesCallback.changed).toHaveBeenNthCalledWith(
      1,
      firstThreadId,
      { userIds: [userAId, userCId, userDId] }
    );
    expect(watchObserveCallBacks.added).toHaveBeenNthCalledWith(2, [userDId]);
    expect(watchObserveCallBacks.removed).toHaveBeenNthCalledWith(1, [userBId]);
  });

  it('handle db changes in drain on observe()', async () => {
    expect.assertions(1);

    let callback: MeteorObserveCallbacks | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserveCallbacks): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();

    mongoObserver.observe(cursorMock, observeCallbacks, watchObserveCallBacks);
    if (!callback) throw Error('callback not set');
    const drainCollection = mongoDB.db().collection(DRAIN_NAME);

    const changeStream = new ChangeStream(mongoObserver);
    changeStream.observe(drainCollection, watchObserveCallBacks);

    await sleep(DEFAULT_WAIT_IN_MS);
    await drainCollection.updateOne(
      { _id: userAId },
      { $set: { name: 'changed' } }
    );
    await sleep(DEFAULT_WAIT_IN_MS);
    expect(watchObserveCallBacks.changed).toHaveBeenNthCalledWith(
      1,
      userAId,
      { name: 'changed' },
      false,
      expect.anything()
    );
  });

  it('handle db changes in drain on observeChanges()', async () => {
    expect.assertions(1);

    let callback: MeteorObserveChangesCallbacks | undefined;
    const cursorMock = {
      observeChanges: (cb: MeteorObserveChangesCallbacks): void => {
        callback = cb;
        // first run
        callback.added(firstThreadId, threads[0]);
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();

    mongoObserver.observeChanges(
      cursorMock,
      observeChangesCallbacks,
      watchObserveCallBacks
    );
    if (!callback) throw Error('callback not set');
    const drainCollection = mongoDB.db().collection(DRAIN_NAME);

    const changeStream = new ChangeStream(mongoObserver);
    changeStream.observe(drainCollection, watchObserveCallBacks);

    await sleep(DEFAULT_WAIT_IN_MS);
    await drainCollection.updateOne(
      { _id: userAId },
      { $set: { name: 'changed' } }
    );
    await sleep(DEFAULT_WAIT_IN_MS);
    expect(watchObserveCallBacks.changed).toHaveBeenNthCalledWith(
      1,
      userAId,
      { name: 'changed' },
      false,
      expect.anything()
    );
  });

  it('close handle', () => {
    expect.assertions(2);

    let callback: MeteorObserveCallbacks | undefined;
    const stopMock = jest.fn();
    const cursorMock = {
      observe: (cb: MeteorObserveCallbacks): Meteor.LiveQueryHandle => {
        callback = cb;
        // first run
        callback.added(threads[0]);
        return {
          stop: stopMock,
        };
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();
    mongoObserver.stop();
    expect(stopMock).toHaveBeenCalledTimes(0);
    mongoObserver.observe(cursorMock, observeCallbacks, watchObserveCallBacks);
    if (!callback) throw Error('callback not set');
    mongoObserver.stop();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('add, change and remove on first observe() run', () => {
    expect.assertions(6);

    let callback: MeteorObserveCallbacks | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserveCallbacks): void => {
        callback = cb;
        // first run
        callback.added(threads[0]);
        callback.changed({ ...threads[0], title: 'changed' }, threads[0]);
        callback.removed({ ...threads[0], title: 'changed' });
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();
    mongoObserver.observe(cursorMock, observeCallbacks, watchObserveCallBacks);
    if (!callback) throw Error('callback not set');

    expect(observeCallbacks.added).toHaveBeenNthCalledWith(1, threads[0]);
    expect(observeCallbacks.changed).toHaveBeenNthCalledWith(
      1,
      { ...threads[0], title: 'changed' },
      threads[0]
    );
    expect(observeCallbacks.removed).toHaveBeenNthCalledWith(1, {
      ...threads[0],
      title: 'changed',
    });
    expect(watchObserveCallBacks.added).toHaveBeenCalledTimes(0);
    expect(watchObserveCallBacks.changed).toHaveBeenCalledTimes(0);
    expect(watchObserveCallBacks.removed).toHaveBeenCalledTimes(0);
  });

  it('add, change and remove on first observeChanges() run', () => {
    expect.assertions(6);

    let callback: MeteorObserveChangesCallbacks | undefined;
    const cursorMock = {
      observeChanges: (cb: MeteorObserveChangesCallbacks): void => {
        callback = cb;
        // first run
        callback.added(firstThreadId, {
          title: threads[0].title,
          userIds: threads[0].userIds,
        });
        callback.changed(firstThreadId, { title: 'changed' });
        callback.removed(firstThreadId);
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();
    mongoObserver.observeChanges(
      cursorMock,
      observeChangesCallbacks,
      watchObserveCallBacks
    );
    if (!callback) throw Error('callback not set');

    expect(observeChangesCallbacks.added).toHaveBeenNthCalledWith(
      1,
      firstThreadId,
      { title: threads[0].title, userIds: threads[0].userIds }
    );
    expect(observeChangesCallbacks.changed).toHaveBeenNthCalledWith(
      1,
      firstThreadId,
      { title: 'changed' }
    );
    expect(observeChangesCallbacks.removed).toHaveBeenNthCalledWith(
      1,
      firstThreadId
    );
    expect(watchObserveCallBacks.added).toHaveBeenCalledTimes(0);
    expect(watchObserveCallBacks.changed).toHaveBeenCalledTimes(0);
    expect(watchObserveCallBacks.removed).toHaveBeenCalledTimes(0);
  });

  it('prevent registering twice', () => {
    expect.assertions(4);

    const cursorMock = {
      // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
      observe: (cb: MeteorObserveCallbacks): Meteor.LiveQueryHandle => {
        return {
          stop: jest.fn(),
        };
      },
      observeChanges: (
        // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
        cb: MeteorObserveChangesCallbacks
      ): Meteor.LiveQueryHandle => {
        return {
          stop: jest.fn(),
        };
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();
    mongoObserver.observe(cursorMock, observeCallbacks, watchObserveCallBacks);

    expect(() => {
      if (!mongoObserver) throw Error('mongoObserver not set');
      mongoObserver.observe(
        cursorMock,
        observeCallbacks,
        watchObserveCallBacks
      );
    }).toThrowError('observer already registered');

    expect(() => {
      if (!mongoObserver) throw Error('mongoObserver not set');
      mongoObserver.observeChanges(
        cursorMock,
        observeChangesCallbacks,
        watchObserveCallBacks
      );
    }).toThrowError('observer already registered');

    mongoObserver.stop();

    mongoObserver.observeChanges(
      cursorMock,
      observeChangesCallbacks,
      watchObserveCallBacks
    );

    expect(() => {
      if (!mongoObserver) throw Error('mongoObserver not set');
      mongoObserver.observeChanges(
        cursorMock,
        observeChangesCallbacks,
        watchObserveCallBacks
      );
    }).toThrowError('observer already registered');

    expect(() => {
      if (!mongoObserver) throw Error('mongoObserver not set');
      mongoObserver.observe(
        cursorMock,
        observeCallbacks,
        watchObserveCallBacks
      );
    }).toThrowError('observer already registered');

    mongoObserver.stop();
  });

  it('do not call registry on undefined foreign keys on observe()', () => {
    expect.assertions(3);

    let callback: MeteorObserveCallbacks | undefined;
    const cursorMock = {
      observe: (cb: MeteorObserveCallbacks): void => {
        callback = cb;
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();
    mongoObserver.foreignKeyRegistry.add = jest.fn();
    mongoObserver.foreignKeyRegistry.replace = jest.fn();
    mongoObserver.foreignKeyRegistry.remove = jest.fn();

    mongoObserver.observe(cursorMock, observeMock, watchObserveCallBacks);
    if (!callback) throw Error('callback not set');

    callback.added({ _id: 'testId', foo: 'bar' });
    callback.changed(
      { _id: 'testId', foo: 'changed' },
      { _id: 'testId', foo: 'bar' }
    );
    callback.removed({ _id: 'testId', foo: 'changed' });

    expect(mongoObserver.foreignKeyRegistry.add).toHaveBeenCalledTimes(0);
    expect(mongoObserver.foreignKeyRegistry.replace).toHaveBeenCalledTimes(0);
    expect(mongoObserver.foreignKeyRegistry.remove).toHaveBeenNthCalledWith(
      1,
      'testId'
    );
  });

  it('do not call registry on undefined foreign keys on observeChanges()', () => {
    expect.assertions(3);

    let callback: MeteorObserveChangesCallbacks | undefined;
    const cursorMock = {
      observeChanges: (cb: MeteorObserveChangesCallbacks): void => {
        callback = cb;
      },
    } as Mongo.Cursor<MongoDoc>;

    mongoObserver = new MongoObserver();
    mongoObserver.foreignKeyRegistry.add = jest.fn();
    mongoObserver.foreignKeyRegistry.replace = jest.fn();
    mongoObserver.foreignKeyRegistry.remove = jest.fn();

    mongoObserver.observeChanges(
      cursorMock,
      observeChangesMock,
      watchObserveCallBacks
    );
    if (!callback) throw Error('callback not set');

    callback.added('testId', { foo: 'bar' });
    callback.changed('testId', { foo: 'changed' });
    callback.removed('testId');

    expect(mongoObserver.foreignKeyRegistry.add).toHaveBeenCalledTimes(0);
    expect(mongoObserver.foreignKeyRegistry.replace).toHaveBeenCalledTimes(0);
    expect(mongoObserver.foreignKeyRegistry.remove).toHaveBeenNthCalledWith(
      1,
      'testId'
    );
  });
});
