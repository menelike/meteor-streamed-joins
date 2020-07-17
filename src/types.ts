import type { ChangeEventMeteor } from './ChangeStreamMultiplexer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyValue = any;

export type DefaultDoc = Record<string, AnyValue>;

export interface MongoDoc {
  _id: string;
  [key: string]: AnyValue;
}

export type MeteorObserverChanges<T = MongoDoc> = {
  added: (doc: T) => Array<string>;
  changed: (newDoc: T, oldDoc: T) => Array<string>;
  removed: (oldDoc: T) => void;
};

export interface WatchObserveCallBack {
  added(keys: string[]): void;
  changed(
    _id: string,
    fields: Record<string, AnyValue>,
    op: ChangeEventMeteor
  ): void;
  removed(keys: string[]): void;
}
