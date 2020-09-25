import { execSync } from 'child_process';
import path from 'path';

import { Collection, FilterQuery } from 'mongodb';

import { MongoDoc } from '../src/types';

type FindOptions<T> = {
  fields?: { [P in keyof T]: boolean | number };
};

const scriptPath = path.join(__dirname, 'MongoFind.js');

export class MeteorCollection<T extends MongoDoc> {
  private readonly collection: Collection<T>;

  private readonly timeout: number;

  private readonly uri: string;

  constructor(uri: string, collection: Collection<T>, timeout: number) {
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
      let run = `node ${scriptPath} ${this.uri} ${this.collection.collectionName}`;
      if (query) {
        const buffer: Buffer = Buffer.from(JSON.stringify(query));
        run = `${run} ${buffer.toString('base64')}`;
      }
      if (options?.fields) {
        if (!query) run = `${run} undefined`;
        const buffer: Buffer = Buffer.from(JSON.stringify(options.fields));
        run = `${run} ${buffer.toString('base64')}`;
      }

      let result;
      try {
        result = execSync(run, {
          encoding: 'utf8',
        });
      } catch (err) {
        console.debug(`FIND COMMAND: ${run}`);
        console.error(err);
        throw err;
      }

      return JSON.parse(result);
    });
}
