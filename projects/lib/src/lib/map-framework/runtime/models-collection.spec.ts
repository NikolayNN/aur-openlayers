import Map from 'ol/Map';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import View from 'ol/View';

import type {
  MapContext,
  ModelsCollectionEvent,
  VectorLayerDescriptor,
} from '../public/types';
import { DuplicateModelIdError } from '../public/types';
import { createMapContext } from './map-context';
import { PlainVectorLayer } from './plain-layer';

type Model = { id: string; coords: [number, number] };

describe('VectorLayer collection API', () => {
  const descriptor: VectorLayerDescriptor<Model, Point, { color: string }> = {
    id: 'points',
    feature: {
      id: (model) => model.id,
      geometry: {
        fromModel: (model) => new Point(model.coords),
        applyGeometryToModel: (prev, geometry) => ({
          ...prev,
          coords: (geometry as Point).getCoordinates() as [number, number],
        }),
      },
      style: {
        base: () => ({ color: 'red' }),
        render: () => new Style(),
      },
    },
  };

  const createCtx = (): MapContext => {
    const map = new Map({
      target: document.createElement('div'),
      view: new View({ center: [0, 0], zoom: 2 }),
      layers: [],
    });
    return createMapContext(map, {});
  };

  const createLayer = () => {
    const source = new VectorSource<Point>();
    const layer = new VectorLayer({ source });
    const ctx = createCtx();
    const plainLayer = new PlainVectorLayer({
      descriptor,
      layer,
      source,
      ctx,
      scheduleInvalidate: () => undefined,
    });
    return { plainLayer };
  };

  it('keeps snapshots immutable and preserves order', () => {
    const { plainLayer } = createLayer();
    const modelA: Model = { id: 'a', coords: [1, 2] };
    const modelB: Model = { id: 'b', coords: [3, 4] };
    const modelC: Model = { id: 'c', coords: [5, 6] };
    const modelD: Model = { id: 'd', coords: [7, 8] };

    const initial = plainLayer.getAllModels();
    expect(initial).toEqual([]);

    plainLayer.setModels([modelA, modelB]);
    const snapshot1 = plainLayer.getAllModels();
    expect(snapshot1).toEqual([modelA, modelB]);
    expect(snapshot1).not.toBe(plainLayer.getAllModels());

    plainLayer.addModel(modelC);
    expect(plainLayer.getAllModels()).toEqual([modelA, modelB, modelC]);

    plainLayer.addModels([modelD]);
    expect(plainLayer.getAllModels()).toEqual([modelA, modelB, modelC, modelD]);

    plainLayer.removeModelsById(['b']);
    expect(plainLayer.getAllModels()).toEqual([modelA, modelC, modelD]);
  });

  it('throws on duplicate ids and does not mutate state or emit events', () => {
    const { plainLayer } = createLayer();
    const modelA: Model = { id: 'a', coords: [1, 2] };
    const duplicateA: Model = { id: 'a', coords: [9, 9] };

    plainLayer.setModels([modelA]);
    const handler = jasmine.createSpy('handler');
    plainLayer.onModelsCollectionChanged(handler);

    expect(() => plainLayer.setModels([modelA, duplicateA])).toThrowError(DuplicateModelIdError);
    expect(plainLayer.getAllModels()).toEqual([modelA]);
    expect(handler).not.toHaveBeenCalled();

    expect(() => plainLayer.addModel(duplicateA)).toThrowError(DuplicateModelIdError);
    expect(plainLayer.getAllModels()).toEqual([modelA]);
    expect(handler).not.toHaveBeenCalled();

    expect(() => plainLayer.addModels([duplicateA])).toThrowError(DuplicateModelIdError);
    expect(plainLayer.getAllModels()).toEqual([modelA]);
    expect(handler).not.toHaveBeenCalled();

    const batchDuplicate: Model = { id: 'b', coords: [5, 6] };
    expect(() => plainLayer.addModels([batchDuplicate, batchDuplicate])).toThrowError(
      DuplicateModelIdError,
    );
    expect(plainLayer.getAllModels()).toEqual([modelA]);
    expect(handler).not.toHaveBeenCalled();

    try {
      plainLayer.addModels([duplicateA]);
      fail('Expected DuplicateModelIdError to be thrown');
    } catch (error) {
      const err = error as DuplicateModelIdError;
      expect(err.name).toBe('DuplicateModelIdError');
      expect(err.id).toBe('a');
      expect(err.layerId).toBe('points');
    }
  });

  it('emits synchronous collection events with correct payloads', () => {
    const { plainLayer } = createLayer();
    const modelA: Model = { id: 'a', coords: [1, 2] };
    const modelB: Model = { id: 'b', coords: [3, 4] };

    let setEvent: ModelsCollectionEvent<Model> | undefined;
    let called = false;
    plainLayer.onModelsCollectionChanged((event) => {
      setEvent = event;
      called = true;
    });

    const input = [modelA];
    plainLayer.setModels(input);
    expect(called).toBeTrue();
    expect(setEvent?.reason).toBe('set');
    expect(setEvent?.prev).toEqual([]);
    expect(setEvent?.next).toEqual([modelA]);
    expect(setEvent?.prev).not.toBe(setEvent?.next);
    expect(setEvent?.next).not.toBe(input);

    const addEvents: ModelsCollectionEvent<Model>[] = [];
    plainLayer.onModelsCollectionChanged((event) => addEvents.push(event));

    plainLayer.addModel(modelB);
    expect(addEvents.length).toBe(1);
    expect(addEvents[0]?.reason).toBe('add');
    expect(addEvents[0]?.prev).toEqual([modelA]);
    expect(addEvents[0]?.next).toEqual([modelA, modelB]);
    expect(addEvents[0]?.added).toEqual([modelB]);
    expect(addEvents[0]?.removed ?? []).toEqual([]);

    const removeCount = plainLayer.removeModelsById(['a']);
    expect(removeCount).toBe(1);
    expect(addEvents.length).toBe(2);
    expect(addEvents[1]?.reason).toBe('remove');
    expect(addEvents[1]?.prev).toEqual([modelA, modelB]);
    expect(addEvents[1]?.next).toEqual([modelB]);
    expect(addEvents[1]?.removed).toEqual([modelA]);
    expect(addEvents[1]?.added ?? []).toEqual([]);

    plainLayer.clear();
    expect(addEvents.length).toBe(3);
    expect(addEvents[2]?.reason).toBe('clear');
    expect(addEvents[2]?.prev).toEqual([modelB]);
    expect(addEvents[2]?.next).toEqual([]);
    expect(addEvents[2]?.removed).toEqual([modelB]);
  });

  it('skips events for no-op remove and clear', () => {
    const { plainLayer } = createLayer();
    const handler = jasmine.createSpy('handler');
    plainLayer.onModelsCollectionChanged(handler);

    const removeCount = plainLayer.removeModelsById(['missing']);
    expect(removeCount).toBe(0);
    expect(handler).not.toHaveBeenCalled();

    plainLayer.clear();
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns correct remove count with duplicates', () => {
    const { plainLayer } = createLayer();
    const modelA: Model = { id: 'a', coords: [1, 2] };
    const modelB: Model = { id: 'b', coords: [3, 4] };
    const modelC: Model = { id: 'c', coords: [5, 6] };

    plainLayer.setModels([modelA, modelB, modelC]);
    const count = plainLayer.removeModelsById(['b', 'missing', 'c', 'c']);
    expect(count).toBe(2);
    expect(plainLayer.getAllModels()).toEqual([modelA]);

    const countDup = plainLayer.removeModelsById(['b', 'b', 'b']);
    expect(countDup).toBe(0);
  });

  it('supports unsubscribe and multiple subscribers', () => {
    const { plainLayer } = createLayer();
    const modelA: Model = { id: 'a', coords: [1, 2] };

    const events1: string[] = [];
    const events2: string[] = [];

    const unsub = plainLayer.onModelsCollectionChanged((event) => events1.push(event.reason));
    plainLayer.onModelsCollectionChanged((event) => events2.push(event.reason));

    plainLayer.setModels([modelA]);
    expect(events1).toEqual(['set']);
    expect(events2).toEqual(['set']);

    unsub();
    plainLayer.clear();
    expect(events1).toEqual(['set']);
    expect(events2).toEqual(['set', 'clear']);
  });
});
