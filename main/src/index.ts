/* istanbul ignore else */
// @ts-ignore
if (!global.Package?.minimongo?.Minimongo?.Matcher) {
  throw Error('meteor/minimongo is missing');
}

// eslint-disable-next-line import/first
import ChangeStreamRegistry from './changeStream/ChangeStreamRegistry';
// eslint-disable-next-line import/first
import Link from './Link';

export { ChangeStreamRegistry };

export default Link;
