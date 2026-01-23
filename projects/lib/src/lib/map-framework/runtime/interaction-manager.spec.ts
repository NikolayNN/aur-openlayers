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
  MapContext,
  MapSchema,
  ModelChange,
  ModelChangeReason,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../public/types';
import { createMapContext } from './map-context';
import { InteractionManager, HitTestResult } from './interaction-manager';
import { getFeatureStates } from './style/feature-states';

type Model = { id: string; value: number; coords?: [number, number] };

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

const createApi = (
  overrides: Partial<VectorLayerApi<Model, Point>> = {},
): VectorLayerApi<Model, Point> => {
  return {
    setModels: () => undefined,
    invalidate: () => undefined,
    syncFeatureFromModel: () => undefined,
    getModelByFeature: (feature) => feature.get('model') as Model,
    mutate: (_id, _update, _reason) => undefined,
    ...overrides,
  };
};

const createHitItem = (model: Model): HitItem<Model, Point> => {
  const feature = new Feature<Point>({ geometry: new Point([0, 0]) });
  feature.setId(model.id);
  feature.set('model', model);
  return { model, feature };
};

const createEvent = (map: Map, type: 'pointermove' | 'singleclick') =>
  new MapBrowserEvent(type, map, { pixel: [0, 0] } as unknown as PointerEvent);

const createPointerEvent = (
  map: Map,
  type: 'pointerdown' | 'pointerdrag' | 'pointerup',
  coordinate: [number, number],
) => {
  const event = new MapBrowserEvent(type, map, { pixel: [0, 0] } as unknown as PointerEvent);
  (event as unknown as { coordinate: [number, number] }).coordinate = coordinate;
  return event;
};

const buildManager = (
  map: Map,
  schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]>,
  layerEntries: Array<{ id: string; layer: VectorLayer }>,
  hitTest?: (args: { layerId: string; hitTolerance: number }) => HitTestResult,
  apiFactory: (id: string) => VectorLayerApi<any, any> = () => createApi(),
  popupHost?: MapContext['popupHost'],
) => {
  const layers: Record<string, VectorLayer> = {};
  const apis: Record<string, VectorLayerApi<any, any>> = {};
  layerEntries.forEach((entry) => {
    layers[entry.id] = entry.layer as VectorLayer;
    apis[entry.id] = apiFactory(entry.id);
  });
  const ctx = createMapContext(map, apis, popupHost);
  return new InteractionManager({
    ctx,
    map,
    schema,
    layers,
    apis,
    hitTest: hitTest
      ? ({ layerId, hitTolerance }) => hitTest({ layerId, hitTolerance })
      : undefined,
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
        return { items: [] };
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
      ({ layerId }) => ({ items: itemsByLayer[layerId] }),
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
        return { items: [] };
      },
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));
    expect(tolerances).toEqual([7]);
  });

  it('auto-collects popup items and stops propagation by default', () => {
    const map = createMap();
    const layerA = createLayer('a', 2);
    const layerB = createLayer('b', 1);
    const popupHost = jasmine.createSpyObj('popupHost', [
      'push',
      'set',
      'clear',
      'remove',
      'getItems',
      'mount',
      'dispose',
    ]);

    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      options: {
        popupHost: { autoMode: 'click' },
      },
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            popup: {
              item: ({ model }) => ({ model, content: `a-${model.id}` }),
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            popup: {
              item: ({ model }) => ({ model, content: `b-${model.id}` }),
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
      ({ layerId }) => ({ items: itemsByLayer[layerId] }),
      () => createApi(),
      popupHost,
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));

    expect(popupHost.set).toHaveBeenCalledWith([
      jasmine.objectContaining({ content: 'a-a', source: 'feature' }),
    ]);
  });

  it('auto-collects popup items across layers when propagation continues', () => {
    const map = createMap();
    const layerA = createLayer('a', 2);
    const layerB = createLayer('b', 1);
    const popupHost = jasmine.createSpyObj('popupHost', [
      'push',
      'set',
      'clear',
      'remove',
      'getItems',
      'mount',
      'dispose',
    ]);

    const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
      options: {
        popupHost: { autoMode: 'click', stack: 'continue' },
      },
      layers: [
        {
          id: 'a',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            popup: {
              item: ({ model }) => ({ model, content: `a-${model.id}` }),
            },
          },
        },
        {
          id: 'b',
          feature: {
            id: (m: Model) => m.id,
            geometry: {} as never,
            style: {} as never,
            popup: {
              item: ({ model }) => ({ model, content: `b-${model.id}` }),
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
      ({ layerId }) => ({ items: itemsByLayer[layerId] }),
      () => createApi(),
      popupHost,
    );

    manager.handleSingleClick(createEvent(map, 'singleclick'));

    expect(popupHost.set).toHaveBeenCalledWith([
      jasmine.objectContaining({ content: 'a-a', source: 'feature' }),
      jasmine.objectContaining({ content: 'b-b', source: 'feature' }),
    ]);
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
      () => ({ items: [createHitItem({ id: 'x', value: 1 })] }),
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
      () => ({ items: [createHitItem({ id: 'x', value: 1 })] }),
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
      () => ({ items: [createHitItem({ id: 'x', value: 1 })] }),
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
      ({ layerId }) => ({ items: hitSequence[index][layerId] }),
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
      ({ layerId }) => ({ items: hitSequence[index][layerId] }),
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
      () => ({ items: [itemA] }),
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
      () => ({ items: [itemA] }),
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
          return { items: [itemA] };
        }
        if (layerId === 'b') {
          return { items: [itemB] };
        }
        return { items: [itemC] };
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

  describe('translate interaction', () => {
    const geometry = {
      fromModel: (model: Model) => new Point(model.coords ?? [0, 0]),
      applyGeometryToModel: (prev: Model, nextGeometry: Point) => ({
        ...prev,
        coords: nextGeometry.getCoordinates() as [number, number],
      }),
    };

    it('selects target via pickTarget and defaults to first candidate', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      const itemB = createHitItem({ id: 'b', value: 2, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);
      layer.source.addFeature(itemB.feature);

      const calls: string[] = [];
      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev, next) => ({
                  ...prev,
                  coords: (next as Point).getCoordinates() as [number, number],
                }),
              },
              style: {} as never,
              interactions: {
                translate: {
                  pickTarget: ({ candidates }) => candidates[1],
                  onStart: ({ item }) => {
                    calls.push(item.model.id);
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
        () => ({ items: [itemA, itemB] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(calls).toEqual(['b']);

      calls.length = 0;
      const schemaWithoutPick: MapSchema<
        readonly VectorLayerDescriptor<any, any, any, any>[]
      > = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev, next) => ({
                  ...prev,
                  coords: (next as Point).getCoordinates() as [number, number],
                }),
              },
              style: {} as never,
              interactions: {
                translate: {
                  onStart: ({ item }) => {
                    calls.push(item.model.id);
                    return true;
                  },
                },
              },
            },
          },
        ],
      };

      const managerWithoutPick = buildManager(
        map,
        schemaWithoutPick,
        [{ id: 'a', layer: layer.layer }],
        () => ({ items: [itemB, itemA] }),
      );

      managerWithoutPick.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(calls).toEqual(['b']);
    });

    it('does not start when pickTarget returns null', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      let mutateCalls = 0;
      const api = createApi({
        mutate: (_id, _update, _reason) => {
          mutateCalls += 1;
        },
      });

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev, next) => ({
                  ...prev,
                  coords: (next as Point).getCoordinates() as [number, number],
                }),
              },
              style: {} as never,
              interactions: {
                translate: {
                  state: 'DRAG',
                  pickTarget: () => null,
                  onStart: () => true,
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
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      manager.handlePointerUp(createPointerEvent(map, 'pointerup', [1, 1]));

      expect(getFeatureStates(itemA.feature)).toEqual([]);
      expect(mutateCalls).toBe(0);
    });

    it('resolves targets by id and aborts when missing', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      const updates: number[] = [];
      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev, next) => ({
                  ...prev,
                  coords: (next as Point).getCoordinates() as [number, number],
                }),
              },
              style: {} as never,
              interactions: {
                translate: {
                  state: 'DRAG',
                  onChange: ({ item }) => {
                    updates.push(item.model.value);
                  },
                  onEnd: () => {
                    updates.push(-1);
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
        () => ({ items: [itemA] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      const updatedModel: Model = { id: 'a', value: 42, coords: [0, 0] };
      itemA.feature.set('model', updatedModel);
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      expect(updates).toEqual([42]);

      layer.source.removeFeature(itemA.feature);
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [2, 2]));
      manager.handlePointerUp(createPointerEvent(map, 'pointerup', [2, 2]));

      expect(updates).toEqual([42]);
      expect(getFeatureStates(itemA.feature)).toEqual([]);
    });

    it('mutates with translate reason and notifies changes', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      let model = itemA.model;
      const handlers = new Set<(changes: ModelChange<Model>[]) => void>();
      const changes: ModelChange<Model>[] = [];

      const api = createApi({
        mutate: (_id, update, reason: ModelChangeReason = 'mutate') => {
          const prev = model;
          const next = update(prev);
          if (next === prev) {
            return;
          }
          model = next;
          itemA.feature.set('model', next);
          itemA.feature.setGeometry(new Point(next.coords ?? [0, 0]));
          const batch: ModelChange<Model>[] = [{ prev, next, reason }];
          changes.push(...batch);
          handlers.forEach((handler) => handler(batch));
        },
        onModelsChanged: (cb) => {
          handlers.add(cb);
          return () => handlers.delete(cb);
        },
      });

      const onModelsChanged: ModelChange<Model>[] = [];
      api.onModelsChanged?.((batch) => onModelsChanged.push(...batch));

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev, next) => ({
                  ...prev,
                  coords: (next as Point).getCoordinates() as [number, number],
                }),
              },
              style: {} as never,
              interactions: {
                translate: {
                  onStart: () => undefined,
                  onChange: () => undefined,
                  onEnd: () => undefined,
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
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [5, 5]));

      expect(model.coords).toEqual([5, 5]);
      expect(changes).toEqual([
        {
          prev: { id: 'a', value: 1, coords: [0, 0] },
          next: { id: 'a', value: 1, coords: [5, 5] },
          reason: 'translate',
        },
      ]);
      expect(onModelsChanged).toEqual(changes);
    });

    it('throttles translate moves and flushes trailing update', () => {
      jasmine.clock().install();

      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      let model = itemA.model;
      let mutateCalls = 0;
      const api = createApi({
        mutate: (_id, update, _reason) => {
          mutateCalls += 1;
          model = update(model);
          itemA.feature.set('model', model);
          itemA.feature.setGeometry(new Point(model.coords ?? [0, 0]));
        },
      });

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev, next) => ({
                  ...prev,
                  coords: (next as Point).getCoordinates() as [number, number],
                }),
              },
              style: {} as never,
              interactions: {
                translate: {
                  moveThrottleMs: 100,
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
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [2, 2]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [3, 3]));

      expect(mutateCalls).toBe(1);
      jasmine.clock().tick(100);
      expect(mutateCalls).toBe(2);
      expect(model.coords).toEqual([3, 3]);

      jasmine.clock().uninstall();
    });

    it('applies and clears state during translate activity', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                translate: {
                  state: 'DRAG',
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
        () => ({ items: [itemA] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(getFeatureStates(itemA.feature)).toEqual(['DRAG']);

      manager.handlePointerUp(createPointerEvent(map, 'pointerup', [0, 0]));
      expect(getFeatureStates(itemA.feature)).toEqual([]);
    });

    it('respects propagation when translate starts', () => {
      const map = createMap();
      const layerA = createLayer('a', 2);
      const layerB = createLayer('b', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      const itemB = createHitItem({ id: 'b', value: 2, coords: [0, 0] });
      layerA.source.addFeature(itemA.feature);
      layerB.source.addFeature(itemB.feature);

      const calls: string[] = [];
      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                translate: {
                  onStart: () => {
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
              geometry,
              style: {} as never,
              interactions: {
                translate: {
                  onStart: () => {
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
        ({ layerId }) => ({ items: layerId === 'a' ? [itemA] : [itemB] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(calls).toEqual(['a']);

      calls.length = 0;
      const schemaContinue: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                translate: {
                  propagation: 'continue',
                  onStart: () => {
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
              geometry,
              style: {} as never,
              interactions: {
                translate: {
                  onStart: () => {
                    calls.push('b');
                    return true;
                  },
                },
              },
            },
          },
        ],
      };

      const managerContinue = buildManager(
        map,
        schemaContinue,
        [
          { id: 'a', layer: layerA.layer },
          { id: 'b', layer: layerB.layer },
        ],
        ({ layerId }) => ({ items: layerId === 'a' ? [itemA] : [itemB] }),
      );

      managerContinue.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(calls).toEqual(['a', 'b']);
    });
  });

  describe('modify interaction', () => {
    const geometry = {
      fromModel: (model: Model) => new Point(model.coords ?? [0, 0]),
      applyGeometryToModel: (prev: Model, nextGeometry: Point) => ({
        ...prev,
        coords: nextGeometry.getCoordinates() as [number, number],
      }),
    };

    it('selects target via pickTarget and defaults to first candidate', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      const itemB = createHitItem({ id: 'b', value: 2, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);
      layer.source.addFeature(itemB.feature);

      const calls: string[] = [];
      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  pickTarget: ({ candidates }) => candidates[1],
                  onStart: ({ item }) => {
                    calls.push(item.model.id);
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
        () => ({ items: [itemA, itemB] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(calls).toEqual(['b']);

      calls.length = 0;
      const schemaWithoutPick: MapSchema<
        readonly VectorLayerDescriptor<any, any, any, any>[]
      > = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  onStart: ({ item }) => {
                    calls.push(item.model.id);
                    return true;
                  },
                },
              },
            },
          },
        ],
      };

      const managerWithoutPick = buildManager(
        map,
        schemaWithoutPick,
        [{ id: 'a', layer: layer.layer }],
        () => ({ items: [itemB, itemA] }),
      );

      managerWithoutPick.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(calls).toEqual(['b']);
    });

    it('does not start when pickTarget returns null', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      let mutateCalls = 0;
      const api = createApi({
        mutate: (_id, _update, _reason) => {
          mutateCalls += 1;
        },
      });

      let startCalls = 0;
      let changeCalls = 0;
      let endCalls = 0;
      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  state: 'MODIFY',
                  pickTarget: () => null,
                  onStart: () => {
                    startCalls += 1;
                    return true;
                  },
                  onChange: () => {
                    changeCalls += 1;
                    return true;
                  },
                  onEnd: () => {
                    endCalls += 1;
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
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      manager.handlePointerUp(createPointerEvent(map, 'pointerup', [1, 1]));

      expect(getFeatureStates(itemA.feature)).toEqual([]);
      expect(mutateCalls).toBe(0);
      expect(startCalls).toBe(0);
      expect(changeCalls).toBe(0);
      expect(endCalls).toBe(0);
    });

    it('uses hitTolerance override for modify', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        options: {
          hitTolerance: 0,
        },
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  hitTolerance: 10,
                },
              },
            },
          },
        ],
      };

      const hitTolerances: number[] = [];
      const manager = buildManager(
        map,
        schema,
        [{ id: 'a', layer: layer.layer }],
        ({ hitTolerance }) => {
          hitTolerances.push(hitTolerance);
          return { items: [itemA] };
        },
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));

      expect(hitTolerances).toEqual([10]);
    });

    it('resolves targets by id and aborts when missing', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      const updates: number[] = [];
      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  state: 'MODIFY',
                  onChange: ({ item }) => {
                    updates.push(item.model.value);
                  },
                  onEnd: () => {
                    updates.push(-1);
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
        () => ({ items: [itemA] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      const updatedModel: Model = { id: 'a', value: 42, coords: [0, 0] };
      itemA.feature.set('model', updatedModel);
      itemA.feature.setGeometry(new Point(updatedModel.coords ?? [0, 0]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      expect(updates).toEqual([42]);

      layer.source.removeFeature(itemA.feature);
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [2, 2]));
      manager.handlePointerUp(createPointerEvent(map, 'pointerup', [2, 2]));

      expect(updates).toEqual([42]);
      expect(getFeatureStates(itemA.feature)).toEqual([]);
    });

    it('mutates with modify reason and notifies changes', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      let model = itemA.model;
      const handlers = new Set<(changes: ModelChange<Model>[]) => void>();
      const changes: ModelChange<Model>[] = [];

      const api = createApi({
        mutate: (_id, update, reason: ModelChangeReason = 'mutate') => {
          const prev = model;
          const next = update(prev);
          if (next === prev) {
            return;
          }
          model = next;
          itemA.feature.set('model', next);
          itemA.feature.setGeometry(new Point(next.coords ?? [0, 0]));
          const batch: ModelChange<Model>[] = [{ prev, next, reason }];
          changes.push(...batch);
          handlers.forEach((handler) => handler(batch));
        },
        onModelsChanged: (cb) => {
          handlers.add(cb);
          return () => handlers.delete(cb);
        },
      });

      const onModelsChanged: ModelChange<Model>[] = [];
      api.onModelsChanged?.((batch) => onModelsChanged.push(...batch));

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  onStart: () => undefined,
                  onChange: () => undefined,
                  onEnd: () => undefined,
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
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      itemA.feature.setGeometry(new Point([5, 5]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [5, 5]));

      expect(model.coords).toEqual([5, 5]);
      expect(changes).toEqual([
        {
          prev: { id: 'a', value: 1, coords: [0, 0] },
          next: { id: 'a', value: 1, coords: [5, 5] },
          reason: 'modify',
        },
      ]);
      expect(onModelsChanged).toEqual(changes);
    });

    it('skips change emissions when model update is a no-op', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      let model = itemA.model;
      const changes: ModelChange<Model>[] = [];
      const api = createApi({
        mutate: (_id, update, reason: ModelChangeReason = 'mutate') => {
          const prev = model;
          const next = update(prev);
          if (next === prev) {
            return;
          }
          model = next;
          const batch: ModelChange<Model>[] = [{ prev, next, reason }];
          changes.push(...batch);
        },
      });

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model: Model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev: Model) => prev,
              },
              style: {} as never,
              interactions: {
                modify: {},
              },
            },
          },
        ],
      };

      const manager = buildManager(
        map,
        schema,
        [{ id: 'a', layer: layer.layer }],
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      itemA.feature.setGeometry(new Point([9, 9]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [9, 9]));

      expect(model.coords).toEqual([0, 0]);
      expect(changes).toEqual([]);
    });

    it('throttles modify moves and flushes trailing update', () => {
      jasmine.clock().install();

      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      let model = itemA.model;
      let mutateCalls = 0;
      const api = createApi({
        mutate: (_id, update, _reason) => {
          mutateCalls += 1;
          model = update(model);
          itemA.feature.set('model', model);
          itemA.feature.setGeometry(new Point(model.coords ?? [0, 0]));
        },
      });

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  moveThrottleMs: 100,
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
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      itemA.feature.setGeometry(new Point([1, 1]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      itemA.feature.setGeometry(new Point([2, 2]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [2, 2]));
      itemA.feature.setGeometry(new Point([3, 3]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [3, 3]));

      expect(mutateCalls).toBe(1);
      jasmine.clock().tick(100);
      expect(mutateCalls).toBe(2);
      expect(model.coords).toEqual([3, 3]);

      jasmine.clock().uninstall();
    });

    it('flushes pending modify update on pointerup', () => {
      jasmine.clock().install();

      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      let model = itemA.model;
      let mutateCalls = 0;
      const api = createApi({
        mutate: (_id, update, _reason) => {
          mutateCalls += 1;
          model = update(model);
          itemA.feature.set('model', model);
          itemA.feature.setGeometry(new Point(model.coords ?? [0, 0]));
        },
      });

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  moveThrottleMs: 100,
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
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      itemA.feature.setGeometry(new Point([1, 1]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      itemA.feature.setGeometry(new Point([2, 2]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [2, 2]));

      manager.handlePointerUp(createPointerEvent(map, 'pointerup', [2, 2]));

      expect(mutateCalls).toBe(2);
      expect(model.coords).toEqual([2, 2]);

      jasmine.clock().tick(100);
      expect(mutateCalls).toBe(2);

      jasmine.clock().uninstall();
    });

    it('applies and clears state during modify activity', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  state: 'MODIFY',
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
        () => ({ items: [itemA] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(getFeatureStates(itemA.feature)).toEqual(['MODIFY']);

      manager.handlePointerUp(createPointerEvent(map, 'pointerup', [0, 0]));
      expect(getFeatureStates(itemA.feature)).toEqual([]);

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(getFeatureStates(itemA.feature)).toEqual(['MODIFY']);
      layer.source.removeFeature(itemA.feature);
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      expect(getFeatureStates(itemA.feature)).toEqual([]);
    });

    it('respects propagation when modify starts', () => {
      const map = createMap();
      const layerA = createLayer('a', 2);
      const layerB = createLayer('b', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      const itemB = createHitItem({ id: 'b', value: 2, coords: [0, 0] });
      layerA.source.addFeature(itemA.feature);
      layerB.source.addFeature(itemB.feature);

      const calls: string[] = [];
      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  onStart: () => {
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
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  onStart: () => {
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
        ({ layerId }) => ({ items: layerId === 'a' ? [itemA] : [itemB] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(calls).toEqual(['a']);

      calls.length = 0;
      const schemaContinue: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  propagation: 'continue',
                  onStart: () => {
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
              geometry,
              style: {} as never,
              interactions: {
                modify: {
                  onStart: () => {
                    calls.push('b');
                    return true;
                  },
                },
              },
            },
          },
        ],
      };

      const managerContinue = buildManager(
        map,
        schemaContinue,
        [
          { id: 'a', layer: layerA.layer },
          { id: 'b', layer: layerB.layer },
        ],
        ({ layerId }) => ({ items: layerId === 'a' ? [itemA] : [itemB] }),
      );

      managerContinue.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      expect(calls).toEqual(['a', 'b']);
    });
  });

  describe('clustering interactions', () => {
    it('unwraps single clusters for feature interactions', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const model: Model = { id: 'a', value: 1 };
      const innerFeature = new Feature<Point>({ geometry: new Point([0, 0]) });
      innerFeature.setId('a');
      innerFeature.set('model', model);

      const clusterFeature = new Feature<Point>({
        geometry: new Point([0, 0]),
      });
      clusterFeature.set('features', [innerFeature]);

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
                    expect(items.length).toBe(1);
                    expect(items[0].feature).toBe(innerFeature);
                    return true;
                  },
                },
                hover: {
                  onEnter: ({ items }) => {
                    expect(items.length).toBe(1);
                    expect(items[0].model).toEqual(model);
                    return true;
                  },
                },
              },
            },
          },
        ],
      };

      spyOn(map, 'forEachFeatureAtPixel').and.callFake(
        (
          _pixel,
          callback,
          options?: { layerFilter?: (layer: VectorLayer) => boolean },
        ) => {
          if (options?.layerFilter?.(layer.layer as VectorLayer)) {
            callback(
              clusterFeature,
              layer.layer as VectorLayer,
              innerFeature.getGeometry()!,
            );
          }
          return undefined;
        },
      );

      const manager = buildManager(
        map,
        schema,
        [{ id: 'a', layer: layer.layer }],
        undefined,
        () => createApi(),
      );

      manager.handlePointerMove(createEvent(map, 'pointermove'));
      manager.handleSingleClick(createEvent(map, 'singleclick'));
    });

    it('routes size>1 cluster clicks to expand/popup and stops propagation', () => {
      const map = createMap();
      const view = map.getView();
      const layerA = createLayer('a', 2);
      const layerB = createLayer('b', 1);

      const modelA: Model = { id: 'a', value: 1, coords: [0, 0] };
      const modelB: Model = { id: 'b', value: 2, coords: [10, 10] };
      const featureA = new Feature<Point>({ geometry: new Point([0, 0]) });
      featureA.set('model', modelA);
      const featureB = new Feature<Point>({ geometry: new Point([10, 10]) });
      featureB.set('model', modelB);
      const clusterFeature = new Feature<Point>({ geometry: new Point([5, 5]) });

      const onClick = jasmine.createSpy('onClick');
      const onSelect = jasmine.createSpy('onSelect');
      const onPopup = jasmine.createSpy('popup').and.returnValue({
        model: modelA,
        content: 'cluster',
      });
      const popupHost = jasmine.createSpyObj('popupHost', [
        'push',
        'set',
        'clear',
        'remove',
        'getItems',
        'mount',
        'dispose',
      ]);

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {} as never,
              style: {} as never,
              interactions: {
                click: { onClick },
                select: { onSelect },
              },
            },
            clustering: {
              clusterStyle: { render: () => [] },
              expandOnClick: {
                mode: 'zoomToExtent',
              },
              popup: {
                enabled: true,
                item: onPopup,
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
                    throw new Error('should not reach lower layer');
                  },
                },
              },
            },
          },
        ],
      };

      const hitTest = ({ layerId }: { layerId: string }) =>
        layerId === 'a'
          ? {
              items: [],
              cluster: {
                feature: clusterFeature,
                features: [featureA, featureB],
                size: 2,
              },
            }
          : {
              items: [createHitItem({ id: 'lower', value: 1 })],
            };

      const apiFactory = (id: string) =>
        createApi({
          isClusteringEnabled: () => id === 'a',
        });

      const fitSpy = spyOn(view, 'fit').and.stub();

      const manager = buildManager(
        map,
        schema,
        [
          { id: 'a', layer: layerA.layer },
          { id: 'b', layer: layerB.layer },
        ],
        hitTest,
        apiFactory,
        popupHost,
      );

      manager.handleSingleClick(createEvent(map, 'singleclick'));

      expect(onClick).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
      expect(fitSpy).toHaveBeenCalled();
      expect(onPopup).toHaveBeenCalledWith({
        models: [modelA, modelB],
        size: 2,
        ctx: jasmine.any(Object),
        event: jasmine.any(Object),
      });
      expect(popupHost.push).toHaveBeenCalledWith([
        jasmine.objectContaining({
          content: 'cluster',
          source: 'cluster',
        }),
      ]);
    });

    it('auto-collects cluster popup items without double-calling', () => {
      const map = createMap();
      const layerA = createLayer('a', 2);
      const modelA: Model = { id: 'a', value: 1, coords: [0, 0] };
      const modelB: Model = { id: 'b', value: 2, coords: [10, 10] };
      const featureA = new Feature<Point>({ geometry: new Point([0, 0]) });
      featureA.set('model', modelA);
      const featureB = new Feature<Point>({ geometry: new Point([10, 10]) });
      featureB.set('model', modelB);
      const clusterFeature = new Feature<Point>({ geometry: new Point([5, 5]) });
      const popupHost = jasmine.createSpyObj('popupHost', [
        'push',
        'set',
        'clear',
        'remove',
        'getItems',
        'mount',
        'dispose',
      ]);
      const onPopup = jasmine.createSpy('popup').and.returnValue({
        model: modelA,
        content: 'cluster',
      });

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        options: {
          popupHost: { autoMode: 'click' },
        },
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {} as never,
              style: {} as never,
            },
            clustering: {
              clusterStyle: { render: () => [] },
              popup: {
                enabled: true,
                item: onPopup,
              },
            },
          },
        ],
      };

      const hitTest = () => ({
        items: [],
        cluster: {
          feature: clusterFeature,
          features: [featureA, featureB],
          size: 2,
        },
      });

      const manager = buildManager(
        map,
        schema,
        [{ id: 'a', layer: layerA.layer }],
        hitTest,
        () =>
          createApi({
            isClusteringEnabled: () => true,
          }),
        popupHost,
      );

      manager.handleSingleClick(createEvent(map, 'singleclick'));

      expect(onPopup.calls.count()).toBe(1);
      expect(popupHost.set).toHaveBeenCalledWith([
        jasmine.objectContaining({
          content: 'cluster',
          source: 'cluster',
        }),
      ]);
      expect(popupHost.push).not.toHaveBeenCalled();
    });

    it('keeps cluster dedupKey stable across model order', () => {
      const map = createMap();
      const layerA = createLayer('a', 2);
      const modelA: Model = { id: 'a', value: 1, coords: [0, 0] };
      const modelB: Model = { id: 'b', value: 2, coords: [10, 10] };
      const featureA = new Feature<Point>({ geometry: new Point([0, 0]) });
      featureA.set('model', modelA);
      const featureB = new Feature<Point>({ geometry: new Point([10, 10]) });
      featureB.set('model', modelB);
      const clusterFeature = new Feature<Point>({ geometry: new Point([5, 5]) });
      const popupHost = jasmine.createSpyObj('popupHost', [
        'push',
        'set',
        'clear',
        'remove',
        'getItems',
        'mount',
        'dispose',
      ]);

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        options: {
          popupHost: { autoMode: 'click' },
        },
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {} as never,
              style: {} as never,
            },
            clustering: {
              clusterStyle: { render: () => [] },
              popup: {
                enabled: true,
                item: ({ models }) => ({
                  model: models[0],
                  content: `cluster-${models.length}`,
                }),
              },
            },
          },
        ],
      };

      let callCount = 0;
      const hitTest = () => {
        callCount += 1;
        return {
          items: [],
          cluster: {
            feature: clusterFeature,
            features: callCount === 1 ? [featureA, featureB] : [featureB, featureA],
            size: 2,
          },
        };
      };

      const manager = buildManager(
        map,
        schema,
        [{ id: 'a', layer: layerA.layer }],
        hitTest,
        () =>
          createApi({
            isClusteringEnabled: () => true,
          }),
        popupHost,
      );

      manager.handleSingleClick(createEvent(map, 'singleclick'));
      manager.handleSingleClick(createEvent(map, 'singleclick'));

      const firstItem = popupHost.set.calls.argsFor(0)[0][0];
      const secondItem = popupHost.set.calls.argsFor(1)[0][0];
      expect(firstItem.dedupKey).toBe(secondItem.dedupKey);
    });

    it('skips expand when disabled and allows propagation', () => {
      const map = createMap();
      const view = map.getView();
      const layerA = createLayer('a', 2);
      const layerB = createLayer('b', 1);

      const modelA: Model = { id: 'a', value: 1, coords: [0, 0] };
      const modelB: Model = { id: 'b', value: 2, coords: [10, 10] };
      const featureA = new Feature<Point>({ geometry: new Point([0, 0]) });
      featureA.set('model', modelA);
      const featureB = new Feature<Point>({ geometry: new Point([10, 10]) });
      featureB.set('model', modelB);
      const clusterFeature = new Feature<Point>({ geometry: new Point([5, 5]) });

      const lowerClick = jasmine.createSpy('lowerClick');
      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {} as never,
              style: {} as never,
            },
            clustering: {
              clusterStyle: { render: () => [] },
            },
          },
          {
            id: 'b',
            feature: {
              id: (m: Model) => m.id,
              geometry: {} as never,
              style: {} as never,
              interactions: {
                click: { onClick: () => lowerClick() },
              },
            },
          },
        ],
      };

      const hitTest = ({ layerId }: { layerId: string }) =>
        layerId === 'a'
          ? {
              items: [],
              cluster: {
                feature: clusterFeature,
                features: [featureA, featureB],
                size: 2,
              },
            }
          : {
              items: [createHitItem({ id: 'lower', value: 1 })],
            };

      const apiFactory = (id: string) =>
        createApi({
          isClusteringEnabled: () => id === 'a',
        });

      const fitSpy = spyOn(view, 'fit').and.stub();
      const animateSpy = spyOn(view, 'animate').and.stub();

      const manager = buildManager(
        map,
        schema,
        [
          { id: 'a', layer: layerA.layer },
          { id: 'b', layer: layerB.layer },
        ],
        hitTest,
        apiFactory,
      );

      manager.handleSingleClick(createEvent(map, 'singleclick'));

      expect(fitSpy).not.toHaveBeenCalled();
      expect(animateSpy).not.toHaveBeenCalled();
      expect(lowerClick).toHaveBeenCalled();
    });
  });

  describe('enabled toggles', () => {
    it('detaches listeners and skips handlers when disabled', () => {
      const map = createMap();
      const onSpy = spyOn(map, 'on').and.callThrough();
      const layer = createLayer('a', 1);
      let enabled = true;
      const onClick = jasmine.createSpy('onClick');

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
                  enabled: () => enabled,
                  onClick,
                },
              },
            },
          },
        ],
      };

      const itemA = createHitItem({ id: 'a', value: 1 });
      const manager = buildManager(
        map,
        schema,
        [{ id: 'a', layer: layer.layer }],
        () => ({ items: [itemA] }),
      );
      const eventTypes = onSpy.calls.allArgs().map((args) => String(args[0]));
      expect(eventTypes).toContain('singleclick');

      manager.handleSingleClick(createEvent(map, 'singleclick'));
      expect(onClick).toHaveBeenCalledTimes(1);

      enabled = false;
      manager.refreshEnabled();

      manager.handleSingleClick(createEvent(map, 'singleclick'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('clears translate throttles on disable', () => {
      jasmine.clock().install();

      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);
      let enabled = true;
      let mutateCalls = 0;

      const api = createApi({
        mutate: (_id, update, _reason) => {
          mutateCalls += 1;
          const model = update(itemA.model);
          itemA.feature.set('model', model);
          itemA.feature.setGeometry(new Point(model.coords ?? [0, 0]));
        },
      });

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev, next) => ({
                  ...prev,
                  coords: (next as Point).getCoordinates() as [number, number],
                }),
              },
              style: {} as never,
              interactions: {
                translate: {
                  enabled: () => enabled,
                  moveThrottleMs: 100,
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
        () => ({ items: [itemA] }),
        () => api,
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [1, 1]));
      manager.handlePointerDrag(createPointerEvent(map, 'pointerdrag', [2, 2]));
      expect(mutateCalls).toBe(1);

      enabled = false;
      manager.refreshEnabled();
      jasmine.clock().tick(100);
      expect(mutateCalls).toBe(1);

      jasmine.clock().uninstall();
    });

    it('does not call onEnd when translate is disabled', () => {
      const map = createMap();
      const layer = createLayer('a', 1);
      const itemA = createHitItem({ id: 'a', value: 1, coords: [0, 0] });
      layer.source.addFeature(itemA.feature);
      let enabled = true;
      const onEnd = jasmine.createSpy('onEnd');

      const schema: MapSchema<readonly VectorLayerDescriptor<any, any, any, any>[]> = {
        layers: [
          {
            id: 'a',
            feature: {
              id: (m: Model) => m.id,
              geometry: {
                fromModel: (model) => new Point(model.coords ?? [0, 0]),
                applyGeometryToModel: (prev, next) => ({
                  ...prev,
                  coords: (next as Point).getCoordinates() as [number, number],
                }),
              },
              style: {} as never,
              interactions: {
                translate: {
                  enabled: () => enabled,
                  onEnd,
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
        () => ({ items: [itemA] }),
      );

      manager.handlePointerDown(createPointerEvent(map, 'pointerdown', [0, 0]));
      enabled = false;
      manager.refreshEnabled();

      expect(onEnd).not.toHaveBeenCalled();
    });
  });
});
