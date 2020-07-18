import type { ChangeEventMeteor } from './ChangeStreamMultiplexer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyValue = any;

export type DefaultDoc = Record<string, AnyValue>;

export interface MongoDoc {
  _id: string;
  [key: string]: AnyValue;
}

export type MeteorObserveCallbacks<T = MongoDoc> = {
  added: (doc: T) => Array<string> | void;
  changed: (newDoc: T, oldDoc: T) => Array<string> | void;
  removed: (oldDoc: T) => void;
};

export type MeteorObserveChangesCallbacks<T = MongoDoc> = {
  added: (id: string, fields: Partial<T>) => Array<string> | void;
  changed: (id: string, fields: Partial<T>) => Array<string> | void;
  removed: (id: string) => void;
};

export interface WatchObserveCallBacks {
  added(keys: string[]): void;
  changed(
    _id: string,
    fields: Record<string, AnyValue>,
    replace: boolean,
    op: ChangeEventMeteor
  ): void;
  removed(keys: string[]): void;
}
