import type { ChangeEventMeteor } from './ChangeStreamMultiplexer';

export type DefaultValue = never;

export type DefaultDoc = Record<string, DefaultValue>;

export interface MongoDoc extends DefaultDoc {
  _id: string;
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
    fields: Record<string, DefaultValue>,
    op: ChangeEventMeteor
  ): void;
  removed(keys: string[]): void;
}
