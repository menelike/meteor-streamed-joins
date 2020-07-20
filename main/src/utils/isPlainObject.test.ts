import isPlainObject from './isPlainObject';

describe('isPlainObject', () => {
  it('checks various objects', () => {
    expect.assertions(8);

    expect(isPlainObject({})).toEqual(true);
    expect(isPlainObject(document.createElement('div'))).toEqual(false);
    expect(isPlainObject(null)).toEqual(false);
    expect(isPlainObject(undefined)).toEqual(false);
    expect(isPlainObject(Object.create(null))).toEqual(true);
    expect(isPlainObject(Number(6))).toEqual(false);
    expect(isPlainObject('ANY')).toEqual(false);
    expect(isPlainObject(Math)).toEqual(false);
  });
});
