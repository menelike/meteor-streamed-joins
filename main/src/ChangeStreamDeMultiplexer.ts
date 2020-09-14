import type { Collection } from 'mongodb';

import ChangeStreamMultiplexer from './ChangeStreamMultiplexer';
import type { ChangeStreamCallBacks, MongoDoc } from './types';

class ChangeStreamDeMultiplexer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly listeners: Record<string, ChangeStreamMultiplexer<any>>;

  constructor() {
    this.listeners = {};
  }

  public hasListeners = (): boolean => !!Object.keys(this.listeners).length;

  public addListener<T extends MongoDoc = MongoDoc>(
    collection: Collection<T>,
    changeStreamCallBacks: ChangeStreamCallBacks<T>
  ): () => void {
    const namespace = collection.collectionName;

    if (!(namespace in this.listeners)) {
      this.listeners[namespace] = new ChangeStreamMultiplexer<T>(collection);
    }
    this.listeners[namespace].addListener(changeStreamCallBacks);

    const stop = (): void => {
      if (namespace in this.listeners) {
        this.listeners[namespace].removeListener(changeStreamCallBacks);
        if (!this.listeners[namespace].isWatching()) {
          delete this.listeners[namespace];
        }
      }
    };

    return stop;
  }
}

export default ChangeStreamDeMultiplexer;
