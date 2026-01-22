import Feature from 'ol/Feature';
import Map from 'ol/Map';
import Point from 'ol/geom/Point';
import Style from 'ol/style/Style';
import View from 'ol/View';

import type { FeatureDescriptor } from '../../public/types';
import { createMapContext } from '../map-context';
import { FeatureRegistry } from '../feature-registry';
import { setFeatureStates } from './feature-states';
import { createStyleFunction } from './style-pipeline';

type Model = { id: string; value: number };

describe('createStyleFunction', () => {
  const createCtx = () => {
    const map = new Map({
      target: document.createElement('div'),
      view: new View({ center: [0, 0], zoom: 2 }),
      layers: [],
    });
    return createMapContext(map, {});
  };

  it('applies base and state patches in priority order', () => {
    const renderedValues: number[] = [];
    const descriptor: FeatureDescriptor<Model, Point, { value: number }> = {
      id: (model) => model.id,
      geometry: {
        fromModel: (model) => new Point([model.value, 0]),
        applyGeometryToModel: (prev) => prev,
      },
      style: {
        base: (model) => ({ value: model.value }),
        states: {
          A: () => ({ value: 2 }),
          B: () => ({ value: 3 }),
        },
        statePriority: ['B', 'A'],
        render: (opts) => {
          renderedValues.push(opts.value);
          return new Style();
        },
      },
    };

    const registry = new FeatureRegistry<Model, Point>();
    const model: Model = { id: '1', value: 1 };
    const feature = new Feature<Point>({ geometry: new Point([0, 0]) });
    registry.set(model.id, model, feature);

    setFeatureStates(feature, ['A', 'B']);

    const styleFn = createStyleFunction({
      descriptor,
      ctx: createCtx(),
      registryGetModel: (f) => registry.getModelByFeature(f),
    });

    styleFn(feature, 1);
    expect(renderedValues[0]).toBe(2);
  });

  it('caches styles using cacheKey and reacts to resolution changes', () => {
    let renderCount = 0;
    const descriptor: FeatureDescriptor<Model, Point, { value: number }> = {
      id: (model) => model.id,
      geometry: {
        fromModel: (model) => new Point([model.value, 0]),
        applyGeometryToModel: (prev) => prev,
      },
      style: {
        base: () => ({ value: 1 }),
        render: () => {
          renderCount += 1;
          return new Style();
        },
        cacheKey: (_opts, view) => `key-${view.resolution}`,
      },
    };

    const registry = new FeatureRegistry<Model, Point>();
    const model: Model = { id: '1', value: 1 };
    const feature = new Feature<Point>({ geometry: new Point([0, 0]) });
    registry.set(model.id, model, feature);

    const styleFn = createStyleFunction({
      descriptor,
      ctx: createCtx(),
      registryGetModel: (f) => registry.getModelByFeature(f),
    });

    styleFn(feature, 1);
    styleFn(feature, 1);
    styleFn(feature, 2);

    expect(renderCount).toBe(2);
  });
});
