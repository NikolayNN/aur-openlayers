import Feature from 'ol/Feature';
import Map from 'ol/Map';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import View from 'ol/View';

import type { MapContext, VectorLayerDescriptor } from '../public/types';
import { createMapContext } from './map-context';
import { PlainVectorLayer } from './plain-layer';

type Model = { id: string; coords: [number, number] };

describe('PlainVectorLayer', () => {
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

  it('adds, removes, and updates models', () => {
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

    const modelA: Model = { id: 'a', coords: [1, 2] };
    const modelB: Model = { id: 'b', coords: [3, 4] };

    plainLayer.setModels([modelA, modelB]);
    expect(source.getFeatures().length).toBe(2);

    const featureA = source
      .getFeatures()
      .find((feature: Feature<Point>) => feature.getId() === 'a') as Feature<Point>;
    plainLayer.setModels([modelA]);
    expect(source.getFeatures().length).toBe(1);

    const updatedModelA: Model = { id: 'a', coords: [9, 9] };
    plainLayer.setModels([updatedModelA]);
    const updatedFeatureA = source.getFeatures()[0] as Feature<Point>;
    expect(updatedFeatureA).toBe(featureA);
    expect((updatedFeatureA.getGeometry() as Point).getCoordinates()).toEqual([9, 9]);
  });

  it('mutates models with invalidation and change notifications', () => {
    const source = new VectorSource<Point>();
    const layer = new VectorLayer({ source });
    const ctx = createCtx();
    let invalidateCount = 0;
    const plainLayer = new PlainVectorLayer({
      descriptor,
      layer,
      source,
      ctx,
      scheduleInvalidate: () => {
        invalidateCount += 1;
      },
    });

    const modelA: Model = { id: 'a', coords: [1, 2] };
    plainLayer.setModels([modelA]);

    let changes = 0;
    plainLayer.onModelsChanged((batch) => {
      changes += batch.length;
    });

    plainLayer.mutate('a', (prev) => prev);
    expect(invalidateCount).toBe(0);

    plainLayer.mutate('a', (prev) => ({ ...prev, coords: [7, 8] }));
    const featureA = source.getFeatures()[0] as Feature<Point>;
    expect((featureA.getGeometry() as Point).getCoordinates()).toEqual([7, 8]);
    expect(invalidateCount).toBe(1);
    expect(changes).toBe(1);
  });

  it('mutates models silently without notifications', () => {
    const source = new VectorSource<Point>();
    const layer = new VectorLayer({ source });
    const ctx = createCtx();
    let invalidateCount = 0;
    const plainLayer = new PlainVectorLayer({
      descriptor,
      layer,
      source,
      ctx,
      scheduleInvalidate: () => {
        invalidateCount += 1;
      },
    });

    const modelA: Model = { id: 'a', coords: [1, 2] };
    plainLayer.setModels([modelA]);

    let changes = 0;
    plainLayer.onModelsChanged((batch) => {
      changes += batch.length;
    });

    plainLayer.mutate('a', (prev) => ({ ...prev, coords: [5, 6] }), {silent: true});
    const featureA = source.getFeatures()[0] as Feature<Point>;
    expect((featureA.getGeometry() as Point).getCoordinates()).toEqual([5, 6]);
    expect(invalidateCount).toBe(1);
    expect(changes).toBe(0);
  });
});
