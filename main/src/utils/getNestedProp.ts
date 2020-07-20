import type { DefaultDoc } from '../types';

import isPlainObject from './isPlainObject';

const getNestedProp = <T extends DefaultDoc = DefaultDoc>(
  path: string[],
  doc: T
): [boolean, unknown] => {
  let base = doc;
  let v;
  let found = false;
  while (path.length) {
    const p = path.shift();
    if (p && isPlainObject(base) && p in base) {
      if (!path.length) {
        v = base[p];
        found = true;
      } else {
        base = base[p];
      }
    }
  }

  return [found, v];
};

export default getNestedProp;
