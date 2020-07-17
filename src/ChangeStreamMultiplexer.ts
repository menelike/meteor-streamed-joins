import type {
  ChangeEventCR,
  ChangeEventDelete,
  ChangeEventUpdate,
  ChangeStream,
  Collection,
} from 'mongodb';

import type { DefaultValue, MongoDoc, WatchObserveCallBack } from './types';

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
      'meteor.removedFieldsObject': {
        $arrayToObject: {
          $map: {
            input: '$updateDescription.removedFields',
            as: 'fieldName',
            in: {
              k: '$$fieldName',
              v: undefined,
            },
          },
        },
      },
    },
  },
  {
    $addFields: {
      'meteor.fields': {
        $mergeObjects: [
          '$fullDocument', // use when replace
          '$updateDescription.updatedFields', // used when update
          '$meteor.removedFieldsObject', // used when update
        ],
      },
    },
  },
  {
    $project: {
      'meteor.removedFieldsObject': 0,
      'meteor.fields._id': 0,
    },
  },
];

interface ChangeEventMeteorBase {
  meteor: { fields: Record<string, DefaultValue> };
}

interface ChangeEventCRMeteor
  extends ChangeEventCR<MongoDoc>,
    ChangeEventMeteorBase {}

interface ChangeEventUpdateMeteor
  extends ChangeEventUpdate<MongoDoc>,
    ChangeEventMeteorBase {}

interface ChangeEventDeleteMeteor
  extends ChangeEventDelete<MongoDoc>,
    ChangeEventMeteorBase {}

export type ChangeEventMeteor =
  | ChangeEventCRMeteor
  | ChangeEventUpdateMeteor
  | ChangeEventDeleteMeteor;

class ChangeStreamMultiplexer {
  listeners: Set<WatchObserveCallBack>;

  collection: Collection;

  changeStream: ChangeStream | undefined;

  constructor(collection: Collection) {
    this.listeners = new Set();
    this.collection = collection;
  }

  isWatching(): boolean {
    return !!this.changeStream;
  }

  startIfNeeded(): void {
    if (this.listeners.size && !this.changeStream) {
      this.changeStream = this.collection.watch(STATIC_AGGREGATION_PIPELINE);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.changeStream.on('change', this.onChange);
    }
  }

  stopIfUseless(): void {
    if (!this.listeners.size && this.changeStream) {
      this.changeStream.close();
      this.changeStream = undefined;
    }
  }

  onChange = (next: ChangeEventMeteor): void => {
    console.log(next);
    const { _id } = next.documentKey;
    const { fields } = next.meteor;
    this.listeners.forEach((listener) => {
      listener.changed(_id, fields, next);
    });
  };

  addListener = (listener: WatchObserveCallBack): void => {
    this.listeners.add(listener);
    this.startIfNeeded();
  };

  removeListener = (listener: WatchObserveCallBack): void => {
    this.listeners.delete(listener);
    this.stopIfUseless();
  };
}

export default ChangeStreamMultiplexer;
