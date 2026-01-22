import Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';

import type {
  FeatureDescriptor,
  MapContext,
  ModelChange,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../public/types';
import { FeatureRegistry } from './feature-registry';
import { createStyleFunction } from './style/style-pipeline';

export type PlainLayerOptions<M, G extends Geometry, OPTS extends object> = {
  descriptor: VectorLayerDescriptor<M, G, OPTS>;
  layer: VectorLayer;
  source: VectorSource<G>;
  ctx: MapContext;
  scheduleInvalidate: () => void;
};

export class PlainVectorLayer<M, G extends Geometry, OPTS extends object>
  implements VectorLayerApi<M, G>
{
  private readonly descriptor: FeatureDescriptor<M, G, OPTS>;
  private readonly layer: VectorLayer;
  private readonly source: VectorSource<G>;
  private readonly registry = new FeatureRegistry<M, G>();
  private readonly scheduleInvalidate: () => void;
  private readonly ctx: MapContext;
  private readonly changeHandlers = new Set<(changes: ModelChange<M>[]) => void>();

  constructor(options: PlainLayerOptions<M, G, OPTS>) {
    this.descriptor = options.descriptor.feature;
    this.layer = options.layer;
    this.source = options.source;
    this.ctx = options.ctx;
    this.scheduleInvalidate = options.scheduleInvalidate;

    this.layer.setStyle(
      createStyleFunction({
        descriptor: this.descriptor,
        ctx: this.ctx,
        registryGetModel: (feature) => this.registry.getModelByFeature(feature as Feature<G>),
        map: this.ctx.map,
      }),
    );
  }

  setModels(models: readonly M[]): void {
    const nextIds = new Set<string | number>();
    models.forEach((model) => {
      const id = this.descriptor.id(model);
      nextIds.add(id);
      const existingFeature = this.registry.getFeature(id);
      if (existingFeature) {
        const prevModel = this.registry.getModel(id);
        if (prevModel !== model) {
          this.registry.updateModel(id, model);
          existingFeature.setGeometry(this.descriptor.geometry.fromModel(model));
        }
        return;
      }

      const feature = new Feature<G>({
        geometry: this.descriptor.geometry.fromModel(model),
      });
      feature.setId(id);
      this.registry.set(id, model, feature);
      this.source.addFeature(feature);
      this.descriptor.geometry.onCreate?.({ feature, model, ctx: this.ctx });
    });

    const toRemove: Array<string | number> = [];
    this.registry.forEachId((id) => {
      if (!nextIds.has(id)) {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => {
      const feature = this.registry.remove(id);
      if (feature) {
        this.source.removeFeature(feature);
      }
    });
  }

  invalidate(): void {
    this.scheduleInvalidate();
  }

  syncFeatureFromModel(model: M): void {
    const id = this.descriptor.id(model);
    const feature = this.registry.getFeature(id);
    if (!feature) {
      return;
    }
    feature.setGeometry(this.descriptor.geometry.fromModel(model));
  }

  getModelByFeature(feature: Feature<G>): M | undefined {
    return this.registry.getModelByFeature(feature);
  }

  mutate(id: string | number, update: (prev: M) => M): void {
    const prev = this.registry.getModel(id);
    if (!prev) {
      return;
    }
    const next = update(prev);
    if (next === prev) {
      return;
    }
    this.registry.updateModel(id, next);
    this.syncFeatureFromModel(next);
    this.scheduleInvalidate();
    this.emitModelChanges([{ prev, next, reason: 'mutate' }]);
  }

  onModelsChanged(cb: (changes: ModelChange<M>[]) => void): () => void {
    this.changeHandlers.add(cb);
    return () => this.changeHandlers.delete(cb);
  }

  private emitModelChanges(changes: ModelChange<M>[]): void {
    if (changes.length === 0) {
      return;
    }
    this.changeHandlers.forEach((handler) => handler(changes));
  }
}
