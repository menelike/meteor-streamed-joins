// @ts-ignore
import EJSON from 'ejson';
import type {
  ChangeEventCR,
  ChangeEventDelete,
  ChangeEventUpdate,
  ChangeStream,
  Collection,
} from 'mongodb';

import type { ChangeStreamCallBacks, MongoDoc, WithoutId } from './types';
import convertDottedToObject from './utils/convertDottedToObject';

const bindEnvironment =
  // eslint-disable-next-line @typescript-eslint/ban-types
  global.Meteor?.bindEnvironment || (<T = Function>(func: T): T => func);

interface FullDocumentChangeEventUpdate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends { [key: string]: any } = any
> extends ChangeEventUpdate<TSchema> {
  fullDocument: TSchema;
}

interface FullDocumentChangeEventCR<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends { [key: string]: any } = any
> extends ChangeEventCR<TSchema> {
  fullDocument: TSchema;
}

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

export type ChangeEventMeteor<T extends MongoDoc = MongoDoc> =
  | FullDocumentChangeEventCR<T>
  | FullDocumentChangeEventUpdate<T>
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

  private stopIfUseless(): void {
    if (this.keepRunning) return;

    /* istanbul ignore else */
    if (!this.listeners.size && this.changeStream) {
      this.changeStream.close();
      this.changeStream = undefined;
    }
  }

  private onInserted = (
    _id: string,
    fields: Partial<WithoutId<T>>,
    op: ChangeEventCR<T>
  ): void => {
    this.listeners.forEach((listener) => {
      listener.added(_id, fields, op);
    });
  };

  private onChanged = (
    _id: string,
    fields: Partial<WithoutId<T>>,
    doc: WithoutId<T>,
    op: ChangeEventUpdate<T>
  ): void => {
    this.listeners.forEach((listener) => {
      listener.changed(_id, fields, doc, op);
    });
  };

  private onReplaced = (
    _id: string,
    doc: WithoutId<T>,
    op: ChangeEventCR<T>
  ): void => {
    this.listeners.forEach((listener) => {
      listener.replaced(_id, doc, op);
    });
  };

  private onRemoved = (_id: string, op: ChangeEventDelete<T>): void => {
    this.listeners.forEach((listener) => {
      listener.removed(_id, op);
    });
  };

  private onChange = (next: ChangeEventMeteor<T>): void => {
    const { _id } = next.documentKey;
    if (next.operationType === 'update') {
      const { updatedFields: fields, removedFields } = next.updateDescription;
      // mongo doesn't support undefined
      // otherwise this could have been done in the aggregation pipeline
      removedFields.forEach((f) => {
        fields[f] = undefined;
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id: unused, ...fullDocument } = next.fullDocument;

      this.onChanged(
        _id,
        EJSON.parse(JSON.stringify(convertDottedToObject<Partial<T>>(fields))),
        EJSON.parse(
          JSON.stringify(convertDottedToObject<Partial<T>>(fullDocument))
        ),
        next
      );
    } else if (next.operationType === 'replace') {
      const { fullDocument } = next;
      if (fullDocument) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id: unused, ...fields } = fullDocument;
        this.onReplaced(_id, EJSON.parse(JSON.stringify(fields)), next);
      } else {
        throw Error('received replace OP without a full document');
      }
    } else if (next.operationType === 'insert') {
      const { fullDocument } = next;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id: unused, ...doc } = fullDocument;
      this.onInserted(_id, EJSON.parse(JSON.stringify(doc)), next);
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

  public removeListener = (listener: ChangeStreamCallBacks<T>): void => {
    this.listeners.delete(listener);
    this.stopIfUseless();
  };
}

export default ChangeStreamMultiplexer;
