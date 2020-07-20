import deleteNestedProp from './deleteNestedProps';

describe('deleteNestedProp', () => {
  it('delete the nested property', () => {
    expect.assertions(5);

    let doc = {};
    deleteNestedProp(['a', 'b', 'c'], doc);
    expect(doc).toEqual({});

    // @ts-ignore
    doc = undefined;
    deleteNestedProp(['a', 'b', 'c'], doc);
    expect(doc).toEqual(undefined);

    doc = {
      a: {
        b: {
          c: 1,
        },
      },
    };
    deleteNestedProp(['a', 'b', 'c'], doc);
    expect(doc).toEqual({
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
    expect(doc).toEqual({
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
