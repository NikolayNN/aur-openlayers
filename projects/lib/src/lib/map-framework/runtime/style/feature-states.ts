import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';

const STATES_KEY = '__mff_states__';

export const getFeatureStates = (feature: Feature<Geometry>): string[] => {
  const states = feature.get(STATES_KEY);
  if (Array.isArray(states)) {
    return states;
  }
  if (typeof states === 'string') {
    return [states];
  }
  return [];
};

export const setFeatureStates = (feature: Feature<Geometry>, states: string[]): void => {
  feature.set(STATES_KEY, states);
};

export const clearFeatureStates = (feature: Feature<Geometry>): void => {
  feature.set(STATES_KEY, []);
};
