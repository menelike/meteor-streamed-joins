import type { Collection } from 'mongodb';

import ChangeStreamMultiplexer from './ChangeStreamMultiplexer';
import type { ChangeStreamCallBacks, MongoDoc } from './types';

type StopFunc = () => void;

class ChangeStreamDeMultiplexer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly listeners: Record<string, ChangeStreamMultiplexer<any>>;

  constructor() {
    this.listeners = {};
  }

  public watch<T extends MongoDoc = MongoDoc>(
    collection: Collection<T>
  ): ChangeStreamMultiplexer<T> {
    const namespace = collection.collectionName;

    if (!(namespace in this.listeners)) {
      this.listeners[namespace] = new ChangeStreamMultiplexer<T>(collection, {
        keepRunning: true,
      });
    }

    return this.listeners[namespace];
  }

  /** @internal used for tests */
  public hasListeners = (): boolean => !!Object.keys(this.listeners).length;

  /** @internal used for tests */
  public isWatching = (namespace: string): boolean =>
    !!this.listeners[namespace];

  /** @internal */
  public addListener<T extends MongoDoc = MongoDoc>(
    collection: Collection<T>,
    changeStreamCallBacks: ChangeStreamCallBacks<T>
  ): StopFunc {
    const namespace = collection.collectionName;

    let listener = this.listeners[namespace];
    if (!listener) {
      listener = new ChangeStreamMultiplexer<T>(collection);
      this.listeners[namespace] = listener;
    }

    listener.addListener(changeStreamCallBacks);

    return this.stopFactory<T>(collection, changeStreamCallBacks);
  }

  private stopFactory = <T extends MongoDoc = MongoDoc>(
    collection: Collection<T>,
    changeStreamCallBacks: ChangeStreamCallBacks<T>
  ): StopFunc => (): void => {
    const namespace = collection.collectionName;

    const listener = this.listeners[namespace];

    if (listener) {
      listener.removeListener(changeStreamCallBacks);
      if (!listener.isWatching()) {
        delete this.listeners[namespace];
      }
    }
  };
}

export default ChangeStreamDeMultiplexer;
