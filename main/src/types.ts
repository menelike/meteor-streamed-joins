import type {
  ChangeEventCR,
  ChangeEventDelete,
  ChangeEventUpdate,
} from 'mongodb';

export type DefaultDoc = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface MongoDoc extends DefaultDoc {
  _id: string;
}

export type WithoutId<T extends MongoDoc = MongoDoc> = Pick<
  T,
  Exclude<keyof T, '_id'>
>;

export interface ChangeStreamCallBacks<T extends MongoDoc = MongoDoc> {
  added(_id: string, doc: Partial<WithoutId<T>>, op: ChangeEventCR<T>): void;
  changed(
    _id: string,
    fields: Partial<WithoutId<T>>,
    doc: WithoutId<T>,
    op: ChangeEventUpdate<T>
  ): void;
  replaced(_id: string, doc: WithoutId<T>, op: ChangeEventCR<T>): void;
  removed(_id: string, op: ChangeEventDelete<T>): void;
}
