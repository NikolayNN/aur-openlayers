import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import type OlMap from 'ol/Map';

import type {
  MapSchema,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../public/types';
import { createMapContext } from './map-context';
import { PlainVectorLayer } from './plain-layer';

const createInvalidateScheduler = (layer: VectorLayer<VectorSource<any>>): (() => void) => {
  let scheduled = false;
  return () => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      layer.changed();
    });
  };
};

export class LayerManager<Layers extends readonly VectorLayerDescriptor<any, any, any, any>[]> {
  private readonly layers: Record<string, VectorLayer<VectorSource<any>>> = {};
  private readonly apis: Record<string, VectorLayerApi<any, any>> = {};

  private constructor(private readonly map: OlMap, schema: MapSchema<Layers>) {
    const ctx = createMapContext(this.map, this.apis);

    schema.layers.forEach((descriptor) => {
      const source = new VectorSource<any>();
      const layer = new VectorLayer({ source });
      if (descriptor.zIndex !== undefined) {
        layer.setZIndex(descriptor.zIndex);
      }
      if (descriptor.visibleByDefault !== undefined) {
        layer.setVisible(descriptor.visibleByDefault);
      }
      if (descriptor.title) {
        layer.set('title', descriptor.title);
      }
      layer.set('id', descriptor.id);

      const api = new PlainVectorLayer({
        descriptor,
        layer,
        source,
        ctx,
        scheduleInvalidate: createInvalidateScheduler(layer),
      });

      this.layers[descriptor.id] = layer;
      this.apis[descriptor.id] = api;
      this.map.addLayer(layer);
    });
  }

  static create<Layers extends readonly VectorLayerDescriptor<any, any, any, any>[]>(
    map: OlMap,
    schema: MapSchema<Layers>,
  ): LayerManager<Layers> {
    return new LayerManager(map, schema);
  }

  getLayer(id: string): VectorLayer<VectorSource<any>> | undefined {
    return this.layers[id];
  }

  getApi(id: string): VectorLayerApi<any, any> | undefined {
    return this.apis[id];
  }

  getApis(): Record<string, VectorLayerApi<any, any>> {
    return { ...this.apis };
  }
}
