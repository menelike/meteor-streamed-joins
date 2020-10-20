import { ObjectID } from 'mongodb';

import { objectIdToString, stringToObjectId, createId } from './idGeneration';

describe('idGeneration', () => {
  it('converts to string', () => {
    expect.assertions(6);

    const objectId = new ObjectID();

    expect(objectIdToString(objectId)).toBe(objectId.toHexString());
    expect(typeof objectIdToString(objectId)).toBe('string');
    expect(objectIdToString(objectId.toHexString())).toBe(
      objectId.toHexString()
    );
    expect(typeof objectIdToString(objectId.toHexString())).toBe('string');

    const meteorMongoIdMock = {
      toHexString: (): string => 'someString',
    } as ObjectID;
    expect(objectIdToString(meteorMongoIdMock)).toBe('someString');
    expect(typeof objectIdToString(meteorMongoIdMock)).toBe('string');
  });

  it('converts to ObjectID', () => {
    expect.assertions(2);

    const objectId = new ObjectID();

    expect(stringToObjectId(objectId.toHexString())).toBeInstanceOf(ObjectID);
    expect(stringToObjectId(objectId)).toBe(objectId);
  });

  it('creates id based on idGeneration', () => {
    expect.assertions(2);

    const objectId = new ObjectID();

    expect(createId('MONGO', objectId.toHexString())).toBeInstanceOf(ObjectID);
    expect(createId('STRING', objectId)).toBe(objectId.toHexString());
  });
});
