import type { Collection } from 'mongodb';

import ChangeStreamMultiplexer from './ChangeStreamMultiplexer';
import type { WatchObserveCallBack } from './types';

class ChangeStreamDeMultiplexer {
  private readonly listeners: Record<string, ChangeStreamMultiplexer>;

  constructor() {
    this.listeners = {};
  }

  public hasListeners = (): boolean => !!Object.keys(this.listeners).length;

  public addListener(
    collection: Collection,
    watchObserveCallBack: WatchObserveCallBack
  ): () => void {
    const namespace = collection.namespace.toString();

    if (!(namespace in this.listeners)) {
      this.listeners[namespace] = new ChangeStreamMultiplexer(collection);
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
