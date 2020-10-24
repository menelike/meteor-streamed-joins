import setNestedProp from './setNestedProp';

describe('setNestedProp', () => {
  it('set the nested property', () => {
    expect.assertions(5);

    let doc = {};
    setNestedProp(['a', 'b', 'c'], doc, 1);
    expect(doc).toStrictEqual({
      a: {
        b: {
          c: 1,
        },
      },
    });

    doc = {
      a: {
        b: {
          c: 1,
        },
      },
    };
    setNestedProp(['a', 'b', 'c'], doc, 2);
    expect(doc).toStrictEqual({
      a: {
        b: {
          c: 2,
        },
      },
    });

    doc = {
      a: {
        b: {
          c: 1,
        },
      },
    };
    setNestedProp(['a', 'b', 'd'], doc, 1);
    expect(doc).toStrictEqual({
      a: {
        b: {
          c: 1,
          d: 1,
        },
      },
    });

    // @ts-ignore
    doc = undefined;
    setNestedProp(['a'], doc, 1);
    expect(doc).toBe(doc);

    doc = {
      a: {
        b: {
          c: 1,
        },
      },
    };
    setNestedProp([''], doc, 1);
    expect(doc).toBe(doc);
  });
});
