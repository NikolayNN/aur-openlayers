import Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';

const CLUSTER_FEATURES_KEY = 'features';

export const getClusterFeatures = (
  feature: Feature<Geometry>,
): Array<Feature<Geometry>> | null => {
  const features = feature.get(CLUSTER_FEATURES_KEY);
  if (!Array.isArray(features)) {
    return null;
  }
  const items = features.filter((item): item is Feature<Geometry> => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const candidate = item as { get?: unknown; getGeometry?: unknown };
    return typeof candidate.get === 'function' && typeof candidate.getGeometry === 'function';
  });
  if (items.length === 0) {
    return null;
  }
  return items;
};
