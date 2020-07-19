export default (sleepInMS: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, sleepInMS));
