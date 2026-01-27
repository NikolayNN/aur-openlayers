import Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import {createEmpty, extend, isEmpty} from 'ol/extent';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';

import type {
  FeatureDescriptor,
  MapContext,
  ModelChange,
  MutateOptions,
  VectorLayerApi,
  VectorLayerDescriptor,
  ViewFitOptions,
} from '../public/types';
import {FeatureRegistry} from './feature-registry';
import {setFeatureStates} from './style/feature-states';
import {toOlFitOptions} from './fit-layer.utils';

export type VectorLayerBaseOptions<M, G extends Geometry, OPTS extends object> = {
  descriptor: VectorLayerDescriptor<M, G, OPTS>;
  layer: VectorLayer;
  source: VectorSource<G>;
  ctx: MapContext;
  scheduleInvalidate: () => void;
};

export abstract class VectorLayerBase<M, G extends Geometry, OPTS extends object>
  implements VectorLayerApi<M, G>
{
  protected readonly descriptor: FeatureDescriptor<M, G, OPTS>;
  protected readonly layer: VectorLayer;
  protected readonly source: VectorSource<G>;
  protected readonly registry = new FeatureRegistry<M, G>();
  protected readonly scheduleInvalidate: () => void;
  protected readonly ctx: MapContext;
  private readonly changeHandlers = new Set<(changes: ModelChange<M>[]) => void>();

  constructor(options: VectorLayerBaseOptions<M, G, OPTS>) {
    this.descriptor = options.descriptor.feature;
    this.layer = options.layer;
    this.source = options.source;
    this.ctx = options.ctx;
    this.scheduleInvalidate = options.scheduleInvalidate;
  }

  setModels(models: readonly M[]): void {
    this.setModelsInternal(models);
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

  mutate(
    id: string | number,
    update: (prev: M) => M,
    opts?: MutateOptions,
  ): void {
    const prev = this.registry.getModel(id);
    if (!prev) {
      return;
    }
    const next = update(prev);
    if (next === prev) {
      return;
    }
    const reason = opts?.reason ?? 'mutate';
    this.registry.updateModel(id, next);
    this.syncFeatureFromModel(next);
    this.scheduleInvalidate();
    if (!opts?.silent) {
      this.emitModelChanges([{prev, next, reason}]);
    }
  }

  mutateMany(
    ids: Array<string | number>,
    update: (prev: M) => M,
    opts?: MutateOptions,
  ): void {
    const changes: ModelChange<M>[] = [];
    const reason = opts?.reason ?? 'mutate';

    ids.forEach((id) => {
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
      changes.push({prev, next, reason});
    });

    if (changes.length === 0) {
      return;
    }

    this.scheduleInvalidate();
    if (!opts?.silent) {
      this.emitModelChanges(changes);
    }
  }

  onModelsChanged(cb: (changes: ModelChange<M>[]) => void): () => void {
    this.changeHandlers.add(cb);
    return () => this.changeHandlers.delete(cb);
  }

  /** Fit view to all features on the layer. No-op if extent is empty. */
  centerOnAllModels(opts?: ViewFitOptions): void {
    const current = this.getCenterOnAllModelsSource();
    const extent = current?.getExtent?.();
    if (!extent || isEmpty(extent)) {
      return;
    }
    this.ctx.map.getView().fit(extent, toOlFitOptions(opts));
  }

  /** Fit view to a single feature by id. No-op if feature/geometry is missing. */
  centerOnModel(id: string | number, opts?: ViewFitOptions): void {
    const feature = this.registry.getFeature(id);
    const geom = feature?.getGeometry();
    if (!geom) {
      return;
    }
    this.ctx.map.getView().fit(geom.getExtent(), toOlFitOptions(opts));
  }

  /**
   * Fit view to a subset of features by ids (combined extent).
   * Missing ids are ignored. No-op if none found.
   */
  centerOnModels(ids: ReadonlyArray<string | number>, opts?: ViewFitOptions): void {
    const extent = createEmpty();

    let found = false;
    for (const id of ids) {
      const feature = this.registry.getFeature(id);
      const geom = feature?.getGeometry();
      if (!geom) continue;
      extend(extent, geom.getExtent());
      found = true;
    }

    if (!found || isEmpty(extent)) {
      return;
    }

    this.ctx.map.getView().fit(extent, toOlFitOptions(opts));
  }

  setVisible(visible: boolean): void {
    this.layer.setVisible(visible);
  }

  isVisible(): boolean {
    return this.layer.getVisible();
  }

  setOpacity(opacity: number): void {
    this.layer.setOpacity(opacity);
  }

  getOpacity(): number {
    return this.layer.getOpacity();
  }

  getZIndex(): number | undefined {
    return this.layer.getZIndex();
  }

  setZIndex(z: number): void {
    this.layer.setZIndex(z);
  }

  getModelById(id: string | number): M | undefined {
    return this.registry.getModel(id);
  }

  hasModel(id: string | number): boolean {
    return this.registry.getFeature(id) != null;
  }

  getAllModels(): readonly M[] {
    const out: M[] = [];
    this.registry.forEachId((id) => {
      const model = this.registry.getModel(id);
      if (model !== undefined) {
        out.push(model);
      }
    });
    return out;
  }

  getAllModelIds(): Array<string | number> {
    const out: Array<string | number> = [];
    this.registry.forEachId((id) => out.push(id));
    return out;
  }

  setFeatureStates(
    ids: string | number | ReadonlyArray<string | number>,
    states?: string | string[],
  ): void {
    const targetIds = Array.isArray(ids) ? ids : [ids];
    const nextStates = states ? (Array.isArray(states) ? states : [states]) : [];

    targetIds.forEach((id) => {
      const feature = this.registry.getFeature(id);
      if (feature) {
        setFeatureStates(feature, nextStates);
      }
    });

    this.scheduleInvalidate();
  }

  protected setModelsInternal(models: readonly M[]): void {
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
      this.descriptor.geometry.onCreate?.({feature, model, ctx: this.ctx});
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

  protected getCenterOnAllModelsSource(): VectorSource<G> | null {
    return this.source;
  }

  private emitModelChanges(changes: ModelChange<M>[]): void {
    if (changes.length === 0) {
      return;
    }
    this.changeHandlers.forEach((handler) => handler(changes));
  }
}
