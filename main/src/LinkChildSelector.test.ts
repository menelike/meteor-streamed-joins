/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Mongo } from 'meteor/mongo';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';
import type { Collection } from 'mongodb';

import MeteorPublicationMock from '../tests/MeteorPublicationMock';
import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';
import { waitUntilHaveBeenCalledTimes } from '../tests/waitUntil';

import Link from './Link';
import type { LinkChildSelector } from './LinkChildSelector';

const mongoDB = new MongoMemoryReplSet();

const DEFAULT_WAIT_IN_MS = 250;

const COLLECTION_NAME_ROOT = 'LINK_CHILD_SELECTOR_ROOT';

const COLLECTION_NAME_CHILD = 'LINK_CHILD_SELECTOR_ROOT_CHILD';

const COLLECTION_NAME_GRANDCHILD = 'LINK_CHILD_SELECTOR_ROOT_GRANDCHILD';

let root: Link | undefined;
let child: LinkChildSelector | undefined;
let grandChild: LinkChildSelector | undefined;

let RootCollection: Collection<any>;
let ChildCollection: Collection<any>;
let GrandChildCollection: Collection<any>;

let RootCollectionMock: Mongo.Collection<any>;
let ChildCollectionMock: Mongo.Collection<any>;
let GrandChildCollectionMock: Mongo.Collection<any>;

beforeAll(async () => {
  await mongoDB.connect();
  RootCollection = await mongoDB.db().createCollection(COLLECTION_NAME_ROOT);
  ChildCollection = await mongoDB.db().createCollection(COLLECTION_NAME_CHILD);
  GrandChildCollection = await mongoDB
    .db()
    .createCollection(COLLECTION_NAME_GRANDCHILD);
  RootCollectionMock = await mongoDB.mongoShell(RootCollection);
  ChildCollectionMock = await mongoDB.mongoShell(ChildCollection);
  GrandChildCollectionMock = await mongoDB.mongoShell(GrandChildCollection);
});

afterEach(async () => {
  if (root) {
    await root.stop();
    root = undefined;
  }
  if (child) {
    await child.stop();
    child = undefined;
  }
  if (grandChild) {
    await grandChild.stop();
    grandChild = undefined;
  }

  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME_ROOT).deleteMany({});
  await db.collection(COLLECTION_NAME_CHILD).deleteMany({});
  await db.collection(COLLECTION_NAME_GRANDCHILD).deleteMany({});

  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('LinkChildSelector', () => {
  it('previously resolved parent does not resolve after change', async () => {
    expect.assertions(5);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) =>
        doc.group ? { group: doc.group } : undefined
      );

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { group: rootDocument.group }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { group: childDocument.group }
    );

    await RootCollection.updateOne(
      { _id: rootDocument._id },
      { $unset: { group: '' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocument._id
    );
  });

  it('update on child matches afterwards and adds the child', async () => {
    expect.assertions(4);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});
    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { group: rootDocument.group }
    );

    await ChildCollection.updateOne(
      { _id: childDocument._id },
      { $set: { group: 'A' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { group: rootDocument.group }
    );
  });

  it('replace on child matches afterwards and adds the child', async () => {
    expect.assertions(4);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { group: rootDocument.group }
    );

    await ChildCollection.replaceOne(
      { _id: childDocument._id },
      { group: 'A' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { group: rootDocument.group }
    );
  });

  it('previously matched child does not match after update and is removed', async () => {
    expect.assertions(5);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { group: rootDocument.group }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { group: rootDocument.group }
    );

    await ChildCollection.updateOne(
      { _id: childDocument._id },
      { $set: { group: 'B' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocument._id
    );
  });

  it('previously matched child does not match after replace and is removed', async () => {
    expect.assertions(5);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { group: rootDocument.group }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { group: rootDocument.group }
    );

    await ChildCollection.replaceOne(
      { _id: childDocument._id },
      { group: 'B' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocument._id
    );
  });

  it('a parent update with the same resolver does not hit the database again', async () => {
    expect.assertions(5);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    // @ts-ignore
    await waitUntilHaveBeenCalledTimes(ChildCollectionMock.find, 1);

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);

    await RootCollection.updateOne(
      { _id: rootDocument._id },
      { $set: { some: 'thing' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
  });

  it('an unmatched added child is not published', async () => {
    expect.assertions(2);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);

    await ChildCollection.insertOne(childDocument);

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
  });

  it('two parents match, after an child update only one parent matches', async () => {
    expect.assertions(9);

    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    const rootDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    await RootCollection.insertMany([rootDocumentA, rootDocumentB]);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      groups: [rootDocumentA.group, rootDocumentB.group],
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ groups: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await ChildCollection.updateOne(
      { _id: childDocument._id },
      { $pull: { groups: rootDocumentA.group } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await ChildCollection.updateOne(
      { _id: childDocument._id },
      { $pull: { groups: rootDocumentB.group } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
  });

  it('two parents match, after an child replace only one parent matches', async () => {
    expect.assertions(6);

    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    const rootDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    await RootCollection.insertMany([rootDocumentA, rootDocumentB]);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      groups: [rootDocumentA.group, rootDocumentB.group],
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ groups: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await ChildCollection.replaceOne(
      { _id: childDocument._id },
      { groups: [rootDocumentB.group] }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 4);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);

    await ChildCollection.replaceOne(
      { _id: childDocument._id },
      { groups: [] }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 2);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(2);
  });

  it('resolves root from children', () => {
    expect.assertions(2);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    child = root.select(ChildCollectionMock, () => undefined);

    expect(child.root()).toBe(root);

    grandChild = root.select(GrandChildCollectionMock, () => undefined);
    expect(grandChild.root()).toBe(root);
  });

  it('calls added on first run', async () => {
    expect.assertions(8);

    const rootDocuments = [
      { _id: new ObjectID().toHexString(), group: 'groupA' },
      { _id: new ObjectID().toHexString(), group: 'groupB' },
    ];
    await RootCollection.insertMany(rootDocuments);

    const childDocuments = [
      { _id: new ObjectID().toHexString(), group: 'groupA' },
      { _id: new ObjectID().toHexString(), group: 'groupB' },
    ];
    await ChildCollection.insertMany(childDocuments);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    expect(childResolver).toHaveBeenCalledTimes(2);
    expect(childResolver).toHaveBeenNthCalledWith(1, { group: 'groupA' });
    expect(childResolver).toHaveBeenNthCalledWith(2, { group: 'groupB' });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocuments[0]._id,
      { group: 'groupA' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_ROOT,
      rootDocuments[1]._id,
      { group: 'groupB' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      childDocuments[0]._id,
      { group: 'groupA' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      4,
      COLLECTION_NAME_CHILD,
      childDocuments[1]._id,
      { group: 'groupB' }
    );
  });

  it('calls removed on root document remove', async () => {
    expect.assertions(3);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));

    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.deleteOne({ _id: rootDocument._id });

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 2);

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id
    );
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id
    );
  });

  it('calls changed on child document update', async () => {
    expect.assertions(2);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.updateOne(
      { _id: childDocument._id },
      { $set: { prop: 'changed' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { prop: 'changed' }
    );
  });

  it('calls removed/added on child document replace', async () => {
    expect.assertions(5);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.replaceOne(
      { _id: childDocument._id },
      { group: 'A', prop: 'changed', something: 'different' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocument._id
    );
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { group: 'A', prop: 'changed', something: 'different' }
    );
  });

  it('filters fields on updated child document', async () => {
    expect.assertions(2);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.updateOne(
      { _id: childDocument._id },
      { $set: { prop: 'changed', something: 'different' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { prop: 'changed' }
    );
  });

  it('filters fields on replaced child document', async () => {
    expect.assertions(6);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.replaceOne(
      { _id: childDocument._id },
      { group: 'A', prop: 'changed', something: 'differentAgain' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocument._id
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { prop: 'changed' }
    );
  });

  it('ignores update on unrelated child document', async () => {
    expect.assertions(1);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
    const childDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
      something: 'else',
    };
    await ChildCollection.insertMany([childDocumentA, childDocumentB]);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.updateOne(
      { _id: childDocumentB._id },
      { $set: { prop: 'changed', something: 'different' } }
    );

    // update this only to trigger waitUntilHaveBeenCalledTimes
    await ChildCollection.updateOne(
      { _id: childDocumentA._id },
      { $set: { prop: 'changed' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
  });

  it('ignores replace on unrelated child document', async () => {
    expect.assertions(4);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const childDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
    const childDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
      something: 'else',
    };
    await ChildCollection.insertMany([childDocumentA, childDocumentB]);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.replaceOne(
      { _id: childDocumentB._id },
      { group: 'B', prop: 'changed' }
    );

    // replace this only to trigger waitUntilHaveBeenCalledTimes
    await ChildCollection.replaceOne(
      { _id: childDocumentA._id },
      { group: 'A', prop: 'changed' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
  });

  it('ignores unresolved children keys', async () => {
    expect.assertions(4);

    const rootDocument = { _id: new ObjectID().toHexString(), group: 'A' };
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.select(ChildCollectionMock, childResolver);

    root.observe();

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, { group: 'A' });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { group: 'A' }
    );
  });

  it('ignores children document add', async () => {
    expect.assertions(3);

    const childDocument = { _id: new ObjectID().toHexString() };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.select(ChildCollectionMock, childResolver);
    // @ts-ignore
    child.added = jest.fn().mockImplementation(() => undefined);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.insertOne(childDocument);

    // @ts-ignore
    await waitUntilHaveBeenCalledTimes(child.added, 1);
    // @ts-ignore
    expect(child.added).toHaveBeenCalledTimes(1);
    // @ts-ignore
    expect(child.added).toHaveBeenNthCalledWith(
      1,
      childDocument._id,
      {},
      expect.anything()
    );

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
  });

  it('ignores children document remove', async () => {
    expect.assertions(3);

    const childDocument = { _id: new ObjectID().toHexString() };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.select(ChildCollectionMock, childResolver);
    // @ts-ignore
    child.removed = jest.fn().mockImplementation(() => undefined);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.deleteOne({ _id: childDocument._id });

    // @ts-ignore
    await waitUntilHaveBeenCalledTimes(child.removed, 1);
    // @ts-ignore
    expect(child.removed).toHaveBeenCalledTimes(1);
    // @ts-ignore
    expect(child.removed).toHaveBeenNthCalledWith(
      1,
      childDocument._id,
      expect.anything()
    );

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('child resolves back to root', async () => {
    expect.assertions(14);

    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    const rootDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    const rootDocumentC = {
      _id: new ObjectID().toHexString(),
      group: 'C',
    };
    const childDocument = {
      _id: new ObjectID().toHexString(),
      groups: [rootDocumentA.group, rootDocumentB.group, rootDocumentC.group],
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, { group: 'A' });

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ groups: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);
    const rootResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: { $in: doc.groups } }));
    child.select(RootCollectionMock, rootResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.insertOne(rootDocumentB);
    await RootCollection.insertOne(rootDocumentC);
    await ChildCollection.insertOne(childDocument);
    await RootCollection.insertOne(rootDocumentA);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 4);

    expect(RootCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(1, {
      group: 'A',
    });
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(2, {
      $or: [
        {
          group: {
            $in: [
              rootDocumentA.group,
              rootDocumentB.group,
              rootDocumentC.group,
            ],
          },
        },
      ],
    });

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(1, {
      $or: [{ groups: 'A' }],
    });

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      group: rootDocumentA.group,
    });

    expect(rootResolver).toHaveBeenCalledTimes(1);
    expect(rootResolver).toHaveBeenNthCalledWith(1, {
      groups: [rootDocumentA.group, rootDocumentB.group, rootDocumentC.group],
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocumentA._id,
      { group: rootDocumentA.group }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { groups: childDocument.groups }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_ROOT,
      rootDocumentB._id,
      { group: rootDocumentB.group }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      4,
      COLLECTION_NAME_ROOT,
      rootDocumentC._id,
      { group: rootDocumentC.group }
    );
  });

  it('root update replaces children', async () => {
    expect.assertions(15);

    const childDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    const childDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {
      group: { $exists: true },
    });

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    await ChildCollection.insertMany([childDocumentA, childDocumentB]);
    await RootCollection.insertOne(rootDocumentA);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(RootCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(1, {
      group: { $exists: true },
    });

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(1, {
      $or: [{ group: childDocumentA.group }],
    });

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      group: rootDocumentA.group,
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocumentA._id,
      { group: rootDocumentA.group }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocumentA._id,
      { group: childDocumentA.group }
    );

    // now replace child A with child B
    await RootCollection.updateOne(
      { _id: rootDocumentA._id },
      { $set: { group: childDocumentB.group } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(2, {
      $or: [{ group: childDocumentB.group }],
    });

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocumentA._id
    );
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      childDocumentB._id,
      { group: childDocumentB.group }
    );
  });

  it('one parent with multiple children from the same collection', async () => {
    expect.assertions(13);

    const childDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    const childDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      group: childDocumentA.group,
      groups: [childDocumentA.group, childDocumentB.group],
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    const childrenResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: { $in: doc.groups } }));
    const children = root.select(ChildCollectionMock, childrenResolver);

    await ChildCollection.insertMany([childDocumentA, childDocumentB]);
    await RootCollection.insertOne(rootDocumentA);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(RootCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(1, {});

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(1, {
      $or: [{ group: 'A' }],
    });
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(2, {
      $or: [{ group: { $in: ['A', 'B'] } }],
    });

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      group: rootDocumentA.group,
      groups: [childDocumentA.group, childDocumentB.group],
    });

    expect(childrenResolver).toHaveBeenCalledTimes(1);
    expect(childrenResolver).toHaveBeenNthCalledWith(1, {
      group: rootDocumentA.group,
      groups: [childDocumentA.group, childDocumentB.group],
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocumentA._id,
      {
        group: rootDocumentA.group,
        groups: rootDocumentA.groups,
      }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocumentA._id,
      { group: childDocumentA.group }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      childDocumentB._id,
      { group: childDocumentB.group }
    );

    await children.stop();
  });

  it('two parents with the same child', async () => {
    expect.assertions(17);

    const grandChildDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
      prop: 'grandChild',
    };
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      grandGroup: 'B',
      prop: 'child',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      grandGroup: 'B',
      prop: 'root',
    };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    const grandChildResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.grandGroup }));
    grandChild = root.select(GrandChildCollectionMock, grandChildResolver);

    const childToGrandChildResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.grandGroup }));
    const childToGrandChild = child.select(
      GrandChildCollectionMock,
      childToGrandChildResolver
    );

    await GrandChildCollection.insertOne(grandChildDocument);
    await ChildCollection.insertOne(childDocument);
    await RootCollection.insertOne(rootDocument);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(RootCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(1, {});

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(1, {
      $or: [{ group: 'A' }],
    });

    expect(GrandChildCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(GrandChildCollectionMock.find).toHaveBeenNthCalledWith(1, {
      $or: [{ group: 'B' }],
    });
    expect(GrandChildCollectionMock.find).toHaveBeenNthCalledWith(2, {
      $or: [{ group: 'B' }],
    });

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      prop: rootDocument.prop,
      group: rootDocument.group,
      grandGroup: rootDocument.grandGroup,
    });

    expect(grandChildResolver).toHaveBeenCalledTimes(1);
    expect(grandChildResolver).toHaveBeenNthCalledWith(1, {
      prop: rootDocument.prop,
      group: rootDocument.group,
      grandGroup: rootDocument.grandGroup,
    });

    expect(childToGrandChildResolver).toHaveBeenCalledTimes(1);
    expect(childToGrandChildResolver).toHaveBeenNthCalledWith(1, {
      prop: childDocument.prop,
      group: childDocument.group,
      grandGroup: childDocument.grandGroup,
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      {
        prop: rootDocument.prop,
        group: rootDocument.group,
        grandGroup: rootDocument.grandGroup,
      }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      {
        prop: childDocument.prop,
        group: childDocument.group,
        grandGroup: childDocument.grandGroup,
      }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_GRANDCHILD,
      grandChildDocument._id,
      {
        prop: grandChildDocument.prop,
        group: grandChildDocument.group,
      }
    );

    await childToGrandChild.stop();
  });

  it('adds related child even if the child was created afterwards', async () => {
    expect.assertions(3);

    const childDocument = { _id: new ObjectID().toHexString(), group: 'A' };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.insertOne(childDocument);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { group: rootDocument.group }
    );

    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { group: childDocument.group }
    );
  });

  it('afterwards created children are only added on the primary publication context', async () => {
    expect.assertions(9);

    const childDocument = { _id: new ObjectID().toHexString(), group: 'A' };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);
    grandChild = root.select(ChildCollectionMock, childResolver);

    // @ts-ignore
    const childSpy = jest.spyOn(child.publicationContext, 'commitAdded');
    const grandChildSpy = jest.spyOn(
      grandChild.publicationContext,
      // @ts-ignore
      'commitAdded'
    );

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    expect(
      child.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeFalsy();
    expect(
      grandChild.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeFalsy();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.insertOne(childDocument);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);
    expect(
      child.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeTruthy();
    expect(
      grandChild.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeFalsy();
    expect(childSpy).toHaveBeenCalledTimes(1);
    expect(grandChildSpy).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { group: rootDocument.group }
    );

    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { group: childDocument.group }
    );
  });

  it('removes children even if parent is still related', async () => {
    expect.assertions(2);

    const childDocument = { _id: new ObjectID().toHexString(), group: 'A' };
    const unrelatedChildDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    await ChildCollection.insertOne(childDocument);
    await ChildCollection.insertOne(unrelatedChildDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.deleteOne({ _id: unrelatedChildDocument._id });
    await ChildCollection.deleteOne({ _id: childDocument._id });

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 1);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_CHILD,
      childDocument._id
    );
  });

  it('calls link from select', async () => {
    expect.assertions(1);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await RootCollection.insertOne(rootDocument);
    const grandChildDocument = {
      _id: new ObjectID().toHexString(),
    };
    await GrandChildCollection.insertOne(grandChildDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      child: grandChildDocument._id,
    };
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {});

    const childResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));
    child = root.select(ChildCollectionMock, childResolver);

    child.link(GrandChildCollectionMock, (doc) => [doc.child]);

    root.observe();

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
  });
});
