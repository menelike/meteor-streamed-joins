import sleep from './sleep';

const waitUntil = async (
  func: () => boolean,
  timeoutInMs = 2000,
  retryInterval = 20
): Promise<boolean> => {
  const started = Date.now();
  while (started + timeoutInMs > Date.now()) {
    if (func()) return true;
    // eslint-disable-next-line no-await-in-loop
    await sleep(retryInterval);
  }

  return false;
};

export const waitUntilHaveBeenCalledTimes = (
  fn: jest.Mock,
  count: number
): Promise<boolean> => waitUntil(() => fn.mock.calls.length === count);

export default waitUntil;
