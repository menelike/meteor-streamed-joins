// @ts-ignore
import type {
  ChangeEventCR,
  ChangeEventDelete,
  ChangeEventUpdate,
  ChangeStream,
  Collection,
} from 'mongodb';

import type {
  ChangeStreamCallBacks,
  MongoDoc,
  StringOrObjectID,
} from '../types';
import bindEnvironment from '../utils/bindEnvironment';

const STATIC_AGGREGATION_PIPELINE = [
  {
    $match: {
      $or: [
        { operationType: 'insert' },
        { operationType: 'update' },
        { operationType: 'replace' },
        { operationType: 'delete' },
      ],
    },
  },
];

type ChangeEventMeteor<T> =
  | ChangeEventUpdate<T>
  | ChangeEventCR<T>
  | ChangeEventDelete<T>;

type Options = {
  keepRunning: boolean;
};

class ChangeStreamMultiplexer<T extends MongoDoc = MongoDoc> {
  private readonly listeners: Set<ChangeStreamCallBacks<T>>;

  private readonly collection: Collection;

  private changeStream: ChangeStream | undefined;

  private readonly keepRunning: boolean;

  constructor(collection: Collection, options?: Options) {
    this.listeners = new Set();
    this.collection = collection;
    this.keepRunning = !!options?.keepRunning;

    this.startIfNeeded();
  }

  public isWatching(): boolean {
    return this.keepRunning || !!this.changeStream;
  }

  private startIfNeeded(): void {
    if (this.changeStream) return;

    /* istanbul ignore else */
    if (this.keepRunning || this.listeners.size) {
      this.changeStream = this.collection.watch(STATIC_AGGREGATION_PIPELINE, {
        fullDocument: 'updateLookup',
      });
      // @ts-ignore
      this.changeStream.on('change', bindEnvironment(this.onChange));
    }
  }

  private async stopIfUseless(): Promise<void> {
    if (this.keepRunning) return;

    /* istanbul ignore else */
    if (!this.listeners.size && this.changeStream) {
      await this.changeStream.close();
      this.changeStream = undefined;
    }
  }

  private onInserted = (
    _id: StringOrObjectID,
    fields: T,
    op: ChangeEventCR<T>
  ): void => {
    this.listeners.forEach((listener) => {
      listener.added(_id, fields, op);
    });
  };

  private onChanged = (
    _id: StringOrObjectID,
    doc: T,
    op: ChangeEventUpdate<T>
  ): void => {
    this.listeners.forEach((listener) => {
      listener.changed(_id, doc, op);
    });
  };

  private onReplaced = (
    _id: StringOrObjectID,
    doc: T,
    op: ChangeEventCR<T>
  ): void => {
    this.listeners.forEach((listener) => {
      listener.replaced(_id, doc, op);
    });
  };

  private onRemoved = (
    _id: StringOrObjectID,
    op: ChangeEventDelete<T>
  ): void => {
    this.listeners.forEach((listener) => {
      listener.removed(_id, op);
    });
  };

  private onChange = (next: ChangeEventMeteor<T>): void => {
    const { _id } = next.documentKey;
    if (next.operationType === 'update') {
      const { fullDocument } = next;
      // if the fullDocument is not present on insert/update/replace
      // it must have been removed in the meantime, so do nothing
      // and wait for the delete event to happen
      if (!fullDocument) return;

      this.onChanged(_id, fullDocument, next);
    } else if (next.operationType === 'replace') {
      const { fullDocument } = next;
      // this should never happen per spec, but might happen by type
      if (!fullDocument) return;

      this.onReplaced(_id, fullDocument, next);
    } else if (next.operationType === 'insert') {
      const { fullDocument } = next;
      // this should never happen per spec, but might happen by type
      if (!fullDocument) return;

      this.onInserted(_id, fullDocument, next);
    } else if (next.operationType === 'delete') {
      this.onRemoved(_id, next);
    }
  };

  // used in tests
  public async _stop(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = undefined;
    }
    this.listeners.clear();
  }

  public addListener = (listener: ChangeStreamCallBacks<T>): void => {
    this.listeners.add(listener);
    this.startIfNeeded();
  };

  public removeListener = async (
    listener: ChangeStreamCallBacks<T>
  ): Promise<void> => {
    this.listeners.delete(listener);
    await this.stopIfUseless();
  };
}

export default ChangeStreamMultiplexer;
