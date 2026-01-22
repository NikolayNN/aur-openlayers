import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';

export class FeatureRegistry<M, G extends Geometry> {
  private readonly idToModel = new Map<string | number, M>();
  private readonly idToFeature = new Map<string | number, Feature<G>>();
  private readonly featureToId = new WeakMap<Feature<G>, string | number>();

  set(id: string | number, model: M, feature: Feature<G>): void {
    this.idToModel.set(id, model);
    this.idToFeature.set(id, feature);
    this.featureToId.set(feature, id);
  }

  updateModel(id: string | number, model: M): void {
    if (!this.idToModel.has(id)) {
      return;
    }
    this.idToModel.set(id, model);
  }

  getModel(id: string | number): M | undefined {
    return this.idToModel.get(id);
  }

  getFeature(id: string | number): Feature<G> | undefined {
    return this.idToFeature.get(id);
  }

  getIdByFeature(feature: Feature<G>): string | number | undefined {
    return this.featureToId.get(feature);
  }

  getModelByFeature(feature: Feature<G>): M | undefined {
    const id = this.featureToId.get(feature);
    if (id === undefined) {
      return undefined;
    }
    return this.idToModel.get(id);
  }

  has(id: string | number): boolean {
    return this.idToModel.has(id);
  }

  remove(id: string | number): Feature<G> | undefined {
    const feature = this.idToFeature.get(id);
    if (!feature) {
      return undefined;
    }
    this.idToModel.delete(id);
    this.idToFeature.delete(id);
    this.featureToId.delete(feature);
    return feature;
  }

  forEachId(fn: (id: string | number) => void): void {
    this.idToModel.forEach((_model, id) => fn(id));
  }
}
