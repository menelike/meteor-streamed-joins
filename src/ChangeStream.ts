import type { Collection } from 'mongodb';

import ChangeStreamRegistry from './ChangeStreamRegistry';
import type MongoObserver from './MongoObserver';
import type { WatchObserveCallBack } from './types';
import convertDottedToObject from './utils/convertDottedToObject';
import filterFields from './utils/filterFields';
import type { FieldProjection } from './utils/filterFields';

type Options = {
  fields?: FieldProjection;
};

class ChangeStream {
  private readonly observer: MongoObserver;

  private stopListener:
    | ReturnType<typeof ChangeStreamRegistry.addListener>
    | undefined;

  constructor(observer: MongoObserver) {
    this.observer = observer;
  }

  public observe(
    drainCollection: Collection,
    watchObserveCallBack: WatchObserveCallBack,
    options?: Options
  ): void {
    this.stopListener = ChangeStreamRegistry.addListener(drainCollection, {
      added: () => {
        throw Error('not supported');
      },
      changed: (_id, fields, next) => {
        if (!this.observer.foreignKeyRegistry.hasForeignKey(_id)) return;
        let nextFields = fields;
        if (options?.fields) {
          nextFields = filterFields(options.fields, nextFields);
        }

        nextFields = convertDottedToObject(nextFields);

        if (Object.keys(nextFields).length) {
          watchObserveCallBack.changed(_id, nextFields, next);
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
