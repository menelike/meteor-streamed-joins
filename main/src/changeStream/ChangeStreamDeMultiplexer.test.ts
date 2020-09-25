/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Collection } from 'mongodb';

import MongoMemoryReplSet from '../../tests/MongoMemoryReplSet';
import { ChangeStreamCallBacks } from '../types';

import ChangeStreamDeMultiplexer from './ChangeStreamDeMultiplexer';

const mongoDB = new MongoMemoryReplSet();

const COLLECTION_NAME = 'test';

const OTHER_COLLECTION_NAME = 'other_test';

let deMultiplexer: ChangeStreamDeMultiplexer | undefined;

let TestCollection: Collection<any>;
let OtherTestCollection: Collection<any>;

beforeAll(async () => {
  await mongoDB.connect();
  TestCollection = await mongoDB.db().createCollection(COLLECTION_NAME);
  OtherTestCollection = await mongoDB
    .db()
    .createCollection(OTHER_COLLECTION_NAME);
});

afterEach(async () => {
  if (deMultiplexer) {
    await deMultiplexer._stop();
    deMultiplexer = undefined;
  }
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME).deleteMany({});
  await db.collection(OTHER_COLLECTION_NAME).deleteMany({});
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

const createListenerMock = (): ChangeStreamCallBacks => ({
  added: jest.fn(),
  changed: jest.fn(),
  replaced: jest.fn(),
  removed: jest.fn(),
});

describe('ChangeStreamDeMultiplexer', () => {
  it('registers a new collection', async () => {
    expect.assertions(3);

    deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop = deMultiplexer.addListener(
      TestCollection,
      createListenerMock()
    );
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('do not register the same listener twice', async () => {
    expect.assertions(4);

    deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const listener = createListenerMock();
    const stop1 = deMultiplexer.addListener(TestCollection, listener);
    const stop2 = deMultiplexer.addListener(TestCollection, listener);
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop1();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
    await stop2();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('do not register the same collection twice', async () => {
    expect.assertions(4);

    deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop1 = deMultiplexer.addListener(
      TestCollection,
      createListenerMock()
    );
    const stop2 = deMultiplexer.addListener(
      TestCollection,
      createListenerMock()
    );
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop1();
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop2();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('registers changeStream statically', async () => {
    expect.assertions(7);

    const deMultiplexerStatic = new ChangeStreamDeMultiplexer();

    deMultiplexerStatic.watch(TestCollection);

    expect(deMultiplexerStatic.hasListeners()).toBeTruthy();
    let stop = deMultiplexerStatic.addListener(
      TestCollection,
      createListenerMock()
    );
    await stop();
    expect(deMultiplexerStatic.hasListeners()).toBeTruthy();
    expect(
      deMultiplexerStatic.isWatching(TestCollection.collectionName)
    ).toBeTruthy();
    await deMultiplexerStatic._stop();

    deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    stop = deMultiplexer.addListener(OtherTestCollection, createListenerMock());
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
    expect(
      deMultiplexer.isWatching(OtherTestCollection.collectionName)
    ).toBeFalsy();
  });

  it('do not registers changeStream statically twice', async () => {
    expect.assertions(1);

    deMultiplexer = new ChangeStreamDeMultiplexer();

    const watch1 = deMultiplexer.watch(TestCollection);
    const watch2 = deMultiplexer.watch(TestCollection);

    expect(watch1).toBe(watch2);

    await deMultiplexer._stop();
  });

  it('removes all listeners on stop', async () => {
    expect.assertions(2);

    deMultiplexer = new ChangeStreamDeMultiplexer();

    deMultiplexer.watch(TestCollection);
    deMultiplexer.addListener(TestCollection, createListenerMock());

    expect(deMultiplexer.hasListeners()).toBeTruthy();

    await deMultiplexer._stop();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });
});
