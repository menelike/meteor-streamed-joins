import type { MeteorPublicationContext } from '../src/PublicationContext';

interface MeteorPublicationMockInterface extends MeteorPublicationContext {
  added: jest.Mock;
  changed: jest.Mock;
  connection: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClose: jest.Mock<any, any>;
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    httpHeaders: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    close: jest.Mock<any, any>;
    clientAddress: string;
  };
  error: jest.Mock;
  onStop: jest.Mock;
  ready: jest.Mock;
  removed: jest.Mock;
  stop: jest.Mock;
  userId: string;
}

const MeteorPublicationMock: MeteorPublicationMockInterface = {
  added: jest.fn(),
  changed: jest.fn(),
  connection: {
    id: 'testConnectionId',
    close: jest.fn(),
    onClose: jest.fn(),
    clientAddress: 'testClientAddress',
    httpHeaders: {},
  },
  error: jest.fn(),
  onStop: jest.fn(),
  ready: jest.fn(),
  removed: jest.fn(),
  stop: jest.fn(),
  userId: 'testUserId',
};

export default MeteorPublicationMock;