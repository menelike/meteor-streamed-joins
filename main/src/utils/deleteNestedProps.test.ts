import deleteNestedProp from './deleteNestedProps';

describe('deleteNestedProp', () => {
  it('delete the nested property', () => {
    expect.assertions(5);

    let doc = {};
    deleteNestedProp(['a', 'b', 'c'], doc);
    expect(doc).toStrictEqual({});

    // @ts-ignore
    doc = undefined;
    deleteNestedProp(['a', 'b', 'c'], doc);
    expect(doc).toStrictEqual(undefined);

    doc = {
      a: {
        b: {
          c: 1,
        },
      },
    };
    deleteNestedProp(['a', 'b', 'c'], doc);
    expect(doc).toStrictEqual({
      a: {
        b: {},
      },
    });

    doc = {
      a: {
        b: {
          c: 1,
          d: 1,
        },
      },
    };
    deleteNestedProp(['a', 'b', 'c'], doc);
    expect(doc).toStrictEqual({
      a: {
        b: {
          d: 1,
        },
      },
    });

    doc = {
      a: {
        b: {
          c: 1,
          d: 1,
        },
      },
    };
    deleteNestedProp([''], doc);
    expect(doc).toBe(doc);
  });
});
