import type { Collection } from 'mongodb';

import ChangeStreamMultiplexer from './ChangeStreamMultiplexer';
import { WatchObserveCallBack } from './types';

class ChangeStreamDeMultiplexer {
  listeners: Record<string, ChangeStreamMultiplexer>;

  constructor() {
    this.listeners = {};
  }

  addListener(
    collection: Collection,
    watchObserveCallBack: WatchObserveCallBack
  ): () => void {
    const namespace = collection.namespace.toString();

    if (!(namespace in this.listeners)) {
      this.listeners[namespace] = new ChangeStreamMultiplexer(collection);
    }
    this.listeners[namespace].addListener(watchObserveCallBack);

    const stop = (): void => {
      this.listeners[namespace].removeListener(watchObserveCallBack);
      if (!this.listeners[namespace].isWatching()) {
        delete this.listeners[namespace];
      }
    };

    return stop;
  }
}

export default ChangeStreamDeMultiplexer;
