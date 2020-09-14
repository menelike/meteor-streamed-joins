import type { Mongo } from 'meteor/mongo';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';

import MeteorPublicationMock from '../tests/MeteorPublicationMock';
import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';
import { waitUntilHaveBeenCalledTimes } from '../tests/waitUntil';

import Link from './Link';
import type { LinkChild } from './LinkChild';

const mongoDB = new MongoMemoryReplSet();

const DEFAULT_WAIT_IN_MS = 250;

const COLLECTION_NAME_ROOT = 'ROOT';

const COLLECTION_NAME_CHILD = 'ROOT_CHILD';

const COLLECTION_NAME_GRANDCHILD = 'ROOT_GRANDCHILD';

let root: Link | undefined;
let child: LinkChild | undefined;
let grandChild: LinkChild | undefined;

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(COLLECTION_NAME_ROOT);
  await mongoDB.db().createCollection(COLLECTION_NAME_CHILD);
  await mongoDB.db().createCollection(COLLECTION_NAME_GRANDCHILD);
});

afterEach(async () => {
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME_ROOT).deleteMany({});
  await db.collection(COLLECTION_NAME_CHILD).deleteMany({});
  await db.collection(COLLECTION_NAME_GRANDCHILD).deleteMany({});
  if (root) {
    root.stop();
    root = undefined;
  }
  if (child) {
    child.stop();
    child = undefined;
  }
  if (grandChild) {
    grandChild.stop();
    grandChild = undefined;
  }
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('LinkChild', () => {
  it('resolves root from children', () => {
    expect.assertions(2);

    const db = mongoDB.db();
    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);

    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    child = root.link(childCollectionMock, () => undefined);

    expect(child.root()).toBe(root);

    const grandChildCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_GRANDCHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    grandChild = root.link(grandChildCollectionMock, () => undefined);
    expect(grandChild.root()).toBe(root);
  });

  it('calls added on first run', () => {
    expect.assertions(8);

    const db = mongoDB.db();

    const rootCollectionMock = ({
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

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [
          { _id: 'childA', prop: 'A' },
          { _id: 'childB', prop: 'B' },
        ];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver);

    root.observe();

    expect(childResolver).toHaveBeenCalledTimes(2);
    expect(childResolver).toHaveBeenNthCalledWith(1, { child: 'childA' });
    expect(childResolver).toHaveBeenNthCalledWith(2, { child: 'childB' });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
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
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      'childA',
      { prop: 'A' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      4,
      COLLECTION_NAME_CHILD,
      'childB',
      { prop: 'B' }
    );
  });

  it('calls removed on root document remove', async () => {
    expect.assertions(3);

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await rootCollection.insertOne(rootDocument);
    await childCollection.insertOne(childDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocument];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [childDocument];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await rootCollection.deleteOne({ _id: rootDocument._id });

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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await rootCollection.insertOne(rootDocument);
    await childCollection.insertOne(childDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocument];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [childDocument];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.updateOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };
    await rootCollection.insertOne(rootDocument);
    await childCollection.insertOne(childDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocument];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [childDocument];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.replaceOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };

    await childCollection.insertOne(childDocument);
    await rootCollection.insertOne(rootDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocument];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);

    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [childDocument];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.updateOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const childDocument = {
      _id: new ObjectID().toHexString(),
      prop: 'A',
      something: 'else',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      child: childDocument._id,
    };

    await childCollection.insertOne(childDocument);
    await rootCollection.insertOne(rootDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocument];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);

    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [childDocument];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.replaceOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

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

    await childCollection.insertOne(childDocumentA);
    await childCollection.insertOne(childDocumentB);
    await rootCollection.insertOne(rootDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocument];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);

    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [childDocumentA];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.updateOne(
      { _id: childDocumentB._id },
      { $set: { prop: 'changed', something: 'different' } }
    );

    // update this only to trigger waitUntilHaveBeenCalledTimes
    await childCollection.updateOne(
      { _id: childDocumentA._id },
      { $set: { prop: 'changed' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
  });

  it('ignores replace on unrelated child document', async () => {
    expect.assertions(4);

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

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

    await childCollection.insertOne(childDocumentA);
    await childCollection.insertOne(childDocumentB);
    await rootCollection.insertOne(rootDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocument];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);

    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [childDocumentA];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.replaceOne(
      { _id: childDocumentB._id },
      { prop: 'changed' }
    );

    // replace this only to trigger waitUntilHaveBeenCalledTimes
    await childCollection.replaceOne(
      { _id: childDocumentA._id },
      { prop: 'changed' }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
  });

  it('ignores unresolved children keys', () => {
    expect.assertions(4);

    const db = mongoDB.db();

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [{ _id: 'documentA', unknownProp: 'childA' }];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.link(childCollectionMock, childResolver);

    root.observe();

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, { unknownProp: 'childA' });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      'documentA',
      { unknownProp: 'childA' }
    );
  });

  it('ignores children document add', async () => {
    expect.assertions(3);

    const db = mongoDB.db();

    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);
    const childDocument = { _id: new ObjectID().toHexString() };

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.link(childCollectionMock, childResolver);
    // @ts-ignore
    child.noop = jest.fn().mockImplementation(() => undefined);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.insertOne(childDocument);

    // @ts-ignore
    await waitUntilHaveBeenCalledTimes(child.noop, 1);
    // @ts-ignore
    expect(child.noop).toHaveBeenCalledTimes(1);
    // @ts-ignore
    expect(child.noop).toHaveBeenNthCalledWith(
      1,
      childDocument._id,
      {},
      expect.anything()
    );

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(0);
  });

  it('ignores children document remove', async () => {
    expect.assertions(3);

    const db = mongoDB.db();

    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);
    const childDocument = { _id: new ObjectID().toHexString() };
    await childCollection.insertOne(childDocument);

    const collectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, collectionMock, {}, () => true);
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation(() => undefined);
    child = root.link(childCollectionMock, childResolver);
    // @ts-ignore
    child.noop = jest.fn().mockImplementation(() => undefined);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.deleteOne({ _id: childDocument._id });

    // @ts-ignore
    await waitUntilHaveBeenCalledTimes(child.noop, 1);
    // @ts-ignore
    expect(child.noop).toHaveBeenCalledTimes(1);
    // @ts-ignore
    expect(child.noop).toHaveBeenNthCalledWith(
      1,
      childDocument._id,
      expect.anything()
    );

    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);
  });

  it('child resolves back to root', async () => {
    expect.assertions(14);

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);
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

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation((selector) => {
        return selector?._id ? [rootDocumentB, rootDocumentC] : [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(
      MeteorPublicationMock,
      rootCollectionMock,
      {},
      (doc) => !!doc.child
    );
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation((selector) => {
        return selector?._id ? [childDocument] : [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver);

    const rootResolver = jest.fn().mockImplementation((doc) => doc.roots);
    child.link(rootCollectionMock, rootResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await rootCollection.insertOne(rootDocumentB);
    await rootCollection.insertOne(rootDocumentC);
    await childCollection.insertOne(childDocument);
    await rootCollection.insertOne(rootDocumentA);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 4);

    expect(rootCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(rootCollectionMock.find).toHaveBeenNthCalledWith(1, {});
    expect(rootCollectionMock.find).toHaveBeenNthCalledWith(
      2,
      {
        _id: { $in: [rootDocumentB._id, rootDocumentC._id] },
      },
      { fields: undefined }
    );

    expect(childCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(
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
    // expect.assertions(14);

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

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

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocumentA];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(
      MeteorPublicationMock,
      rootCollectionMock,
      {},
      (doc) => !!doc.child
    );
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation((selector) => {
        return [childDocumentA, childDocumentB].filter((doc) =>
          selector?._id.$in.includes(doc._id)
        );
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest.fn().mockImplementation((doc) => [doc.child]);
    child = root.link(childCollectionMock, childResolver);

    await childCollection.insertMany([childDocumentA, childDocumentB]);
    await rootCollection.insertOne(rootDocumentA);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);

    expect(rootCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(rootCollectionMock.find).toHaveBeenNthCalledWith(1, {});

    expect(childCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(
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
    await rootCollection.updateOne(
      { _id: rootDocumentA._id },
      { $set: { child: childDocumentB._id } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(childCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(
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
});
