import Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type OlMap from 'ol/Map';
import type { StyleFunction } from 'ol/style/Style';

import type {
  FeatureDescriptor,
  FeatureStyleState,
  LayerClustering,
  MapContext,
  MaybeFn,
  Patch,
  StyleView,
} from '../../public/types';
import { getClusterFeatures } from '../cluster-utils';
import { getFeatureStates } from './feature-states';
import { StyleCache } from './style-cache';

export type StylePipelineOptions<M, G extends Geometry, OPTS extends object> = {
  descriptor: FeatureDescriptor<M, G, OPTS>;
  ctx: MapContext;
  registryGetModel: (feature: Feature<Geometry>) => M | undefined;
  map?: OlMap;
};

const resolveMaybeFn = <T, A extends any[]>(value: MaybeFn<T, A>, args: A): T => {
  if (typeof value === 'function') {
    return (value as (...fnArgs: A) => T)(...args);
  }
  return value;
};

const applyPatch = <T extends object>(opts: T, patch: Patch<T>): T => {
  const patchValue = typeof patch === 'function' ? patch(opts) : patch;
  return { ...opts, ...patchValue };
};

const orderStates = (
  states: FeatureStyleState[],
  priority?: FeatureStyleState[],
): FeatureStyleState[] => {
  if (!priority || priority.length === 0) {
    return states;
  }
  const prioritySet = new Set(priority);
  const ordered = priority.filter((state) => states.includes(state));
  const rest = states.filter((state) => !prioritySet.has(state));
  return [...ordered, ...rest];
};

export const createStyleFunction = <M, G extends Geometry, OPTS extends object>(
  options: StylePipelineOptions<M, G, OPTS>,
): StyleFunction => {
  const { descriptor, registryGetModel, map } = options;
  const { style } = descriptor;
  const cache = new StyleCache();

  return (feature, resolution) => {
    if (!(feature instanceof Feature)) {
      return [];
    }
    const model = registryGetModel(feature);
    if (!model) {
      return [];
    }
    const view: StyleView = {
      resolution,
      zoom: map?.getView().getZoom(),
    };
    let opts = resolveMaybeFn(style.base, [model, view]);

    if (style.states) {
      const featureStates = orderStates(getFeatureStates(feature), style.statePriority);
      featureStates.forEach((state) => {
        const patchFactory = style.states?.[state];
        if (!patchFactory) {
          return;
        }
        const patch = resolveMaybeFn(patchFactory, [model, view]);
        opts = applyPatch(opts, patch);
      });
    }

    if (style.cacheKey) {
      const key = style.cacheKey(opts, view);
      if (key) {
        const cached = cache.get(key);
        if (cached) {
          return cached;
        }
        const rendered = style.render(opts, view);
        cache.set(key, rendered);
        return rendered;
      }
    }

    return style.render(opts, view);
  };
};

export type ClusterStylePipelineOptions<M, G extends Geometry, OPTS extends object> = {
  descriptor: FeatureDescriptor<M, G, OPTS>;
  clustering: LayerClustering<M>;
  ctx: MapContext;
  registryGetModel: (feature: Feature<Geometry>) => M | undefined;
  map?: OlMap;
};

export const createClusterStyleFunction = <M, G extends Geometry, OPTS extends object>(
  options: ClusterStylePipelineOptions<M, G, OPTS>,
): StyleFunction => {
  const { clustering, registryGetModel, map } = options;
  const baseStyle = createStyleFunction(options);
  const cache = new StyleCache();

  return (feature, resolution) => {
    if (!(feature instanceof Feature)) {
      return [];
    }
    const clusterFeatures = getClusterFeatures(feature);
    if (!clusterFeatures) {
      return baseStyle(feature, resolution);
    }

    const size = clusterFeatures.length;
    if (size === 1) {
      return baseStyle(clusterFeatures[0], resolution);
    }

    const models = clusterFeatures
      .map((clusterFeature) => registryGetModel(clusterFeature))
      .filter((model): model is M => model !== undefined);
    const view: StyleView = {
      resolution,
      zoom: map?.getView().getZoom(),
    };

    if (clustering.clusterStyle.cacheKey) {
      const key = clustering.clusterStyle.cacheKey({ models, size, view });
      if (key) {
        const cached = cache.get(key);
        if (cached) {
          return cached;
        }
        const rendered = clustering.clusterStyle.render({ models, size, view });
        cache.set(key, rendered);
        return rendered;
      }
    }

    return clustering.clusterStyle.render({ models, size, view });
  };
};
