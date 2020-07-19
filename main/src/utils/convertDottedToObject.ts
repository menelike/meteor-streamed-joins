import { DefaultDoc } from '../types';

const convertDottedToObject = <T extends DefaultDoc = DefaultDoc>(
  source: DefaultDoc
): T => {
  const nextDoc: DefaultDoc = {};
  Object.entries(source).forEach(([k, v]) => {
    const path = k.split('.');
    const lastIdx = path.length - 1;
    path.reduce((acc, cur, idx) => {
      if (idx === lastIdx) {
        acc[cur] = v;
      } else if (!(cur in acc)) {
        acc[cur] = {};
      }
      return acc[cur];
    }, nextDoc);
  });
  return nextDoc as T;
};

export default convertDottedToObject;
