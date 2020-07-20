// @ts-ignore
import EJSON from 'ejson';

import type { DefaultDoc } from '../types';

import deleteNestedProp from './deleteNestedProps';
import getNestedProp from './getNestedProp';
import setNestedProp from './setNestedProp';

interface AllowedFields {
  [key: string]: 1;
}

interface DeniedFields {
  [key: string]: -1;
}

export type FieldProjection = AllowedFields | DeniedFields;

const filterAllowedFields = <T extends DefaultDoc = DefaultDoc>(
  fieldOptions: AllowedFields,
  doc: T
): Partial<T> => {
  const nextDoc = {};
  Object.keys(fieldOptions).forEach((k) => {
    const [found, value] = getNestedProp<T>(k.split('.'), doc);
    if (found) setNestedProp(k.split('.'), nextDoc, value);
  });
  return nextDoc;
};

const filterDeniedFields = <T extends DefaultDoc = DefaultDoc>(
  fieldOptions: DeniedFields,
  doc: T
): Partial<T> => {
  const nextDoc = EJSON.clone(doc);
  Object.keys(fieldOptions).forEach((k) => {
    deleteNestedProp<T>(k.split('.'), nextDoc);
  });

  return nextDoc;
};

const filterFields = <T extends DefaultDoc = DefaultDoc>(
  fieldOptions: FieldProjection,
  fields: T
): Partial<T> => {
  if (!Object.keys(fieldOptions).length) return fields;

  if (Object.values(fieldOptions).every((v) => v === 1)) {
    // @ts-ignore
    return filterAllowedFields<T>(fieldOptions, fields);
  }

  if (Object.values(fieldOptions).every((v) => v === -1)) {
    // @ts-ignore
    return filterDeniedFields<T>(fieldOptions, fields);
  }

  throw Error('field projections should not have mixed flags (-1 and 1)');
};

export default filterFields;
