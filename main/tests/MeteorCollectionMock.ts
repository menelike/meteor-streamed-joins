import { execSync } from 'child_process';
import fs from 'fs';

import { Collection, FilterQuery } from 'mongodb';
import tmp from 'tmp';

import { MongoDoc } from '../src/types';

type FindOptions<T> = {
  fields?: { [P in keyof T]: boolean | number };
};

const mongoPath = process.env.MONGO_CLIENT_PATH || 'mongo';

const mongoExists = (): void => {
  try {
    execSync(`${mongoPath} --version`, {
      encoding: 'utf8',
    });
  } catch (err) {
    console.debug(err);
    throw Error(
      `could not find the mongo binary (ENV.MONGO_CLIENT_PATH: ${mongoPath})`
    );
  }
};

export class MeteorCollection<T extends MongoDoc> {
  private readonly collection: Collection<T>;

  private readonly timeout: number;

  private readonly uri: string;

  constructor(uri: string, collection: Collection<T>, timeout: number) {
    mongoExists();
    this.uri = uri;
    this.collection = collection;
    this.timeout = timeout;
  }

  public rawCollection = (): Collection<T> => this.collection;

  // could find no way to get fibers play nicely with jest and async/await so:
  // God please have mercy on me for the following
  public find = jest
    .fn()
    .mockImplementation((query?: FilterQuery<T>, options?: FindOptions<T>):
      | Array<Partial<T>>
      | undefined => {
      let q = `db.${this.collection.collectionName}`;
      if (query) {
        if (options?.fields) {
          q = `${q}.find(${JSON.stringify(query)}, ${JSON.stringify(
            options?.fields
          )})`;
        } else {
          q = `${q}.find(${JSON.stringify(query)})`;
        }
      } else if (options?.fields) {
        q = `${q}.find(${JSON.stringify({})}, ${JSON.stringify(
          options?.fields
        )})`;
      } else {
        q = `${q}.find()`;
      }

      q = `${q}.toArray()`;
      q = `JSON.stringify(${q})`;

      const tmpfile = tmp.fileSync();
      fs.writeFileSync(tmpfile.name, q);

      const run = `mongo --quiet --host ${this.uri} < ${tmpfile.name}`;

      let result = '';
      try {
        result = execSync(run, {
          encoding: 'utf8',
        });
      } catch (err) {
        console.debug(`QUERY: ${q}`);
        console.error(err);
        throw err;
      }

      const lines = result.split('\n');

      let res: Array<Partial<T>> | undefined;
      lines.some((l) => {
        try {
          res = JSON.parse(l);
          return true;
        } catch (err) {
          return false;
        }
      });

      return res;
    });
}
