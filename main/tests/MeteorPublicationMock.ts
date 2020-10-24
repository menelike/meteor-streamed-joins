import type { MeteorPublicationContext } from '../src/PublicationContext';
import { MongoDoc, WithoutId } from '../src/types';

interface MeteorPublicationMockInterface extends MeteorPublicationContext {
  added: jest.Mock;
  changed: jest.Mock;
  connection: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClose: jest.Mock<any, any>;
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    httpHeaders: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    close: jest.Mock<any, any>;
    clientAddress: string;
  };
  error: jest.Mock;
  onStop: jest.Mock;
  ready: jest.Mock;
  removed: jest.Mock;
  stop: jest.Mock;
  userId: string;
  _subscriptionId: string;
  _session: {
    collectionViews: Map<
      string,
      {
        documents: Map<
          string,
          { existsIn: Set<string>; getFields: () => MongoDoc }
        >;
      }
    >;
  };
}

class MeteorPublicationMock implements MeteorPublicationMockInterface {
  _session = {
    collectionViews: new Map(),
  };

  private stopRegistry: Array<() => void> = [];

  added = jest
    .fn()
    .mockImplementation(
      (collection: string, id: string, doc: Partial<WithoutId<MongoDoc>>) => {
        if (!this._session.collectionViews.get(collection)) {
          this._session.collectionViews.set(collection, {
            documents: new Map(),
          });
        }

        this._session.collectionViews.get(collection).documents.set(id, {
          existsIn: new Set([this._subscriptionId]),
          getFields: () => doc,
        });
      }
    );

  changed = jest
    .fn()
    .mockImplementation(
      (collection: string, id: string, doc: Partial<WithoutId<MongoDoc>>) => {
        if (!this._session.collectionViews.get(collection)) {
          this._session.collectionViews.set(collection, {
            documents: new Map(),
          });
        }

        const cleaned = {};
        Object.entries(doc).forEach(([k, v]) => {
          if (v !== undefined) {
            // @ts-ignore
            cleaned[k] = v;
          }
        });

        this._session.collectionViews.get(collection).documents.set(id, {
          existsIn: new Set([this._subscriptionId]),
          getFields: () => cleaned,
        });
      }
    );

  removed = jest.fn().mockImplementation((collection: string, id: string) => {
    if (!this._session.collectionViews.get(collection)) {
      this._session.collectionViews.set(collection, {
        documents: new Map(),
      });
    }

    this._session.collectionViews.get(collection).documents.delete(id);
  });

  connection = {
    id: 'testConnectionId',
    close: jest.fn(),
    onClose: jest.fn(),
    clientAddress: 'testClientAddress',
    httpHeaders: {},
  };

  error = jest.fn();

  onStop = jest.fn().mockImplementation((func) => this.stopRegistry.push(func));

  ready = jest.fn();

  stop = jest.fn().mockImplementation(() => {
    this._session.collectionViews = new Map();
    this.stopRegistry.forEach((func) => func());
    this.stopRegistry = [];
  });

  userId = 'testUserId';

  _subscriptionId = 'testSubscription';
}

export default MeteorPublicationMock;
