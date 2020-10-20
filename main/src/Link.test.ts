/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Mongo } from 'meteor/mongo';
import { ObjectID } from 'mongodb';
import type { Collection } from 'mongodb';

import MeteorPublicationMock from '../tests/MeteorPublicationMock';
import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';
import { waitUntilHaveBeenCalledTimes } from '../tests/waitUntil';

import Link from './Link';

const mongoDB = new MongoMemoryReplSet();

const DEFAULT_WAIT_IN_MS = 250;

const COLLECTION_NAME_ROOT = 'LINK_ROOT';

let root: Link | undefined;

let RootCollection: Collection<any>;

let RootCollectionMock: Mongo.Collection<any>;

beforeAll(async () => {
  await mongoDB.connect();
  RootCollection = await mongoDB.db().createCollection(COLLECTION_NAME_ROOT);
  RootCollectionMock = await mongoDB.mongoShell(RootCollection);
});

afterEach(async () => {
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME_ROOT).deleteMany({});
  if (root) {
    await root.stop();
    root = undefined;
  }
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('Link', () => {
  it('stops if publication context is stopped', async () => {
    expect.assertions(2);

    let onStopFunc: (() => Promise<void>) | undefined;
    const publicationMock = {
      ...MeteorPublicationMock,
      onStop: jest
        .fn()
        .mockImplementation((func: () => Promise<void>): void => {
          onStopFunc = func;
        }),
    };

    root = new Link(publicationMock, RootCollectionMock, {});
    root.observe();

    const child = root.link(RootCollectionMock, () => undefined);
    const originalStop = child.stop;
    child.stop = jest.fn();

    expect(onStopFunc).toBeTruthy();
    if (!onStopFunc) throw Error('no onStop() function registered');
    await onStopFunc();

    expect(child.stop).toHaveBeenCalledTimes(1);
    await originalStop();
  });

  it('resolves root from root', () => {
    expect.assertions(1);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    expect(root.root()).toBe(root);
  });

  it('calls added on first run', async () => {
    expect.assertions(3);

    const rootDocuments = [
      { _id: new ObjectID().toHexString(), child: 'childA' },
      { _id: new ObjectID().toHexString(), child: 'childB' },
    ];

    await RootCollection.insertMany(rootDocuments);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocuments[0]._id,
      { child: 'childA' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_ROOT,
      rootDocuments[1]._id,
      { child: 'childB' }
    );
  });

  it('skips publication', async () => {
    expect.assertions(2);

    await RootCollection.insertOne({ _id: new ObjectID().toHexString() });

    root = new Link(
      MeteorPublicationMock,
      RootCollectionMock,
      {},
      { skipPublication: true }
    );

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await root.stop();

    root = new Link(
      MeteorPublicationMock,
      RootCollectionMock,
      {},
      { skipPublication: false }
    );

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
  });

  it('calls added on document insert', async () => {
    expect.assertions(3);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'something',
    };

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.insertOne(document);

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

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'something',
      other: 'static',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    await RootCollection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.updateOne(
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

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
      other: 'static',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    await RootCollection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.updateOne(
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

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'match',
      other: 'static',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    await RootCollection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.updateOne(
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

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'something',
      other: 'static',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    await RootCollection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.replaceOne(
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

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
      other: 'static',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    await RootCollection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.replaceOne(
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

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'match',
      other: 'static',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    await RootCollection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.replaceOne(
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

    const document = {
      _id: new ObjectID().toHexString(),
      prop: 'match',
      other: 'static',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    await RootCollection.insertOne(document);

    root.observe();
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.deleteOne({ _id: document._id });

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

    root = new Link(
      MeteorPublicationMock,
      RootCollectionMock,
      {},
      {
        fields: { prop: 1 },
      }
    );

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.insertMany([documentA, documentB]);

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
    expect.assertions(3);

    const documentA = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    const documentB = {
      _id: new ObjectID().toHexString(),
      prop: 'match',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.insertOne(documentA);
    await RootCollection.insertOne(documentB);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      documentB._id,
      { prop: documentB.prop }
    );
  });

  it('ignore unmatched document on update', async () => {
    expect.assertions(5);

    const documentA = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    const documentB = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    await RootCollection.insertMany([documentA, documentB]);

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.updateOne(
      { _id: documentA._id },
      { $set: { prop: 'stillNonMatch' } }
    );

    await RootCollection.updateOne(
      { _id: documentB._id },
      { $set: { prop: 'match' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      documentB._id,
      { prop: 'match' }
    );
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('ignore unmatched document on replace', async () => {
    expect.assertions(5);

    const documentA = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    const documentB = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    await RootCollection.insertMany([documentA, documentB]);

    root.observe();

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.replaceOne(
      { _id: documentA._id },
      { prop: 'stillNonMatch' }
    );

    await RootCollection.replaceOne({ _id: documentB._id }, { prop: 'match' });

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      documentB._id,
      { prop: 'match' }
    );
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('ignore unmatched document on remove', async () => {
    expect.assertions(3);

    const documentA = {
      _id: new ObjectID().toHexString(),
      prop: 'nonMatch',
    };

    const documentB = {
      _id: new ObjectID().toHexString(),
      prop: 'match',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      prop: 'match',
    });

    await RootCollection.insertMany([documentA, documentB]);

    root.observe();

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.deleteOne({ _id: documentA._id });
    await RootCollection.deleteOne({ _id: documentB._id });

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      documentB._id
    );
  });
});
