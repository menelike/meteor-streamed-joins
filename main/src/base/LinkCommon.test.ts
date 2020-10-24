/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Mongo } from 'meteor/mongo';
import type { Collection } from 'mongodb';

import MeteorPublicationMock from '../../tests/MeteorPublicationMock';
import MongoMemoryReplSet from '../../tests/MongoMemoryReplSet';

import { LinkCommon } from './LinkCommon';

const CollectionName = 'LinkCommonTestCollection';

const meteorPublicationMock = new MeteorPublicationMock();

const mongoDB = new MongoMemoryReplSet();

let TestCollection: Collection<any>;

let TestCollectionMock: Mongo.Collection<any>;

beforeAll(async () => {
  await mongoDB.connect();
  TestCollection = await mongoDB.db().createCollection(CollectionName);
  TestCollectionMock = await mongoDB.mongoShell(TestCollection);
});

afterEach(async () => {
  const db = mongoDB.db();
  await db.collection(CollectionName).deleteMany({});

  meteorPublicationMock.stop();
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('LinkCommon', () => {
  it('diffs changed document with published document', () => {
    expect.assertions(7);

    const context = new LinkCommon(
      meteorPublicationMock,
      TestCollectionMock,
      undefined
    );

    expect(
      context.diffDocumentWithPublished('noViewRegistered', {
        _id: 'noViewRegistered',
        foo: 'bar',
      })
    ).toStrictEqual({ foo: 'bar' });

    meteorPublicationMock.added(CollectionName, 'a', {
      some: 'value',
      other: 'field',
    });

    expect(
      context.diffDocumentWithPublished('unknown', {
        _id: 'unknown',
        foo: 'bar',
      })
    ).toStrictEqual({ foo: 'bar' });

    expect(
      context.diffDocumentWithPublished('a', {
        _id: 'a',
        some: 'value',
        other: 'field',
      })
    ).toStrictEqual({});

    expect(
      context.diffDocumentWithPublished('a', {
        _id: 'a',
        some: 'value',
        new: 'field',
      })
    ).toStrictEqual({
      new: 'field',
      other: undefined,
    });

    // make sure ejson equality checks work for dates
    const now = Date.now();
    const date1 = new Date(now);
    const date2 = new Date(now);
    const newDate = new Date(now + 1);

    meteorPublicationMock.added(CollectionName, 'b', {
      date: date1,
    });

    expect(
      context.diffDocumentWithPublished('b', {
        _id: 'b',
        date: date1,
      })
    ).toStrictEqual({});

    expect(
      context.diffDocumentWithPublished('b', {
        _id: 'b',
        date: date2,
      })
    ).toStrictEqual({});

    expect(
      context.diffDocumentWithPublished('b', {
        _id: 'b',
        date: newDate,
      })
    ).toStrictEqual({ date: newDate });
  });

  it('diffs filtered changed document with published document', () => {
    expect.assertions(3);

    const context = new LinkCommon(meteorPublicationMock, TestCollectionMock, {
      fields: { some: 1 },
    });

    meteorPublicationMock.added(CollectionName, 'a', {
      some: 'value',
    });

    expect(
      context.diffDocumentWithPublished('a', {
        _id: 'a',
        some: 'value',
      })
    ).toStrictEqual({});

    expect(
      context.diffDocumentWithPublished('a', {
        _id: 'a',
        other: 'field',
      })
    ).toStrictEqual({ some: undefined });

    expect(
      context.diffDocumentWithPublished('a', {
        _id: 'a',
        some: 'changed',
      })
    ).toStrictEqual({
      some: 'changed',
    });
  });

  it('document not in current subscription', () => {
    expect.assertions(1);

    const context = new LinkCommon(
      meteorPublicationMock,
      TestCollectionMock,
      undefined
    );

    meteorPublicationMock._session.collectionViews.set(CollectionName, {
      documents: new Map(),
    });
    meteorPublicationMock._session.collectionViews
      .get(CollectionName)
      .documents.set('a', {
        existsIn: new Set(['unknownSubscriptionId']),
        getFields: () => ({
          some: 'value',
        }),
      });

    expect(
      context.diffDocumentWithPublished('a', {
        _id: 'a',
        some: 'value',
      })
    ).toStrictEqual({ some: 'value' });
  });
});
