import type OlMap from 'ol/Map';

import type { MapContext, PopupHostApi, VectorLayerApi } from '../public/types';

export const createMapContext = (
  map: OlMap,
  layers: Record<string, VectorLayerApi<any, any>>,
  popupHost?: PopupHostApi,
): MapContext => {
  return {
    map,
    layers,
    popupHost,
    batch: (fn) => fn(),
  };
};
