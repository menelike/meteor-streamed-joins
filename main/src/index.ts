// @ts-ignore
import { Minimongo } from 'meteor/minimongo';

import ChangeStreamRegistry from './changeStream/ChangeStreamRegistry';
import Link from './Link';

if (!Minimongo) throw Error('meteor/minimongo is missing');

export { ChangeStreamRegistry };

export default Link;
