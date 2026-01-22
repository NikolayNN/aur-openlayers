import Feature from 'ol/Feature';
import Map from 'ol/Map';
import MapBrowserEvent from 'ol/MapBrowserEvent';
import Point from 'ol/geom/Point';
import type Geometry from 'ol/geom/Geometry';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import View from 'ol/View';

import type {
  HitItem,
  MapSchema,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../public/types';
import { createMapContext } from './map-context';
import { InteractionManager } from './interaction-manager';
import { getFeatureStates } from './style/feature-states';

type Model = { id: string; value: number };

const createMap = () => {
  return new Map({
    target: document.createElement('div'),
    view: new View({ center: [0, 0], zoom: 2 }),
    layers: [],
  });
};

const createLayer = (id: string, zIndex: number) => {
  const source = new VectorSource<Geometry>();
  const layer = new VectorLayer({ source });
  layer.set('id', id);
  layer.setZIndex(zIndex);
  return { layer, source };
};

const createApi = (): VectorLayerApi<Model, Point> => {
  return {
    setModels: () => undefined,
    invalidate: () => undefined,
    syncFeatureFromModel: () => undefined,
    getModelByFeature: (feature) => feature.get('model') as Model,
    mutate: () => undefined,
  };
};

const createHitItem = (model: Model): HitItem<Model, Point> => {
  const feature = new Feature<Point>({ geometry: new Point([0, 0]) });
  feature.set('model', model);
  return { model, feature };
};

const createEvent = (map: Map, type: 'pointermove' | 'singleclick') =>
  new MapBrowserEvent(type, map, { pixel: [0, 0] } as unknown as PointerEvent);

const buildManager = (
  map: Map,
  schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]>,
  layerEntries: Array<{ id: string; layer: VectorLayer }>,
  hitTest: (args: { layerId: string; hitTolerance: number }) => Array<HitItem<any, any>>,
) => {
  const layers: Record<string, VectorLayer> = {};
  const apis: Record<string, VectorLayerApi<any, any>> = {};
  layerEntries.forEach((entry) => {
    layers[entry.id] = entry.layer as VectorLayer;
    apis[entry.id] = createApi();
  });
  const ctx = createMapContext(map, apis);
  return new InteractionManager({
    ctx,
    map,
    schema,
    layers,
    apis,
    hitTest: ({ layerId, hitTolerance }) => hitTest({ layerId, hitTolerance }),
  });
};

describe('InteractionManager', () => {
  it('orders layers by zIndex then schema order', () => {
    const map = createMap();
    const layerA = createLayer('a', 1);
    const layerB = createLayer('b', 2);
    const layerC = createLayer('c', 2);

    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: { hover: { onEnter: () => undefined } },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: { hover: { onEnter: () => undefined } },
          },
        },
        {
          id: 'c',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: { hover: { onEnter: () => undefined } },
          },
        },
      ],
    };

    const order: string[] = [];
    const manager = buildManager(
      map,
      schema,
      [
        { id: 'a', layer: layerA.layer },
        { id: 'b', layer: layerB.layer },
        { id: 'c', layer: layerC.layer },
      ],
      ({ layerId }) => {
        order.push(layerId);
        return [];
      },
    );

    manager.handlePointerMove(createEvent(map, 'pointermove'));
    expect(order).toEqual(['b', 'c', 'a']);
  });

  it('supplies items only for the current layer', () => {
    const map = createMap();
    const layerA = createLayer('a', 1);
    const layerB = createLayer('b', 0);

    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                onClick: ({ items }) => {
                  expect(items.map((item) => item.model.id)).toEqual(['a']);
                  return true;
                },
              },
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                onClick: ({ items }) => {
                  expect(items.map((item) => item.model.id)).toEqual(['b']);
                  return true;
                },
              },
            },
          },
        },
      ],
    };

    const itemsByLayer: Record<string, Array<HitItem<Model, Point>>> = {
      a: [createHitItem({ id: 'a', value: 1 })],
      b: [createHitItem({ id: 'b', value: 2 })],
    };

    const manager = buildManager(
      map,
      schema,
      [
        { id: 'a', layer: layerA.layer },
        { id: 'b', layer: layerB.layer },
      ],
      ({ layerId }) => itemsByLayer[layerId],
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
  });

  it('uses hitTolerance fallback chain', () => {
    const map = createMap();
    const layer = createLayer('a', 1);

    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                onClick: () => undefined,
              },
            },
          },
        },
      ],
      options: { hitTolerance: 7 },
    };

    const tolerances: number[] = [];
    const manager = buildManager(
      map,
      schema,
      [{ id: 'a', layer: layer.layer }],
      ({ hitTolerance }) => {
        tolerances.push(hitTolerance);
        return [];
      },
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(tolerances).toEqual([7]);
  });

  it('propagates based on handled and propagation', () => {
    const map = createMap();
    const layerA = createLayer('a', 2);
    const layerB = createLayer('b', 1);

    const calls: string[] = [];
    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                onClick: () => {
                  calls.push('a');
                  return true;
                },
              },
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                onClick: () => {
                  calls.push('b');
                  return true;
                },
              },
            },
          },
        },
      ],
    };

    const manager = buildManager(
      map,
      schema,
      [
        { id: 'a', layer: layerA.layer },
        { id: 'b', layer: layerB.layer },
      ],
      () => [createHitItem({ id: 'x', value: 1 })],
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(calls).toEqual(['a']);
  });

  it('continues propagation when configured', () => {
    const map = createMap();
    const layerA = createLayer('a', 2);
    const layerB = createLayer('b', 1);

    const calls: string[] = [];
    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                propagation: 'continue',
                onClick: () => {
                  calls.push('a');
                  return true;
                },
              },
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                onClick: () => {
                  calls.push('b');
                  return true;
                },
              },
            },
          },
        },
      ],
    };

    const manager = buildManager(
      map,
      schema,
      [
        { id: 'a', layer: layerA.layer },
        { id: 'b', layer: layerB.layer },
      ],
      () => [createHitItem({ id: 'x', value: 1 })],
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(calls).toEqual(['a', 'b']);
  });

  it('treats auto propagation as stop', () => {
    const map = createMap();
    const layerA = createLayer('a', 2);
    const layerB = createLayer('b', 1);

    const calls: string[] = [];
    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                propagation: 'auto',
                onClick: () => {
                  calls.push('a');
                  return true;
                },
              },
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              click: {
                onClick: () => {
                  calls.push('b');
                  return true;
                },
              },
            },
          },
        },
      ],
    };

    const manager = buildManager(
      map,
      schema,
      [
        { id: 'a', layer: layerA.layer },
        { id: 'b', layer: layerB.layer },
      ],
      () => [createHitItem({ id: 'x', value: 1 })],
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(calls).toEqual(['a']);
  });

  it('tracks hover enter/leave per layer with state management', () => {
    const map = createMap();
    const layerA = createLayer('a', 1);
    const layerB = createLayer('b', 0);

    const modelA: Model = { id: 'a', value: 1 };
    const modelB: Model = { id: 'b', value: 2 };
    const itemA = createHitItem(modelA);
    const itemB = createHitItem(modelB);

    const events: string[] = [];
    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              hover: {
                state: 'HOVER',
                onEnter: ({ items }) => {
                  events.push(`enter-${items[0].model.id}`);
                },
                onLeave: ({ items }) => {
                  events.push(`leave-${items[0].model.id}`);
                },
              },
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              hover: {
                state: 'HOVER',
                onEnter: ({ items }) => {
                  events.push(`enter-${items[0].model.id}`);
                },
                onLeave: ({ items }) => {
                  events.push(`leave-${items[0].model.id}`);
                },
              },
            },
          },
        },
      ],
    };

    const hitSequence: Array<Record<string, Array<HitItem<Model, Point>>>> = [
      { a: [itemA], b: [itemB] },
      { a: [], b: [itemB] },
      { a: [], b: [] },
    ];
    let index = 0;

    const manager = buildManager(
      map,
      schema,
      [
        { id: 'a', layer: layerA.layer },
        { id: 'b', layer: layerB.layer },
      ],
      ({ layerId }) => hitSequence[index][layerId],
    );

    manager.handlePointerMove(createEvent(map, 'pointermove'));
    index += 1;
    manager.handlePointerMove(createEvent(map, 'pointermove'));
    index += 1;
    manager.handlePointerMove(createEvent(map, 'pointermove'));

    expect(events).toEqual(['enter-a', 'enter-b', 'leave-a', 'leave-b']);
    expect(getFeatureStates(itemA.feature)).toEqual([]);
    expect(getFeatureStates(itemB.feature)).toEqual([]);
  });

  it('tracks selection per layer with state management', () => {
    const map = createMap();
    const layerA = createLayer('a', 1);
    const layerB = createLayer('b', 0);

    const modelA: Model = { id: 'a', value: 1 };
    const modelB: Model = { id: 'b', value: 2 };
    const itemA = createHitItem(modelA);
    const itemB = createHitItem(modelB);

    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              select: {
                state: 'SELECTED',
                onSelect: () => true,
                onClear: () => false,
              },
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              select: {
                state: 'SELECTED',
                onSelect: () => true,
                onClear: () => false,
              },
            },
          },
        },
      ],
    };

    const hitSequence: Array<Record<string, Array<HitItem<Model, Point>>>> = [
      { a: [itemA], b: [] },
      { a: [], b: [itemB] },
      { a: [], b: [] },
    ];
    let index = 0;

    const manager = buildManager(
      map,
      schema,
      [
        { id: 'a', layer: layerA.layer },
        { id: 'b', layer: layerB.layer },
      ],
      ({ layerId }) => hitSequence[index][layerId],
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(getFeatureStates(itemA.feature)).toEqual(['SELECTED']);
    index += 1;
    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(getFeatureStates(itemA.feature)).toEqual([]);
    expect(getFeatureStates(itemB.feature)).toEqual(['SELECTED']);
    index += 1;
    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(getFeatureStates(itemB.feature)).toEqual([]);
  });

  it('handles select then click ordering on the same layer', () => {
    const map = createMap();
    const layer = createLayer('a', 1);
    const modelA: Model = { id: 'a', value: 1 };
    const itemA = createHitItem(modelA);

    const calls: string[] = [];
    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              select: {
                onSelect: () => {
                  calls.push('select');
                  return true;
                },
              },
              click: {
                onClick: () => {
                  calls.push('click');
                  return true;
                },
              },
            },
          },
        },
      ],
    };

    const manager = buildManager(
      map,
      schema,
      [{ id: 'a', layer: layer.layer }],
      () => [itemA],
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(calls).toEqual(['select']);
  });

  it('allows click after select when propagation continues', () => {
    const map = createMap();
    const layer = createLayer('a', 1);
    const modelA: Model = { id: 'a', value: 1 };
    const itemA = createHitItem(modelA);

    const calls: string[] = [];
    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              select: {
                propagation: 'continue',
                onSelect: () => {
                  calls.push('select');
                  return true;
                },
              },
              click: {
                onClick: () => {
                  calls.push('click');
                  return true;
                },
              },
            },
          },
        },
      ],
    };

    const manager = buildManager(
      map,
      schema,
      [{ id: 'a', layer: layer.layer }],
      () => [itemA],
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(calls).toEqual(['select', 'click']);
  });

  it('supports multi-layer hover/select/click with propagation', () => {
    const map = createMap();
    const layerA = createLayer('a', 3);
    const layerB = createLayer('b', 2);
    const layerC = createLayer('c', 1);

    const itemA = createHitItem({ id: 'a', value: 1 });
    const itemB = createHitItem({ id: 'b', value: 2 });
    const itemC = createHitItem({ id: 'c', value: 3 });

    const events: string[] = [];
    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              hover: {
                onEnter: () => {
                  events.push('hover-a');
                },
              },
              select: {
                onSelect: () => {
                  events.push('select-a');
                  return false;
                },
              },
              click: {
                propagation: 'continue',
                onClick: () => {
                  events.push('click-a');
                  return true;
                },
              },
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              hover: {
                onEnter: () => {
                  events.push('hover-b');
                },
              },
              select: {
                onSelect: () => {
                  events.push('select-b');
                  return false;
                },
              },
              click: {
                propagation: 'continue',
                onClick: () => {
                  events.push('click-b');
                  return true;
                },
              },
            },
          },
        },
        {
          id: 'c',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            interactions: {
              hover: {
                onEnter: () => {
                  events.push('hover-c');
                },
              },
              select: {
                onSelect: () => {
                  events.push('select-c');
                  return false;
                },
              },
              click: {
                onClick: () => {
                  events.push('click-c');
                  return true;
                },
              },
            },
          },
        },
      ],
    };

    const manager = buildManager(
      map,
      schema,
      [
        { id: 'a', layer: layerA.layer },
        { id: 'b', layer: layerB.layer },
        { id: 'c', layer: layerC.layer },
      ],
      ({ layerId }) => {
        if (layerId === 'a') {
          return [itemA];
        }
        if (layerId === 'b') {
          return [itemB];
        }
        return [itemC];
      },
    );

    manager.handlePointerMove(createEvent(map, 'pointermove'));
    manager.handleSingleClick(createEvent(map, 'singleclick'));

    expect(events).toEqual([
      'hover-a',
      'hover-b',
      'hover-c',
      'select-a',
      'click-a',
      'select-b',
      'click-b',
      'select-c',
      'click-c',
    ]);
  });
});
