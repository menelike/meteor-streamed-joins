import type { Collection } from 'mongodb';

import ChangeStreamRegistry from './ChangeStreamRegistry';
import type MongoObserver from './MongoObserver';
import type { WatchObserveCallBacks, MongoDoc } from './types';
import convertDottedToObject from './utils/convertDottedToObject';
import filterFields from './utils/filterFields';
import type { FieldProjection } from './utils/filterFields';

type Options = {
  fields?: FieldProjection;
};

class ChangeStream<T extends MongoDoc = MongoDoc> {
  private readonly observer: MongoObserver<T>;

  private stopListener:
    | ReturnType<typeof ChangeStreamRegistry.addListener>
    | undefined;

  constructor(observer: MongoObserver<T>) {
    this.observer = observer;
  }

  public observe(
    drainCollection: Collection<T>,
    watchObserveCallBack: WatchObserveCallBacks<T>,
    options?: Options
  ): void {
    this.stopListener = ChangeStreamRegistry.addListener<T>(drainCollection, {
      added: () => {
        throw Error('not supported');
      },
      changed: (_id, fields, replace, next) => {
        if (!this.observer.foreignKeyRegistry.hasForeignKey(_id)) return;

        let nextFields;
        if (options?.fields) {
          nextFields = filterFields(options.fields, fields);
        } else {
          nextFields = fields;
        }
        nextFields = convertDottedToObject<T>(nextFields);

        if (Object.keys(nextFields).length) {
          watchObserveCallBack.changed(_id, nextFields, replace, next);
        }
      },
      removed: () => {
        throw Error('not supported');
      },
    });
  }

  public stop(): boolean {
    if (this.stopListener) {
      this.stopListener();
      this.stopListener = undefined;
      return true;
    }

    return false;
  }
}

export default ChangeStream;
