import type {
  ChangeEventCR,
  ChangeEventDelete,
  ChangeEventUpdate,
  ChangeStream,
  Collection,
} from 'mongodb';

import type { DefaultDoc, MongoDoc, WatchObserveCallBacks } from './types';

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
  {
    $addFields: {
      'meteor.fields': {
        $mergeObjects: [
          '$fullDocument', // use when replace
          '$updateDescription.updatedFields', // used when update
        ],
      },
    },
  },
  {
    $project: {
      'meteor.fields._id': 0,
    },
  },
];

interface ChangeEventMeteorBase<T> {
  meteor: { fields: Partial<T> & DefaultDoc };
}

interface ChangeEventCRMeteor<T extends MongoDoc = MongoDoc>
  extends ChangeEventCR<T>,
    ChangeEventMeteorBase<T> {}

interface ChangeEventUpdateMeteor<T extends MongoDoc = MongoDoc>
  extends ChangeEventUpdate<T>,
    ChangeEventMeteorBase<T> {}

interface ChangeEventDeleteMeteor<T extends MongoDoc = MongoDoc>
  extends ChangeEventDelete<T>,
    ChangeEventMeteorBase<T> {}

export type ChangeEventMeteor<T extends MongoDoc = MongoDoc> =
  | ChangeEventCRMeteor<T>
  | ChangeEventUpdateMeteor<T>
  | ChangeEventDeleteMeteor<T>;

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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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

  private onChange = (next: ChangeEventMeteor<T>): void => {
    const { _id } = next.documentKey;
    const { fields } = next.meteor;
    this.listeners.forEach((listener) => {
      if (
        next.operationType === 'update' &&
        Array.isArray(next.updateDescription.removedFields)
      ) {
        // mongo doesn't support undefined
        // otherwise this could have been done in the aggregation pipeline
        next.updateDescription.removedFields.forEach((f) => {
          fields[f] = undefined;
        });
      }
      listener.changed(_id, fields, next.operationType === 'replace', next);
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
