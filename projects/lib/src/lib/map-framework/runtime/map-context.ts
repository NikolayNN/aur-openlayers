import type OlMap from 'ol/Map';

import type { MapContext, VectorLayerApi } from '../public/types';

export const createMapContext = (
  map: OlMap,
  layers: Record<string, VectorLayerApi<any, any>>,
): MapContext => {
  return {
    map,
    layers,
    batch: (fn) => fn(),
  };
};
