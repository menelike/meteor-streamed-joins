import type {
  ChangeEventCR,
  ChangeEventDelete,
  ChangeEventUpdate,
  ObjectID,
} from 'mongodb';

export type DefaultDoc = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type StringOrObjectID = string | ObjectID;

export interface MongoDoc extends DefaultDoc {
  _id: StringOrObjectID;
}

export type WithoutId<T extends MongoDoc = MongoDoc> = Pick<
  T,
  Exclude<keyof T, '_id'>
>;

export interface ChangeStreamCallBacks<T extends MongoDoc = MongoDoc> {
  added(
    _id: StringOrObjectID,
    doc: Partial<WithoutId<T>>,
    op: ChangeEventCR<T>
  ): void;
  changed(
    _id: StringOrObjectID,
    doc: WithoutId<T>,
    op: ChangeEventUpdate<T>
  ): void;
  replaced(
    _id: StringOrObjectID,
    doc: WithoutId<T>,
    op: ChangeEventCR<T>
  ): void;
  removed(_id: StringOrObjectID, op: ChangeEventDelete<T>): void;
}
