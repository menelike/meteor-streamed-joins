import type { Mongo } from 'meteor/mongo';

import ForeignKeyRegistry from './ForeignKeyRegistry';
import type {
  MeteorObserverChanges,
  MongoDoc,
  WatchObserveCallBack,
} from './types';

type ObserveHandle = { stop: () => void };

class MongoObserver {
  foreignKeyRegistry: ForeignKeyRegistry;

  firstRun: true | undefined;

  observeHandle: ObserveHandle | undefined;

  constructor() {
    this.foreignKeyRegistry = new ForeignKeyRegistry();
  }

  handleWatchObserver(watchObserveCallBack: WatchObserveCallBack): void {
    if (this.foreignKeyRegistry.added.size)
      watchObserveCallBack.added([...this.foreignKeyRegistry.added]);
    if (this.foreignKeyRegistry.removed.size)
      watchObserveCallBack.removed([...this.foreignKeyRegistry.removed]);
    this.foreignKeyRegistry.clear();
  }

  observe(
    cursor: Mongo.Cursor<MongoDoc>,
    observeChangesCallback: MeteorObserverChanges,
    watchObserveCallBack: WatchObserveCallBack
  ): void {
    this.firstRun = true;
    this.observeHandle = cursor.observe({
      added: (doc: MongoDoc) => {
        const tos = observeChangesCallback.added(doc);
        this.foreignKeyRegistry.add(doc._id, tos);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBack);
      },
      changed: (newDoc: MongoDoc, oldDoc: MongoDoc) => {
        const tos = observeChangesCallback.changed(newDoc, oldDoc);
        this.foreignKeyRegistry.add(newDoc._id, tos);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBack);
      },
      removed: (oldDoc: MongoDoc) => {
        observeChangesCallback.removed(oldDoc);
        this.foreignKeyRegistry.remove(oldDoc._id);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBack);
      },
    });
    this.firstRun = undefined;
    this.handleWatchObserver(watchObserveCallBack);
  }

  stop(): void {
    if (this.observeHandle) this.observeHandle.stop();
  }
}

export default MongoObserver;
