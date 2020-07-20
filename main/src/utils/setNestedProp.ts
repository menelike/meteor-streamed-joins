import type { DefaultDoc } from '../types';

import isPlainObject from './isPlainObject';

const setNestedProp = <T extends DefaultDoc = DefaultDoc>(
  path: string[],
  doc: T,
  v: unknown
): void => {
  let base = doc;
  while (path.length) {
    const p = path.shift();
    if (p) {
      if (path.length) {
        // @ts-ignore
        if (!isPlainObject(base[p])) base[p] = {};
        base = base[p];
      } else if (isPlainObject(base)) {
        // @ts-ignore
        base[p] = v;
      }
    }
  }
};

export default setNestedProp;
