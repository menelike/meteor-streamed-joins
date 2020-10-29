// eslint-disable-next-line @typescript-eslint/ban-types
const bindEnvironment = <F extends Function>(func: F): F => {
  return global.Meteor?.bindEnvironment<F>(func) || func;
};

export default bindEnvironment;
