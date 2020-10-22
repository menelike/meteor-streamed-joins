import selectTopLevelFields from './selectTopLevelFields';

describe('selectTopLevelFields', () => {
  it('field is top level', () => {
    expect.assertions(2);

    expect(
      selectTopLevelFields({ foo: 'bar' }, { _id: 'id', foo: 'bar' })
    ).toEqual({
      foo: 'bar',
    });

    expect(selectTopLevelFields({ foo: 'bar' }, { _id: 'id' })).toEqual({
      foo: undefined,
    });
  });

  it('update on array field', () => {
    expect.assertions(2);

    expect(
      selectTopLevelFields(
        { 'foo.1': 'secondValue' },
        { _id: 'id', foo: ['firstValue', 'secondValue'] }
      )
    ).toEqual({
      foo: ['firstValue', 'secondValue'],
    });

    expect(
      selectTopLevelFields(
        { 'nested.foo.1': 'secondValue' },
        { _id: 'id', 'nested.foo': ['firstValue', 'secondValue'] }
      )
    ).toEqual({
      'nested.foo': ['firstValue', 'secondValue'],
    });
  });

  it('update on object with dot in field name', () => {
    expect.assertions(2);

    expect(
      selectTopLevelFields(
        { 'foo.1': 'firstValue' },
        { _id: 'id', foo: { 1: 'firstValue' } }
      )
    ).toEqual({
      foo: { 1: 'firstValue' },
    });

    expect(
      selectTopLevelFields(
        { 'nested.0.foo.1': 'firstValue' },
        { _id: 'id', 'nested.0.foo': { 1: 'firstValue' } }
      )
    ).toEqual({
      'nested.0.foo': { 1: 'firstValue' },
    });
  });

  it('update on array with dot in parent field name', () => {
    expect.assertions(1);

    expect(
      selectTopLevelFields(
        { 'foo.1.bar.0': 'firstValue' },
        { _id: 'id', 'foo.1.bar': ['firstValue'] }
      )
    ).toEqual({
      'foo.1.bar': ['firstValue'],
    });
  });
});
