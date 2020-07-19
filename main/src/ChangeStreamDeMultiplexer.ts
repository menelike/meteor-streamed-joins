import type { Collection } from 'mongodb';

import ChangeStreamMultiplexer from './ChangeStreamMultiplexer';
import type { WatchObserveCallBacks, MongoDoc } from './types';

class ChangeStreamDeMultiplexer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly listeners: Record<string, ChangeStreamMultiplexer<any>>;

  constructor() {
    this.listeners = {};
  }

  public hasListeners = (): boolean => !!Object.keys(this.listeners).length;

  public addListener<T extends MongoDoc = MongoDoc>(
    collection: Collection<T>,
    watchObserveCallBack: WatchObserveCallBacks<T>
  ): () => void {
    const namespace = collection.namespace.toString();

    if (!(namespace in this.listeners)) {
      this.listeners[namespace] = new ChangeStreamMultiplexer<T>(collection);
    }
    this.listeners[namespace].addListener(watchObserveCallBack);

    const stop = (): void => {
      if (namespace in this.listeners) {
        this.listeners[namespace].removeListener(watchObserveCallBack);
        if (!this.listeners[namespace].isWatching()) {
          delete this.listeners[namespace];
        }
      }
    };

    return stop;
  }
}

export default ChangeStreamDeMultiplexer;
