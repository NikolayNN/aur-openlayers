import Map from 'ol/Map';
import Point from 'ol/geom/Point';
import View from 'ol/View';
import Style from 'ol/style/Style';

import type { MapSchema, VectorLayerDescriptor } from '../public/types';
import { LayerManager } from './layer-manager';

type Model = { id: string; coords: [number, number] };

const createMap = () =>
  new Map({
    target: document.createElement('div'),
    view: new View({ center: [0, 0], zoom: 2 }),
    layers: [],
  });

describe('LayerManager', () => {
  it('defers invalidate to RAF when scheduler policy is raf', () => {
    const callbacks: FrameRequestCallback[] = [];
    spyOn(window, 'requestAnimationFrame').and.callFake((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    spyOn(window, 'cancelAnimationFrame').and.stub();

    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      options: {
        scheduler: { policy: 'raf' },
      },
      layers: [
        {
          id: 'points',
          feature: {
            id: (model: Model) => model.id,
            geometry: {
              fromModel: (model) => new Point(model.coords),
              applyGeometryToModel: (prev) => prev,
            },
            style: {
              base: () => ({ color: 'red' }),
              render: () => new Style(),
            },
          },
        },
      ],
    };

    const manager = LayerManager.create(createMap(), schema);
    const layer = manager.getLayer('points');
    const api = manager.getApi('points');

    expect(layer).toBeDefined();
    expect(api).toBeDefined();

    const initialCallbacks = callbacks.length;
    const changedSpy = spyOn(layer!, 'changed').and.callThrough();
    api!.invalidate();

    expect(changedSpy).not.toHaveBeenCalled();
    expect(callbacks.length).toBe(initialCallbacks + 1);
    callbacks[callbacks.length - 1](0);
    expect(changedSpy).toHaveBeenCalledTimes(1);
  });
});
