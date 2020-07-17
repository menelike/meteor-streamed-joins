import type { DefaultDoc } from '../types';

interface AllowedFields {
  [key: string]: 1;
}

interface DeniedFields {
  [key: string]: -1;
}

export type FieldProjection = AllowedFields | DeniedFields;

const filterAllowedFields = <T extends { [key: string]: never } = DefaultDoc>(
  fieldOptions: AllowedFields,
  doc: T
): DefaultDoc => {
  const nextDoc: DefaultDoc = {};
  Object.keys(fieldOptions).forEach((k) => {
    Object.entries(doc).forEach(([f, v]) => {
      if (f.startsWith(k)) nextDoc[f] = v;
    });
  });
  return nextDoc;
};

const filterDeniedFields = <T extends { [key: string]: never } = DefaultDoc>(
  // eslint-disable-next-line no-unused-vars
  fieldOptions: DeniedFields,
  // eslint-disable-next-line no-unused-vars
  doc: T
): DefaultDoc => {
  throw Error();
};

const filterFields = <T extends { [key: string]: never } = DefaultDoc>(
  fieldOptions: FieldProjection,
  doc: T
): DefaultDoc => {
  if (Object.values(fieldOptions).every((v) => v === 1)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return filterAllowedFields<T>(fieldOptions, doc);
  }

  if (Object.values(fieldOptions).every((v) => v === -1)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return filterDeniedFields<T>(fieldOptions, doc);
  }

  throw Error('field projections should not have mixed flags (-1 and 1)');
};

export default filterFields;
