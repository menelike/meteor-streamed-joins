import isPlainObject from './isPlainObject';

describe('isPlainObject', () => {
  it('checks various objects', () => {
    expect.assertions(8);

    expect(isPlainObject({})).toStrictEqual(true);
    expect(isPlainObject(document.createElement('div'))).toStrictEqual(false);
    expect(isPlainObject(null)).toStrictEqual(false);
    expect(isPlainObject(undefined)).toStrictEqual(false);
    expect(isPlainObject(Object.create(null))).toStrictEqual(true);
    expect(isPlainObject(Number(6))).toStrictEqual(false);
    expect(isPlainObject('ANY')).toStrictEqual(false);
    expect(isPlainObject(Math)).toStrictEqual(false);
  });
});
