// @ts-ignore
import EJSON from 'ejson';
import type {
  ChangeEventCR,
  ChangeEventUpdate,
  ChangeStream,
  Collection,
} from 'mongodb';

import type { MongoDoc, WatchObserveCallBacks } from './types';
import convertDottedToObject from './utils/convertDottedToObject';

const STATIC_AGGREGATION_PIPELINE = [
  {
    $match: {
      $or: [
        // don't handle inserts and deletes
        // rely on foreign key consistency
        { operationType: 'update' },
        { operationType: 'replace' },
      ],
    },
  },
];

export type ChangeEventMeteor<T extends MongoDoc = MongoDoc> =
  | ChangeEventCR<T>
  | ChangeEventUpdate<T>;

class ChangeStreamMultiplexer<T extends MongoDoc = MongoDoc> {
  private readonly listeners: Set<WatchObserveCallBacks<T>>;

  private readonly collection: Collection;

  private changeStream: ChangeStream | undefined;

  constructor(collection: Collection) {
    this.listeners = new Set();
    this.collection = collection;
  }

  public isWatching(): boolean {
    return !!this.changeStream;
  }

  private startIfNeeded(): void {
    /* istanbul ignore else */
    if (this.listeners.size && !this.changeStream) {
      this.changeStream = this.collection.watch(STATIC_AGGREGATION_PIPELINE);
      // @ts-ignore
      this.changeStream.on('change', this.onChange);
    }
  }

  private stopIfUseless(): void {
    /* istanbul ignore else */
    if (!this.listeners.size && this.changeStream) {
      this.changeStream.close();
      this.changeStream = undefined;
    }
  }

  // Todo remove JSON.stringify and mutate like EJSON.parse directly
  private onChange = (next: ChangeEventMeteor<T>): void => {
    const { _id } = next.documentKey;
    this.listeners.forEach((listener) => {
      if (next.operationType === 'update') {
        const { updatedFields: fields, removedFields } = next.updateDescription;
        // mongo doesn't support undefined
        // otherwise this could have been done in the aggregation pipeline
        removedFields.forEach((f) => {
          fields[f] = undefined;
        });

        listener.changed(
          _id,
          EJSON.parse(
            JSON.stringify(convertDottedToObject<Partial<T>>(fields))
          ),
          false,
          next
        );
      } else if (next.operationType === 'replace') {
        const { fullDocument } = next;
        if (fullDocument) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _id: unused, ...fields } = fullDocument;
          listener.changed(
            _id,
            EJSON.parse(JSON.stringify(fields)),
            true,
            next
          );
        } else {
          // Todo types say this case can happen, but it doesn't make any sense
          listener.changed(_id, {}, true, next);
        }
      }
    });
  };

  // used in tests
  public _stop(): void {
    this.listeners.clear();
    this.stopIfUseless();
  }

  public addListener = (listener: WatchObserveCallBacks<T>): void => {
    this.listeners.add(listener);
    this.startIfNeeded();
  };

  public removeListener = (listener: WatchObserveCallBacks<T>): void => {
    this.listeners.delete(listener);
    this.stopIfUseless();
  };
}

export default ChangeStreamMultiplexer;
