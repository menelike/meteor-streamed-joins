/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Mongo } from 'meteor/mongo';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';

import MeteorPublicationMock from '../tests/MeteorPublicationMock';
import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';
import { waitUntilHaveBeenCalledTimes } from '../tests/waitUntil';

import Link from './Link';

const mongoDB = new MongoMemoryReplSet();

const DEFAULT_WAIT_IN_MS = 250;

const COLLECTION_NAME_ROOT = 'ROOT';

let root: Link | undefined;

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(COLLECTION_NAME_ROOT);
});

afterEach(async () => {
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME_ROOT).deleteMany({});
  if (root) {
    root.stop();
    root = undefined;
  }
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('Link', () => {
  it('stops if publication context is stopped', () => {
    expect.assertions(2);

    const db = mongoDB.db();
    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    let onStopFunc: (() => void) | undefined;
    const publicationMock = {
      ...MeteorPublicationMock,
      onStop: jest.fn().mockImplementation((func: () => void): void => {
        onStopFunc = func;
      }),
    };

    root = new Link(publicationMock, collectionMock, {}, () => true);
    const originalStop = root.stop;
    root.stop = jest.fn();
    root.observe();

    expect(onStopFunc).toBeTruthy();
    if (!onStopFunc) throw Error('no onStop() function registered');
    onStopFunc();
    expect(root.stop).toHaveBeenCalledTimes(1);
    root.stop = originalStop;
  });

  it('resolves root from root', () => {
    expect.assertions(1);

    const db = mongoDB.db();
    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);

    expect(root.root()).toBe(root);
  });

  it('calls added on first run', () => {
    expect.assertions(3);

    const db = mongoDB.db();

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [
          { _id: 'documentA', child: 'childA' },
          { _id: 'documentB', child: 'childB' },
        ];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      'documentA',
      { child: 'childA' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_ROOT,
      'documentB',
      { child: 'childB' }
    );
  });

  it('calls added on document insert', async () => {
    expect.assertions(3);

    const db = mongoDB.db();

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'something',
    };

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.insertOne(document);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      document._id,
      { prop: 'something' }
    );
  });

  it('calls changed on pre-matched document update', async () => {
    expect.assertions(3);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'something',
      other: 'static',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [document];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);

    await collection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.updateOne(
      { _id: document._id },
      { $set: { prop: 'changed' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      document._id,
      { prop: 'changed' }
    );
  });

  it('calls added on non-pre-matched document update', async () => {
    expect.assertions(4);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
      other: 'static',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(
      MeteorPublicationMock,
      collectionMock,
      {},
      ({ prop }) => prop === 'match'
    );

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    await collection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.updateOne(
      { _id: document._id },
      { $set: { prop: 'match' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      document._id,
      { prop: 'match', other: 'static' }
    );
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
  });

  it('calls remove on pre-matched document update', async () => {
    expect.assertions(4);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'match',
      other: 'static',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [document];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(
      MeteorPublicationMock,
      collectionMock,
      {},
      ({ prop }) => prop === 'match'
    );

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    await collection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.updateOne(
      { _id: document._id },
      { $set: { prop: 'nonMatch' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      document._id
    );
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
  });

  it('calls removed/added on pre-matched document replace', async () => {
    expect.assertions(7);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'something',
      other: 'static',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [document];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);

    await collection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.replaceOne(
      { _id: document._id },
      { prop: 'changed', other: 'static' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);
    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      document._id
    );
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_ROOT,
      document._id,
      { prop: 'changed', other: 'static' }
    );
  });

  it('calls added on non-pre-matched document replace', async () => {
    expect.assertions(4);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
      other: 'static',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(
      MeteorPublicationMock,
      collectionMock,
      {},
      ({ prop }) => prop === 'match'
    );

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    await collection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.replaceOne(
      { _id: document._id },
      { prop: 'match', other: 'static' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      document._id,
      { prop: 'match', other: 'static' }
    );
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
  });

  it('calls remove on pre-matched document replace', async () => {
    expect.assertions(4);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'match',
      other: 'static',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [document];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(
      MeteorPublicationMock,
      collectionMock,
      {},
      ({ prop }) => prop === 'match'
    );

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    await collection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.replaceOne(
      { _id: document._id },
      { prop: 'nonMatch', other: 'static' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      document._id
    );
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
  });

  it('calls remove on remove', async () => {
    expect.assertions(3);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'match',
      other: 'static',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [document];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(
      MeteorPublicationMock,
      collectionMock,
      {},
      ({ prop }) => prop === 'match'
    );

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    await collection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.deleteOne({ _id: document._id });

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      document._id
    );
  });

  it('filters fields', async () => {
    expect.assertions(4);

    const db = mongoDB.db();

    const documentA = {
      _id: new ObjectID().toHexString(),
      prop: 'propA',
      other: 'static',
    };

    const documentB = {
      _id: new ObjectID().toHexString(),
      prop: 'propB',
      other: 'static',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true, {
      fields: { prop: 1 },
    });

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.insertMany([documentA, documentB]);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      documentA._id,
      { prop: documentA.prop }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_ROOT,
      documentB._id,
      { prop: documentB.prop }
    );
  });

  it('ignore unmatched document on added', async () => {
    expect.assertions(4);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    const matcher = jest
      .fn()
      .mockImplementation(({ prop }) => prop === 'match');
    root = new Link(MeteorPublicationMock, collectionMock, {}, matcher);

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.insertOne(document);

    await waitUntilHaveBeenCalledTimes(matcher, 1);
    expect(matcher).toHaveBeenCalledTimes(1);
    expect(matcher).toHaveBeenNthCalledWith(1, { prop: 'nonMatch' });
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
  });

  it('ignore unmatched document on update', async () => {
    expect.assertions(6);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    const matcher = jest
      .fn()
      .mockImplementation(({ prop }) => prop === 'match');
    root = new Link(MeteorPublicationMock, collectionMock, {}, matcher);

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    await collection.insertOne(document);

    root.observe();

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.updateOne(
      { _id: document._id },
      { $set: { prop: 'stillNonMatch' } }
    );

    await waitUntilHaveBeenCalledTimes(matcher, 1);
    expect(matcher).toHaveBeenCalledTimes(1);
    expect(matcher).toHaveBeenNthCalledWith(1, { prop: 'stillNonMatch' });
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('ignore unmatched document on replace', async () => {
    expect.assertions(6);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    const matcher = jest
      .fn()
      .mockImplementation(({ prop }) => prop === 'match');
    root = new Link(MeteorPublicationMock, collectionMock, {}, matcher);

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    await collection.insertOne(document);

    root.observe();

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.replaceOne(
      { _id: document._id },
      { prop: 'stillNonMatch' }
    );

    await waitUntilHaveBeenCalledTimes(matcher, 1);
    expect(matcher).toHaveBeenCalledTimes(1);
    expect(matcher).toHaveBeenNthCalledWith(1, { prop: 'stillNonMatch' });
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('ignore unmatched document on remove', async () => {
    expect.assertions(2);

    const db = mongoDB.db();

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);

    const collection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    await collection.insertOne(document);

    root.observe();

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await collection.deleteOne({ _id: document._id });

    // wait twice the time since we don't exactly know when the signaling has finished
    await sleep(DEFAULT_WAIT_IN_MS * 2);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });
});
