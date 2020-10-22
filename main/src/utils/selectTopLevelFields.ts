import type { ChangeEventUpdate } from 'mongodb';

import { WithoutId, MongoDoc } from '../types';

/*
1. Meteor does not handle nested field updates, so we only select the
top level fields and need to rely on the full document as unchanged nested
props are not submitted in the updateDescription and would otherwise result
in a purge by Meteor

2. Change Stream updates will result in 'foo.indexNumber' for array updates
which makes it necessary to select the complete field from the fullDocument
as Meteor does not support updates to array indexes
see https://stackoverflow.com/questions/53842064/differentiate-between-nested-update-insert-and-delete-with-mongodb-change-strea

3. MongoDB 3.6+ allows dots in fieldNames, so 'foo.indexNumber' might also be
an object. For the time being dots in names are allowed, but not supported by
the drivers:

https://docs.mongodb.com/manual/reference/limits/#naming-restrictions:

Top-level field names cannot start with the dollar sign ($) character.
Otherwise, starting in MongoDB 3.6, the server permits storage of field names that contain dots (i.e. .) and dollar signs (i.e. $).

Until support is added in the query language,
the use of $ and . in field names is not recommended
and is not supported by the official MongoDB drivers.
*/

const selectTopLevelFields = <T extends MongoDoc = MongoDoc>(
  fields: ChangeEventUpdate<T>['updateDescription']['updatedFields'],
  fullDocument: T
): Partial<WithoutId<T>> => {
  const doc: Partial<WithoutId<T>> = {};

  Object.keys(fields).forEach((field) => {
    const separatedFields = field.split('.');
    const topLevelFieldName = separatedFields[0];
    if (separatedFields.length === 1 || topLevelFieldName in fullDocument) {
      // @ts-ignore
      doc[topLevelFieldName] = fullDocument[topLevelFieldName];
    } else {
      const paths: string[] = [];
      separatedFields.some((f) => {
        paths.push(f);
        const p = paths.join('.');
        if (p in fullDocument) {
          // @ts-ignore
          doc[p] = fullDocument[p];
          return true;
        }
        return false;
      });
    }
  });

  return doc;
};

export default selectTopLevelFields;
