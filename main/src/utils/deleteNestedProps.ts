import type { DefaultDoc } from '../types';

import isPlainObject from './isPlainObject';

const deleteNestedProp = <T extends DefaultDoc = DefaultDoc>(
  path: string[],
  doc: T
): void => {
  let base = doc;
  while (path.length) {
    const p = path.shift();
    if (p && isPlainObject(base)) {
      if (path.length) {
        base = base[p];
      } else {
        delete base[p];
      }
    }
  }
};

export default deleteNestedProp;
