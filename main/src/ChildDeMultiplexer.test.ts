import ChildDeMultiplexer from './ChildDeMultiplexer';
import type { LinkChild } from './LinkChild';

const linkChildMock = ({
  parentAdded: jest.fn(),
  parentChanged: jest.fn(),
  parentRemoved: jest.fn(),
  changed: jest.fn(),
  replaced: jest.fn(),
  commit: jest.fn(),
  observe: jest.fn(),
  stop: jest.fn(),
} as unknown) as LinkChild;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ChildDeMultiplexer', () => {
  it('instantiates without crash', () => {
    expect.assertions(1);

    const deMultiplexer = new ChildDeMultiplexer();
    expect(deMultiplexer).toBeTruthy();
  });

  it('calls added', () => {
    expect.assertions(2);

    const deMultiplexer = new ChildDeMultiplexer();
    deMultiplexer.link(linkChildMock);
    const doc = {};
    deMultiplexer.parentAdded('parentId', doc);
    expect(linkChildMock.parentAdded).toHaveBeenCalledTimes(1);
    expect(linkChildMock.parentAdded).toHaveBeenNthCalledWith(
      1,
      'parentId',
      doc
    );
  });

  it('calls changed', () => {
    expect.assertions(2);

    const deMultiplexer = new ChildDeMultiplexer();
    deMultiplexer.link(linkChildMock);
    const doc = {};
    deMultiplexer.parentChanged('parentId', doc);
    expect(linkChildMock.parentChanged).toHaveBeenCalledTimes(1);
    expect(linkChildMock.parentChanged).toHaveBeenNthCalledWith(
      1,
      'parentId',
      doc
    );
  });

  it('calls removed', () => {
    expect.assertions(2);

    const deMultiplexer = new ChildDeMultiplexer();
    deMultiplexer.link(linkChildMock);
    deMultiplexer.parentRemoved('parentId');
    expect(linkChildMock.parentRemoved).toHaveBeenCalledTimes(1);
    expect(linkChildMock.parentRemoved).toHaveBeenNthCalledWith(1, 'parentId');
  });

  it('calls commit', () => {
    expect.assertions(2);

    const deMultiplexer = new ChildDeMultiplexer();
    deMultiplexer.link(linkChildMock);
    deMultiplexer.commit();
    expect(linkChildMock.commit).toHaveBeenCalledTimes(1);
    expect(linkChildMock.commit).toHaveBeenNthCalledWith(1);
  });

  it('calls observe', () => {
    expect.assertions(2);

    const deMultiplexer = new ChildDeMultiplexer();
    deMultiplexer.link(linkChildMock);
    deMultiplexer.observe();
    expect(linkChildMock.observe).toHaveBeenCalledTimes(1);
    expect(linkChildMock.observe).toHaveBeenNthCalledWith(1);
  });

  it('calls stop', async () => {
    expect.assertions(2);

    const deMultiplexer = new ChildDeMultiplexer();
    deMultiplexer.link(linkChildMock);
    await deMultiplexer.stop();
    expect(linkChildMock.stop).toHaveBeenCalledTimes(1);
    expect(linkChildMock.stop).toHaveBeenNthCalledWith(1);
  });
});
