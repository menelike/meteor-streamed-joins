/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Mongo } from 'meteor/mongo';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ObjectID } from 'mongodb';

import MeteorPublicationMock from '../tests/MeteorPublicationMock';
import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';
import sleep from '../tests/sleep';
import { waitUntilHaveBeenCalledTimes } from '../tests/waitUntil';

import DocumentMatcher from './DocumentMatcher';
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

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(COLLECTION_NAME_ROOT);
  await mongoDB.db().createCollection(COLLECTION_NAME_CHILD);
  await mongoDB.db().createCollection(COLLECTION_NAME_GRANDCHILD);
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation((doc) =>
        doc.group
          ? new DocumentMatcher(
              { group: doc.group },
              (d) => d.group === doc.group
            )
          : undefined
      );

    child = root.select(childCollectionMock, childResolver);

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

    await rootCollection.updateOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );

    child = root.select(childCollectionMock, childResolver);

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

    await childCollection.updateOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );

    child = root.select(childCollectionMock, childResolver);

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

    await childCollection.replaceOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );

    child = root.select(childCollectionMock, childResolver);

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

    await childCollection.updateOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );

    child = root.select(childCollectionMock, childResolver);

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

    await childCollection.replaceOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );

    child = root.select(childCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    // @ts-ignore
    await waitUntilHaveBeenCalledTimes(childCollectionMock.find, 1);

    expect(childCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);

    await rootCollection.updateOne(
      { _id: rootDocument._id },
      { $set: { some: 'thing' } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);

    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);

    expect(childCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
  });

  it('an unmatched added child is not published', async () => {
    expect.assertions(2);

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };

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
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );

    child = root.select(childCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);

    await childCollection.insertOne(childDocument);

    await sleep(DEFAULT_WAIT_IN_MS);

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
  });

  it('two parents match, after an child update only one parent matches', async () => {
    expect.assertions(9);

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    const rootDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    await rootCollection.insertMany([rootDocumentA, rootDocumentB]);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      groups: [rootDocumentA.group, rootDocumentB.group],
    };
    await childCollection.insertOne(childDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocumentA, rootDocumentB];
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher({ groups: doc.group }, (d) =>
            d.groups.includes(doc.group)
          )
      );

    child = root.select(childCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(0);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await childCollection.updateOne(
      { _id: childDocument._id },
      { $pull: { groups: rootDocumentA.group } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.changed, 1);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.changed).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await childCollection.updateOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocumentA = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    const rootDocumentB = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    await rootCollection.insertMany([rootDocumentA, rootDocumentB]);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      groups: [rootDocumentA.group, rootDocumentB.group],
    };
    await childCollection.insertOne(childDocument);

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocumentA, rootDocumentB];
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher({ groups: doc.group }, (d) =>
            d.groups.includes(doc.group)
          )
      );

    child = root.select(childCollectionMock, childResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(0);

    await childCollection.replaceOne(
      { _id: childDocument._id },
      { groups: [rootDocumentB.group] }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 4);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(1);

    await childCollection.replaceOne(
      { _id: childDocument._id },
      { groups: [] }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.removed, 2);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.removed).toHaveBeenCalledTimes(2);
  });

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
    child = root.select(childCollectionMock, () => undefined);

    expect(child.root()).toBe(root);

    const grandChildCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_GRANDCHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;

    grandChild = root.select(grandChildCollectionMock, () => undefined);
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
          { _id: 'documentA', group: 'groupA' },
          { _id: 'documentB', group: 'groupB' },
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
          { _id: 'childA', group: 'groupA' },
          { _id: 'childB', group: 'groupB' },
        ];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

    root.observe();

    expect(childResolver).toHaveBeenCalledTimes(2);
    expect(childResolver).toHaveBeenNthCalledWith(1, { group: 'groupA' });
    expect(childResolver).toHaveBeenNthCalledWith(2, { group: 'groupB' });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(4);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      'documentA',
      { group: 'groupA' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      2,
      COLLECTION_NAME_ROOT,
      'documentB',
      { group: 'groupB' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      3,
      COLLECTION_NAME_CHILD,
      'childA',
      { group: 'groupA' }
    );
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      4,
      COLLECTION_NAME_CHILD,
      'childB',
      { group: 'groupB' }
    );
  });

  it('calls removed on root document remove', async () => {
    expect.assertions(3);

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );

    child = root.select(childCollectionMock, childResolver);

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

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

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

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

    root.observe();
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.replaceOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver, {
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

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      something: 'else',
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.replaceOne(
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
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
    await childCollection.insertMany([childDocumentA, childDocumentB]);

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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver, {
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

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
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
    await childCollection.insertMany([childDocumentA, childDocumentB]);

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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver, {
      fields: { prop: 1 },
    });

    root.observe();

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(2);

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.replaceOne(
      { _id: childDocumentB._id },
      { group: 'B', prop: 'changed' }
    );

    // replace this only to trigger waitUntilHaveBeenCalledTimes
    await childCollection.replaceOne(
      { _id: childDocumentA._id },
      { group: 'A', prop: 'changed' }
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
        return [{ _id: 'documentA', group: 'A' }];
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
    child = root.select(childCollectionMock, childResolver);

    root.observe();

    expect(childResolver).toHaveBeenCalledTimes(1);
    expect(childResolver).toHaveBeenNthCalledWith(1, { group: 'A' });

    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(1);
    expect(MeteorPublicationMock.added).toHaveBeenNthCalledWith(
      1,
      COLLECTION_NAME_ROOT,
      'documentA',
      { group: 'A' }
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
    child = root.select(childCollectionMock, childResolver);
    // @ts-ignore
    child.added = jest.fn().mockImplementation(() => undefined);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.insertOne(childDocument);

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
    child = root.select(childCollectionMock, childResolver);
    // @ts-ignore
    child.removed = jest.fn().mockImplementation(() => undefined);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.deleteOne({ _id: childDocument._id });

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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

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
    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation((selector) => {
        if (selector?.group === 'A') {
          return [rootDocumentA];
        }

        if (selector?.$or) {
          return [rootDocumentA, rootDocumentB, rootDocumentC];
        }

        return [];
        // return selector?._id ? [rootDocumentB, rootDocumentC] : [];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(
      MeteorPublicationMock,
      rootCollectionMock,
      { group: 'A' },
      (doc) => doc.group === 'A'
    );
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation((selector) => {
        return selector?.$or ? [childDocument] : [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher({ groups: doc.group }, (d) =>
            d.groups.includes(doc.group)
          )
      );
    child = root.select(childCollectionMock, childResolver);
    const rootResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher({ group: { $in: doc.groups } }, (d) =>
            doc.groups.includes(d.group)
          )
      );
    child.select(rootCollectionMock, rootResolver);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await rootCollection.insertOne(rootDocumentB);
    await rootCollection.insertOne(rootDocumentC);
    await childCollection.insertOne(childDocument);
    await rootCollection.insertOne(rootDocumentA);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 4);

    expect(rootCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(rootCollectionMock.find).toHaveBeenNthCalledWith(1, {
      group: 'A',
    });
    expect(rootCollectionMock.find).toHaveBeenNthCalledWith(2, {
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

    expect(childCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(1, {
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

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
      (doc) => !!doc.group
    );
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation((selector) => {
        if (selector?.$or[0].group === childDocumentA.group) {
          return [childDocumentA];
        }

        if (selector?.$or[0].group === childDocumentB.group) {
          return [childDocumentB];
        }
        console.log(selector);
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

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
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(1, {
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
    await rootCollection.updateOne(
      { _id: rootDocumentA._id },
      { $set: { group: childDocumentB.group } }
    );

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(childCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(2, {
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

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

    const rootCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_ROOT);
      }),
      find: jest.fn().mockImplementation(() => {
        return [rootDocumentA];
      }),
    } as unknown) as Mongo.Collection<any>;

    root = new Link(MeteorPublicationMock, rootCollectionMock, {}, () => true);
    const childCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_CHILD);
      }),
      find: jest.fn().mockImplementation((selector) => {
        if (selector?.$or[0].group === 'A') {
          return [childDocumentA];
        }
        if (selector?.$or[0].group.$in.length === 2) {
          return [childDocumentA, childDocumentB];
        }
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => doc.group === d.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

    const childrenResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher({ group: { $in: doc.groups } }, (d) =>
            doc.groups.includes(d.group)
          )
      );
    const children = root.select(childCollectionMock, childrenResolver);

    await childCollection.insertMany([childDocumentA, childDocumentB]);
    await rootCollection.insertOne(rootDocumentA);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(rootCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(rootCollectionMock.find).toHaveBeenNthCalledWith(1, {});

    expect(childCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(1, {
      $or: [{ group: 'A' }],
    });
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(2, {
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);
    const grandChildCollection = mongoDB
      .db()
      .collection(COLLECTION_NAME_GRANDCHILD);

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
      find: jest.fn().mockImplementation((selector) => {
        if (selector?.$or[0].group === 'A') {
          return [childDocument];
        }
        console.log(selector);

        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

    const grandChildCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_GRANDCHILD);
      }),
      find: jest.fn().mockImplementation((selector) => {
        if (selector?.$or[0].group === 'B') {
          return [grandChildDocument];
        }
        console.log(selector);
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const grandChildResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.grandGroup },
            (d) => d.group === doc.grandGroup
          )
      );
    grandChild = root.select(grandChildCollectionMock, grandChildResolver);

    const childToGrandChildResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.grandGroup },
            (d) => d.group === doc.grandGroup
          )
      );
    const childToGrandChild = child.select(
      grandChildCollectionMock,
      childToGrandChildResolver
    );

    await grandChildCollection.insertOne(grandChildDocument);
    await childCollection.insertOne(childDocument);
    await rootCollection.insertOne(rootDocument);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);

    expect(rootCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(rootCollectionMock.find).toHaveBeenNthCalledWith(1, {});

    expect(childCollectionMock.find).toHaveBeenCalledTimes(1);
    expect(childCollectionMock.find).toHaveBeenNthCalledWith(1, {
      $or: [{ group: 'A' }],
    });

    expect(grandChildCollectionMock.find).toHaveBeenCalledTimes(2);
    expect(grandChildCollectionMock.find).toHaveBeenNthCalledWith(1, {
      $or: [{ group: 'B' }],
    });
    expect(grandChildCollectionMock.find).toHaveBeenNthCalledWith(2, {
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const childDocument = { _id: new ObjectID().toHexString(), group: 'A' };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(childDocument);

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
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.insertOne(childDocument);

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
    expect.assertions(8);

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const childDocument = { _id: new ObjectID().toHexString(), group: 'A' };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(childDocument);

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
        return [];
      }),
    } as unknown) as Mongo.Collection<any>;
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);
    grandChild = root.select(childCollectionMock, childResolver);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    // @ts-ignore otherwise we can not enforce the added call to
    // grandChild.added() to pass since the id is removed in child.added()
    child.publicationContext.commitAdded = jest.fn();

    expect(
      child.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeFalsy();
    expect(
      grandChild.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeFalsy();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.insertOne(childDocument);

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 2);
    expect(
      child.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeTruthy();
    expect(
      grandChild.publicationContext.isPrimaryForChildId(childDocument._id)
    ).toBeFalsy();
    // make sure that child.publicationContext.commitAdded() has been
    // overriden correctly
    expect(child.publicationContext.addedChildrenIds).toEqual(
      new Set([childDocument._id])
    );
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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);

    const childDocument = { _id: new ObjectID().toHexString(), group: 'A' };
    const unrelatedChildDocument = {
      _id: new ObjectID().toHexString(),
      group: 'B',
    };
    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    await childCollection.insertOne(childDocument);
    await childCollection.insertOne(unrelatedChildDocument);

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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

    // wait some time otherwise observer fires an insert
    await sleep(DEFAULT_WAIT_IN_MS);

    root.observe();

    await sleep(DEFAULT_WAIT_IN_MS);

    await childCollection.deleteOne({ _id: unrelatedChildDocument._id });
    await childCollection.deleteOne({ _id: childDocument._id });

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

    const db = mongoDB.db();

    const rootCollection = mongoDB.db().collection(COLLECTION_NAME_ROOT);
    const childCollection = mongoDB.db().collection(COLLECTION_NAME_CHILD);
    const grandChildCollection = mongoDB
      .db()
      .collection(COLLECTION_NAME_GRANDCHILD);

    const rootDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
    };
    await rootCollection.insertOne(rootDocument);
    const grandChildDocument = {
      _id: new ObjectID().toHexString(),
    };
    await grandChildCollection.insertOne(grandChildDocument);
    const childDocument = {
      _id: new ObjectID().toHexString(),
      group: 'A',
      child: grandChildDocument._id,
    };
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
    const childResolver = jest
      .fn()
      .mockImplementation(
        (doc) =>
          new DocumentMatcher(
            { group: doc.group },
            (d) => d.group === doc.group
          )
      );
    child = root.select(childCollectionMock, childResolver);

    const grandChildCollectionMock = ({
      rawCollection: jest.fn().mockImplementation(() => {
        return db.collection(COLLECTION_NAME_GRANDCHILD);
      }),
      find: jest.fn().mockImplementation(() => {
        return [grandChildDocument];
      }),
    } as unknown) as Mongo.Collection<any>;

    child.link(grandChildCollectionMock, (doc) => [doc.child]);

    root.observe();

    await waitUntilHaveBeenCalledTimes(MeteorPublicationMock.added, 3);
    expect(MeteorPublicationMock.added).toHaveBeenCalledTimes(3);
  });
});
