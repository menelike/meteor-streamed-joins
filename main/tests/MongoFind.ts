import { MongoClient } from 'mongodb';
import type { FilterQuery } from 'mongodb';

import type { MongoDoc } from '../src/types';

const find = async <T extends MongoDoc>(
  uri: string,
  collectionName: string,
  query?: FilterQuery<T>,
  fields?: { [P in keyof T]: boolean | number }
): Promise<Array<T>> => {
  const connection = await MongoClient.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    const collection = connection.db().collection(collectionName);

    let result;

    if (fields) {
      result = await collection.find(query).project(fields).toArray();
    } else {
      result = await collection.find(query).toArray();
    }

    return result;
  } finally {
    await connection.close();
  }
};

const [uri, collectionName, query, fields] = process.argv.slice(2);

let parsedQuery;
if (query && query !== 'undefined') {
  parsedQuery = JSON.parse(Buffer.from(query, 'base64').toString('utf8'));
}

let parsedFields;
if (fields && fields !== 'undefined') {
  parsedFields = JSON.parse(Buffer.from(fields, 'base64').toString('utf8'));
}

find(uri, collectionName, parsedQuery, parsedFields)
  .then((result) => {
    // eslint-disable-next-line promise/always-return
    if (!result) throw Error('received no data');
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
