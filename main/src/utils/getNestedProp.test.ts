import getNestedProp from './getNestedProp';

describe('getNestedProp', () => {
  it('get the nested property', () => {
    expect.assertions(6);

    expect(
      getNestedProp(['a', 'b', 'c'], {
        a: {
          b: {
            c: 1,
          },
        },
      })
    ).toEqual([true, 1]);

    expect(
      getNestedProp(['a', 'b', 'd'], {
        a: {
          b: {
            c: 1,
          },
        },
      })
    ).toEqual([false, undefined]);

    expect(
      getNestedProp(['a', 'b'], {
        a: true,
      })
    ).toEqual([false, undefined]);

    // @ts-ignore
    expect(getNestedProp(['a', 'b'], undefined)).toEqual([false, undefined]);

    expect(
      getNestedProp(['a', 'b'], {
        a: {
          b: {
            c: 1,
          },
        },
      })
    ).toEqual([true, { c: 1 }]);

    expect(
      getNestedProp([], {
        a: {
          b: {
            c: 1,
          },
        },
      })
    ).toEqual([false, undefined]);
  });
});
