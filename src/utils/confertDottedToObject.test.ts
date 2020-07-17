import convertDottedToObject from './convertDottedToObject';

describe('convertDottedToObject', () => {
  it('do not mutate the original object', () => {
    expect.assertions(1);
    const doc = {
      a: 1,
      b: 2,
    };
    expect(convertDottedToObject(doc)).not.toBe(doc);
  });

  it('convert plain to object', () => {
    expect.assertions(1);

    expect(
      convertDottedToObject({
        a: 1,
        b: 2,
      })
    ).toEqual({
      a: 1,
      b: 2,
    });
  });

  it('convert nested to object', () => {
    expect.assertions(3);

    expect(
      convertDottedToObject({
        'a.b.c': 1,
      })
    ).toEqual({
      a: {
        b: {
          c: 1,
        },
      },
    });

    expect(
      convertDottedToObject({
        'a.b.c': 1,
        'a.b.d.e': 1,
      })
    ).toEqual({
      a: {
        b: {
          c: 1,
          d: {
            e: 1,
          },
        },
      },
    });

    expect(
      convertDottedToObject({
        'a.b.d.e': 1,
        'a.b.c': 1,
      })
    ).toEqual({
      a: {
        b: {
          c: 1,
          d: {
            e: 1,
          },
        },
      },
    });
  });
});
