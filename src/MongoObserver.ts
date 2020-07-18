import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';

import ForeignKeyRegistry from './ForeignKeyRegistry';
import type {
  MeteorObserveCallbacks,
  MeteorObserveChangesCallbacks,
  MongoDoc,
  WatchObserveCallBacks,
} from './types';

class MongoObserver {
  public readonly foreignKeyRegistry: ForeignKeyRegistry;

  private firstRun: true | undefined;

  private observeHandle: Meteor.LiveQueryHandle | undefined;

  constructor() {
    this.foreignKeyRegistry = new ForeignKeyRegistry();
  }

  private handleWatchObserver(
    watchObserveCallBack: WatchObserveCallBacks
  ): void {
    if (this.foreignKeyRegistry.added.size) {
      watchObserveCallBack.added([...this.foreignKeyRegistry.added]);
    }
    if (this.foreignKeyRegistry.removed.size) {
      watchObserveCallBack.removed([...this.foreignKeyRegistry.removed]);
    }
    this.foreignKeyRegistry.clear();
  }

  public observe(
    cursor: Mongo.Cursor<MongoDoc>,
    observeCallbacks: MeteorObserveCallbacks,
    watchObserveCallBacks: WatchObserveCallBacks
  ): void {
    if (this.observeHandle) throw Error('observer already registered');

    this.firstRun = true;
    this.observeHandle = cursor.observe({
      added: (doc) => {
        const tos = observeCallbacks.added(doc);
        if (tos) this.foreignKeyRegistry.add(doc._id, tos);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBacks);
      },
      changed: (newDoc, oldDoc) => {
        const tos = observeCallbacks.changed(newDoc, oldDoc);
        if (tos) this.foreignKeyRegistry.replace(newDoc._id, tos);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBacks);
      },
      removed: (oldDoc) => {
        observeCallbacks.removed(oldDoc);
        this.foreignKeyRegistry.remove(oldDoc._id);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBacks);
      },
    });
    this.firstRun = undefined;
    this.handleWatchObserver(watchObserveCallBacks);
  }

  public observeChanges(
    cursor: Mongo.Cursor<MongoDoc>,
    observeChangesCallbacks: MeteorObserveChangesCallbacks,
    watchObserveCallBacks: WatchObserveCallBacks
  ): void {
    if (this.observeHandle) throw Error('observer already registered');

    this.firstRun = true;
    this.observeHandle = cursor.observeChanges({
      added: (id, fields) => {
        const tos = observeChangesCallbacks.added(id, fields);
        if (tos) this.foreignKeyRegistry.add(id, tos);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBacks);
      },
      changed: (id, fields) => {
        const tos = observeChangesCallbacks.changed(id, fields);
        if (tos) this.foreignKeyRegistry.replace(id, tos);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBacks);
      },
      removed: (id) => {
        observeChangesCallbacks.removed(id);
        this.foreignKeyRegistry.remove(id);
        if (!this.firstRun) this.handleWatchObserver(watchObserveCallBacks);
      },
    });
    this.firstRun = undefined;
    this.handleWatchObserver(watchObserveCallBacks);
  }

  public stop(): void {
    if (this.observeHandle) {
      this.observeHandle.stop();
      this.observeHandle = undefined;
    }
  }
}

export default MongoObserver;
