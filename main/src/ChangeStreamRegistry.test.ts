import ChangeStreamDeMultiplexer from './ChangeStreamDeMultiplexer';
import ChangeStreamRegistry from './ChangeStreamRegistry';

describe('ChangeStreamRegistry', () => {
  it('checks for singleton existence', () => {
    expect.assertions(1);

    expect(
      ChangeStreamRegistry instanceof ChangeStreamDeMultiplexer
    ).toBeTruthy();
  });
});
