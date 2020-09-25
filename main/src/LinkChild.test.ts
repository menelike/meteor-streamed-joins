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
import type { LinkChild } from './LinkChild';

const mongoDB = new MongoMemoryReplSet();

const DEFAULT_WAIT_IN_MS = 250;

const COLLECTION_NAME_ROOT = 'LINK_CHILD_ROOT';

const COLLECTION_NAME_CHILD = 'LINK_CHILD_ROOT_CHILD';

const COLLECTION_NAME_GRANDCHILD = 'LINK_CHILD_ROOT_GRANDCHILD';

let root: Link | undefined;
let child: LinkChild | undefined;
let grandChild: LinkChild | undefined;

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

describe('LinkChild', () => {
  it('resolves root from children', () => {
    expect.assertions(2);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    child = root.link(ChildCollectionMock, () => undefined);

    expect(child.root()).toBe(root);

    grandChild = root.link(GrandChildCollectionMock, () => undefined);
    expect(grandChild.root()).toBe(root);
  });

  it('calls added on first run', async () => {
    expect.assertions(8);

    const childDocuments = [
      { _id: new ObjectID().toHexString(), prop: 'A' },
      { _id: new ObjectID().toHexString(), prop: 'B' },
    ];
    await ChildCollection.insertMany(childDocuments);

    const rootDocuments = [
      { _id: new ObjectID().toHexString(), child: childDocuments[0]._id },
      { _id: new ObjectID().toHexString(), child: childDocuments[1]._id },
    ];
    await RootCollection.insertMany(rootDocuments);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

    root.observe();

    expect(childResolver).toHaveBeenCalledTimes(2);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      child: childDocuments[0]._id,
    });
    expect(childResolver).toHaveBeenNthCalledWith(2, {
      child: childDocuments[1]._id,
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocuments[0]._id,
      { child: childDocuments[0]._id }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_ROOT,
      rootDocuments[1]._id,
      { child: childDocuments[1]._id }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      childDocuments[0]._id,
      { prop: 'A' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      4,
      COLLECTION_NAME_CHILD,
      childDocuments[1]._id,
      { prop: 'B' }
    );
  });

  it('calls removed on root document remove', async () => {
    expect.assertions(3);

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await RootCollection.insertOne(rootDocument);
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

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

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await RootCollection.insertOne(rootDocument);
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

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

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await RootCollection.insertOne(rootDocument);
    await ChildCollection.insertOne(childDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.replaceOne(
      { _id: childDocument._id },
      { prop: 'changed', something: 'different' }
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
      { prop: 'changed', something: 'different' }
    );
  });

  it('filters fields on updated child document', async () => {
    expect.assertions(2);

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };

    await ChildCollection.insertOne(childDocument);
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver, {
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

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };

    await ChildCollection.insertOne(childDocument);
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.replaceOne(
      { _id: childDocument._id },
      { prop: 'changed', something: 'differentAgain' }
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

    const childDocumentA = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const childDocumentB = {
      _id: new ObjectID().toHexString(),
      prop: 'B',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocumentA._id,
    };

    await ChildCollection.insertOne(childDocumentA);
    await ChildCollection.insertOne(childDocumentB);
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver, {
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

    const childDocumentA = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const childDocumentB = {
      _id: new ObjectID().toHexString(),
      prop: 'B',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocumentA._id,
    };

    await ChildCollection.insertOne(childDocumentA);
    await ChildCollection.insertOne(childDocumentB);
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.replaceOne(
      { _id: childDocumentB._id },
      { prop: 'changed' }
    );

    // replace this only to trigger waitUntilHaveBeenCalledTimes
    await ChildCollection.replaceOne(
      { _id: childDocumentA._id },
      { prop: 'changed' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
  });

  it('ignores unresolved children keys', async () => {
    expect.assertions(4);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      unknownProp: 'childA',
    };
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.link(ChildCollectionMock, childResolver);

    root.observe();

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, { unknownProp: 'childA' });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { unknownProp: 'childA' }
    );
  });

  it('ignores children document add', async () => {
    expect.assertions(3);

    const childDocument = { _id: new ObjectID().toHexString() };

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.link(ChildCollectionMock, childResolver);
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

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.link(ChildCollectionMock, childResolver);
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

    const rootDocumentB = {
      _id: new ObjectID().toHexString(),
    };
    const rootDocumentC = {
      _id: new ObjectID().toHexString(),
    };
    const rootDocumentAId = new ObjectID().toHexString();
    const childDocument = {
      _id: new ObjectID().toHexString(),
      roots: [rootDocumentB._id, rootDocumentC._id, rootDocumentAId],
    };
    const rootDocumentA = {
      _id: rootDocumentAId,
      child: childDocument._id,
    };

    root = new Link(
      MeteorPublicationMock,
      RootCollectionMock,
      {},
      (doc) => !!doc.child
    );

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

    const rootResolver = jest.fn().mockImplementation((doc) => doc.roots);
    child.link(RootCollectionMock, rootResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await RootCollection.insertOne(rootDocumentB);
    await RootCollection.insertOne(rootDocumentC);
    await ChildCollection.insertOne(childDocument);
    await RootCollection.insertOne(rootDocumentA);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 4);

    expect(RootCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(1, {});
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(
      2,
      {
        _id: { $in: [rootDocumentB._id, rootDocumentC._id] },
      },
      { fields: undefined }
    );

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [childDocument._id] },
      },
      { fields: undefined }
    );

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      child: rootDocumentA.child,
    });

    expect(rootResolver).toHaveBeenCalledTimes(1);
    expect(rootResolver).toHaveBeenNthCalledWith(1, {
      roots: [rootDocumentB._id, rootDocumentC._id, rootDocumentA._id],
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocumentA._id,
      { child: childDocument._id }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { roots: [rootDocumentB._id, rootDocumentC._id, rootDocumentA._id] }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_ROOT,
      rootDocumentB._id,
      {}
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      4,
      COLLECTION_NAME_ROOT,
      rootDocumentC._id,
      {}
    );
  });

  it('root update replaces children', async () => {
    expect.assertions(15);

    const childDocumentA = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
    };
    const childDocumentB = {
      _id: new ObjectID().toHexString(),
      prop: 'B',
    };
    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      child: childDocumentA._id,
    };

    root = new Link(
      MeteorPublicationMock,
      RootCollectionMock,
      {},
      (doc) => !!doc.child
    );

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

    await ChildCollection.insertMany([childDocumentA, childDocumentB]);
    await RootCollection.insertOne(rootDocumentA);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(RootCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(1, {});

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [childDocumentA._id] },
      },
      { fields: undefined }
    );

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      child: rootDocumentA.child,
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocumentA._id,
      { child: childDocumentA._id }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocumentA._id,
      { prop: 'A' }
    );

    // now replace child A with child B
    await RootCollection.updateOne(
      { _id: rootDocumentA._id },
      { $set: { child: childDocumentB._id } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(
      2,
      {
        _id: { $in: [childDocumentB._id] },
      },
      { fields: undefined }
    );

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
      { prop: 'B' }
    );
  });

  it('one parent with multiple children from the same collection', async () => {
    expect.assertions(12);

    const childDocumentA = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
    };
    const childDocumentB = {
      _id: new ObjectID().toHexString(),
      prop: 'B',
    };
    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      child: childDocumentA._id,
      children: [childDocumentA._id, childDocumentB._id],
    };

    root = new Link(
      MeteorPublicationMock,
      RootCollectionMock,
      {},
      (doc) => !!doc.child
    );

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

    const childrenResolver = jest
      .fn()
      .mockImplementation((doc) => doc.children);
    const children = root.link(ChildCollectionMock, childrenResolver);

    await ChildCollection.insertMany([childDocumentA, childDocumentB]);
    await RootCollection.insertOne(rootDocumentA);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(RootCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(RootCollectionMock.find).toHaveBeenNthCalledWith(1, {});

    expect(ChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [childDocumentA._id, childDocumentB._id] },
      },
      { fields: undefined }
    );

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      child: rootDocumentA.child,
      children: [childDocumentA._id, childDocumentB._id],
    });

    expect(childrenResolver).toHaveBeenCalledTimes(1);
    expect(childrenResolver).toHaveBeenNthCalledWith(1, {
      child: rootDocumentA.child,
      children: [childDocumentA._id, childDocumentB._id],
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocumentA._id,
      {
        child: childDocumentA._id,
        children: [childDocumentA._id, childDocumentB._id],
      }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocumentA._id,
      { prop: 'A' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      childDocumentB._id,
      { prop: 'B' }
    );

    await children.stop();
  });

  it('two parents with the same child', async () => {
    expect.assertions(16);

    const grandChildDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'grandChild',
    };
    const childDocument = {
      _id: new ObjectID().toHexString(),
      grandChild: grandChildDocument._id,
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
      grandChild: grandChildDocument._id,
    };

    root = new Link(
      MeteorPublicationMock,
      RootCollectionMock,
      {},
      (doc) => !!doc.child
    );

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

    const grandChildResolver = jest
      .fn()
      .mockImplementation((doc) => [doc.grandChild]);
    grandChild = root.link(GrandChildCollectionMock, grandChildResolver);

    const childToGrandChildResolver = jest
      .fn()
      .mockImplementation((doc) => [doc.grandChild]);
    const childToGrandChild = child.link(
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
    expect(ChildCollectionMock.find).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [childDocument._id] },
      },
      { fields: undefined }
    );

    expect(GrandChildCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(GrandChildCollectionMock.find).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [grandChildDocument._id] },
      },
      { fields: undefined }
    );

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, {
      child: childDocument._id,
      grandChild: grandChildDocument._id,
    });

    expect(grandChildResolver).toHaveBeenCalledTimes(1);
    expect(grandChildResolver).toHaveBeenNthCalledWith(1, {
      child: childDocument._id,
      grandChild: grandChildDocument._id,
    });

    expect(childToGrandChildResolver).toHaveBeenCalledTimes(1);
    expect(childToGrandChildResolver).toHaveBeenNthCalledWith(1, {
      grandChild: grandChildDocument._id,
    });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      {
        child: childDocument._id,
        grandChild: grandChildDocument._id,
      }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      { grandChild: grandChildDocument._id }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_GRANDCHILD,
      grandChildDocument._id,
      { prop: 'grandChild' }
    );

    await childToGrandChild.stop();
  });

  it('adds related child even if the child was created afterwards', async () => {
    expect.assertions(3);

    const childDocument = { _id: new ObjectID().toHexString() };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

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
      { child: childDocument._id }
    );

    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      {}
    );
  });

  it('afterwards created children are only added on the primary publication context', async () => {
    expect.assertions(7);

    const childDocument = { _id: new ObjectID().toHexString() };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await RootCollection.insertOne(rootDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);
    grandChild = root.link(ChildCollectionMock, childResolver);

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
    ).toBeTruthy();
    expect(
      grandChild.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeFalsy();

    await sleep(DEFAULT_WAIT_IN_MS);

    await ChildCollection.insertOne(childDocument);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(childSpy).toHaveBeenCalledTimes(1);
    expect(grandChildSpy).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      rootDocument._id,
      { child: childDocument._id }
    );

    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_CHILD,
      childDocument._id,
      {}
    );
  });

  it('removes children even if parent is still related', async () => {
    expect.assertions(2);

    const childDocument = { _id: new ObjectID().toHexString() };
    const unrelatedChildDocument = { _id: new ObjectID().toHexString() };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await RootCollection.insertOne(rootDocument);
    await ChildCollection.insertOne(childDocument);
    await ChildCollection.insertOne(unrelatedChildDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(ChildCollectionMock, childResolver);

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

  it('calls select from link', async () => {
    expect.assertions(1);

    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await ChildCollection.insertOne(childDocument);
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await RootCollection.insertOne(rootDocument);
    const grandChildDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await GrandChildCollection.insertOne(grandChildDocument);

    root = new Link(MeteorPublicationMock, RootCollectionMock, {}, () => true);

    child = root.link(ChildCollectionMock, (doc) => [doc.child]);

    const grandChildResolver = jest
      .fn()
      .mockImplementation((doc) => ({ group: doc.group }));

    child.select(GrandChildCollectionMock, grandChildResolver);

    root.observe();

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
  });
});
