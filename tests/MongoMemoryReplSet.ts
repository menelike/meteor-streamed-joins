import { Db, MongoClient } from 'mongodb';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { MongoMemoryReplSet as _MongoMemoryReplSet } from 'mongodb-memory-server';

let cleanup: (() => Promise<void> | void) | undefined;

[
  `exit`,
  `SIGINT`,
  `SIGUSR1`,
  `SIGUSR2`,
  `uncaughtException`,
  `SIGTERM`,
].forEach((eventType) => {
  process.on(eventType, async () => {
    if (cleanup) {
      await cleanup();
    }
  });
});

// Todo close on crash
class MongoMemoryReplSet {
  private mongod: _MongoMemoryReplSet;

  private connection: MongoClient | undefined;

  constructor(dbName?: 'jest') {
    this.mongod = new _MongoMemoryReplSet({
      instanceOpts: [
        {
          storageEngine: 'wiredTiger',
        },
      ],
      replSet: {
        dbName,
      },
      binary: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        skipMD5: true,
      },
      autoStart: false,
    });
  }

  public connect = async (): Promise<void> => {
    if (this.connection) throw Error('already connected');
    await this.mongod.start();
    const url = await this.mongod.getUri();
    this.connection = await MongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    cleanup = this.close;
  };

  public close = async (): Promise<void> => {
    cleanup = undefined;
    if (this.connection) {
      await this.connection.close(true);
      this.connection = undefined;
    }
    await this.mongod.stop();
  };

  public db = (): Db => {
    if (!this.connection)
      throw Error('no connection found, did you forget to call connect()?');

    return this.connection.db();
  };
}

export default MongoMemoryReplSet;
