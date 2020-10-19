import { ObjectID } from 'mongodb';

import type { IdGeneration } from '../Configuration';
import type { StringOrObjectID } from '../types';

export const objectIdToString = (id: StringOrObjectID): string => {
  if (id instanceof ObjectID) {
    return id.toHexString();
  }
  // duck-type to identify instanceof MongoID.ObjectID
  if (typeof id === 'object' && id !== null && 'toHexString' in id) {
    // @ts-ignore
    return id.toHexString();
  }
  return id;
};

export const stringToObjectId = (id: StringOrObjectID): ObjectID => {
  if (typeof id === 'string') return ObjectID.createFromHexString(id);

  return id;
};

type CreateIdResult<T> = T extends 'MONGO'
  ? ObjectID
  : T extends 'STRING'
  ? string
  : never;

export const createId = <T extends IdGeneration>(
  idGeneration: T,
  id: StringOrObjectID
): CreateIdResult<T> => {
  if (idGeneration === 'MONGO') {
    return stringToObjectId(id) as CreateIdResult<T>;
  }

  return objectIdToString(id) as CreateIdResult<T>;
};
