import type OlMap from 'ol/Map';

import type { BatchOptions, MapContext, PopupHostApi, VectorLayerApi } from '../public/types';
import { FlushScheduler } from './scheduler';

export const createMapContext = (
  map: OlMap,
  layers: Record<string, VectorLayerApi<any, any>>,
  popupHost?: PopupHostApi,
  scheduler: FlushScheduler = new FlushScheduler(),
): MapContext => {
  return {
    map,
    layers,
    popupHost,
    batch: (fn: () => void, options?: BatchOptions) => scheduler.batch(fn, options),
  };
};
