import filterFields from './filterFields';

describe('filterFields', () => {
  it('do not mutate the original document', () => {
    expect.assertions(2);

    const doc1 = {
      fieldA: 1,
    };

    expect(filterFields({ fieldA: 1 }, doc1)).not.toBe(doc1);

    const doc2 = {
      fieldA: -1,
    };

    expect(filterFields({ fieldA: 1 }, doc2)).not.toBe(doc2);
  });

  it('throw error in mixed projection', () => {
    expect.assertions(1);

    // @ts-ignore
    expect(() => filterFields({ fieldA: 1, fieldB: -1 }, {})).toThrowError(
      'field projections should not have mixed flags (-1 and 1)'
    );
  });

  it('return the original document when no fields given', () => {
    expect.assertions(2);

    const doc1 = {
      fieldA: 1,
    };

    expect(filterFields({}, doc1)).toBe(doc1);

    const doc2 = {
      fieldA: -1,
    };

    expect(filterFields({}, doc2)).toBe(doc2);
  });

  it('filter allowed fields', () => {
    expect.assertions(7);

    expect(
      filterFields(
        { fieldA: 1, fieldB: 1 },
        {
          fieldA: 1,
          fieldB: 2,
        }
      )
    ).toEqual({
      fieldA: 1,
      fieldB: 2,
    });

    expect(
      filterFields(
        { fieldA: 1 },
        {
          fieldA: 1,
          fieldB: 2,
        }
      )
    ).toEqual({
      fieldA: 1,
    });

    expect(
      filterFields(
        { otherField: 1 },
        {
          fieldA: 1,
          fieldB: 2,
        }
      )
    ).toEqual({});

    expect(
      filterFields(
        { 'nested.FieldA': 1, 'nested.FieldB': 1 },
        {
          nested: { FieldA: 1, FieldB: 2 },
        }
      )
    ).toEqual({
      nested: { FieldA: 1, FieldB: 2 },
    });

    expect(
      filterFields(
        { 'nested.FieldA': 1 },
        {
          nested: { FieldA: 1, FieldB: 2 },
        }
      )
    ).toEqual({
      nested: { FieldA: 1 },
    });

    expect(
      filterFields(
        { 'nested.FieldA': 1 },
        {
          nested: { FieldAB: 1 },
        }
      )
    ).toEqual({});

    expect(
      filterFields(
        { 'nested.FieldA': 1 },
        {
          nested: { FieldA: { foo: 1 } },
        }
      )
    ).toEqual({
      nested: { FieldA: { foo: 1 } },
    });
  });

  it('filter denied fields', () => {
    expect.assertions(6);

    expect(
      filterFields(
        { fieldA: -1 },
        {
          fieldA: 1,
          fieldB: 2,
        }
      )
    ).toEqual({
      fieldB: 2,
    });

    expect(
      filterFields(
        { fieldA: -1, fieldB: -1 },
        {
          fieldA: 1,
          fieldB: 2,
        }
      )
    ).toEqual({});

    expect(
      filterFields(
        { 'nested.FieldA': -1 },
        {
          nested: {
            FieldA: 1,
            FieldB: 2,
          },
        }
      )
    ).toEqual({
      nested: {
        FieldB: 2,
      },
    });

    expect(
      filterFields(
        { nested: -1 },
        {
          nested: {
            FieldA: 1,
            FieldB: 2,
          },
        }
      )
    ).toEqual({});

    expect(
      filterFields(
        { 'nested.FieldA': -1 },
        {
          nested: { FieldAB: 1 },
        }
      )
    ).toEqual({
      nested: {
        FieldAB: 1,
      },
    });

    expect(
      filterFields(
        { 'nested.FieldA': -1 },
        {
          nested: { FieldA: { foo: 1 }, FieldB: { bar: 1 } },
        }
      )
    ).toEqual({
      nested: { FieldB: { bar: 1 } },
    });
  });
});
