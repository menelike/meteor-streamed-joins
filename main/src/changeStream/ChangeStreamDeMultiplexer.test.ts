import MongoMemoryReplSet from '../../tests/MongoMemoryReplSet';
import { ChangeStreamCallBacks } from '../types';

import ChangeStreamDeMultiplexer from './ChangeStreamDeMultiplexer';

const mongoDB = new MongoMemoryReplSet();

const COLLECTION_NAME = 'test';

let deMultiplexer: ChangeStreamDeMultiplexer | undefined;

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(COLLECTION_NAME);
});

afterEach(async () => {
  if (deMultiplexer) {
    await deMultiplexer._stop();
    deMultiplexer = undefined;
  }
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME).deleteMany({});
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

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop = deMultiplexer.addListener(collection, createListenerMock());
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('do not register the same listener twice', async () => {
    expect.assertions(4);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const listener = createListenerMock();
    const stop1 = deMultiplexer.addListener(collection, listener);
    const stop2 = deMultiplexer.addListener(collection, listener);
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop1();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
    await stop2();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('do not register the same collection twice', async () => {
    expect.assertions(4);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop1 = deMultiplexer.addListener(collection, createListenerMock());
    const stop2 = deMultiplexer.addListener(collection, createListenerMock());
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop1();
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop2();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('registers changeStream statically', async () => {
    expect.assertions(7);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const otherCollection = mongoDB.db().collection('otherCollection');
    const deMultiplexerStatic = new ChangeStreamDeMultiplexer();

    deMultiplexerStatic.watch(collection);

    expect(deMultiplexerStatic.hasListeners()).toBeTruthy();
    let stop = deMultiplexerStatic.addListener(
      collection,
      createListenerMock()
    );
    await stop();
    expect(deMultiplexerStatic.hasListeners()).toBeTruthy();
    expect(
      deMultiplexerStatic.isWatching(collection.collectionName)
    ).toBeTruthy();
    await deMultiplexerStatic._stop();

    deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    stop = deMultiplexer.addListener(otherCollection, createListenerMock());
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    await stop();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
    expect(
      deMultiplexer.isWatching(otherCollection.collectionName)
    ).toBeFalsy();
  });

  it('do not registers changeStream statically twice', async () => {
    expect.assertions(1);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    deMultiplexer = new ChangeStreamDeMultiplexer();

    const watch1 = deMultiplexer.watch(collection);
    const watch2 = deMultiplexer.watch(collection);

    expect(watch1).toBe(watch2);

    await deMultiplexer._stop();
  });

  it('removes all listeners on stop', async () => {
    expect.assertions(2);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    deMultiplexer = new ChangeStreamDeMultiplexer();

    deMultiplexer.watch(collection);
    deMultiplexer.addListener(collection, createListenerMock());

    expect(deMultiplexer.hasListeners()).toBeTruthy();

    await deMultiplexer._stop();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });
});