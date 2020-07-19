import type { ChangeEventMeteor } from './ChangeStreamMultiplexer';

export type DefaultDoc = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface MongoDoc extends DefaultDoc {
  _id: string;
}

export type MeteorObserveCallbacks<T extends MongoDoc = MongoDoc> = {
  added: (doc: T) => Array<string> | void;
  changed: (newDoc: T, oldDoc: T) => Array<string> | void;
  removed: (oldDoc: T) => void;
};

export type MeteorObserveChangesCallbacks<T extends MongoDoc = MongoDoc> = {
  added: (id: string, fields: Partial<T>) => Array<string> | void;
  changed: (id: string, fields: Partial<T>) => Array<string> | void;
  removed: (id: string) => void;
};

export interface WatchObserveCallBacks<T extends MongoDoc = MongoDoc> {
  added(keys: string[]): void;
  changed(
    _id: string,
    fields: Partial<T>,
    replace: boolean,
    op: ChangeEventMeteor<T>
  ): void;
  removed(keys: string[]): void;
}
