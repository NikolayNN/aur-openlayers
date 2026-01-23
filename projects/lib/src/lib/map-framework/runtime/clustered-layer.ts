import Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type VectorLayer from 'ol/layer/Vector';
import {createEmpty, extend, isEmpty} from 'ol/extent';
import type ClusterSource from 'ol/source/Cluster';
import type VectorSource from 'ol/source/Vector';

import type {
  FeatureDescriptor,
  MapContext,
  ModelChange,
  VectorLayerApi,
  VectorLayerDescriptor, ViewFitOptions,
} from '../public/types';
import { FeatureRegistry } from './feature-registry';
import { clearFeatureStates } from './style/feature-states';
import { createClusterStyleFunction } from './style/style-pipeline';
import {toOlFitOptions} from './fit-layer.utils';

export type ClusteredLayerOptions<M, G extends Geometry, OPTS extends object> = {
  descriptor: VectorLayerDescriptor<M, G, OPTS>;
  layer: VectorLayer;
  source: VectorSource<G>;
  clusterSource: ClusterSource;
  ctx: MapContext;
  scheduleInvalidate: () => void;
};

export class ClusteredVectorLayer<M, G extends Geometry, OPTS extends object>
  implements VectorLayerApi<M, G>
{
  private readonly descriptor: FeatureDescriptor<M, G, OPTS>;
  private readonly layer: VectorLayer;
  private readonly source: VectorSource<G>;
  private readonly clusterSource: ClusterSource;
  private readonly registry = new FeatureRegistry<M, G>();
  private readonly scheduleInvalidate: () => void;
  private readonly ctx: MapContext;
  private readonly changeHandlers = new Set<(changes: ModelChange<M>[]) => void>();
  private clusteringEnabled: boolean;

  constructor(options: ClusteredLayerOptions<M, G, OPTS>) {
    this.descriptor = options.descriptor.feature;
    this.layer = options.layer;
    this.source = options.source;
    this.clusterSource = options.clusterSource;
    this.ctx = options.ctx;
    this.scheduleInvalidate = options.scheduleInvalidate;
    this.clusteringEnabled = options.descriptor.clustering?.enabledByDefault ?? false;

    this.layer.setStyle(
      createClusterStyleFunction({
        descriptor: this.descriptor,
        clustering: options.descriptor.clustering!,
        ctx: this.ctx,
        registryGetModel: (feature) => this.registry.getModelByFeature(feature as Feature<G>),
        map: this.ctx.map,
      }),
    );

    this.layer.setSource(
      this.clusteringEnabled ? (this.clusterSource as unknown as VectorSource<G>) : this.source,
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
    this.scheduleInvalidate();
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
    reason: ModelChange<M>['reason'] = 'mutate',
  ): void {
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
    this.emitModelChanges([{ prev, next, reason }]);
  }

  setClusteringEnabled(enabled: boolean): void {
    if (this.clusteringEnabled === enabled) {
      return;
    }
    this.clusteringEnabled = enabled;
    this.clearInteractionStates();
    this.layer.setSource(
      enabled ? (this.clusterSource as unknown as VectorSource<G>) : this.source,
    );
    if (enabled) {
      const view = this.ctx.map.getView();
      const resolution = view.getResolution() ?? 1;
      this.clusterSource.loadFeatures(createEmpty(), resolution, view.getProjection());
      this.clusterSource.refresh();
    }
    this.scheduleInvalidate();
  }

  isClusteringEnabled(): boolean {
    return this.clusteringEnabled;
  }

  onModelsChanged(cb: (changes: ModelChange<M>[]) => void): () => void {
    this.changeHandlers.add(cb);
    return () => this.changeHandlers.delete(cb);
  }

  /** Fit view to all visible features on this layer (clustered or plain). */
  centerOnAllModels(opts?: ViewFitOptions): void {
    const current = this.layer.getSource() as unknown as VectorSource<any> | null;
    const extent = current?.getExtent?.();
    if (!extent || isEmpty(extent)) return;

    this.ctx.map.getView().fit(extent, toOlFitOptions(opts));
  }

  /** Fit view to a single model feature by id (uses underlying plain feature geometry). */
  centerOnModel(id: string | number, opts?: ViewFitOptions): void {
    const feature = this.registry.getFeature(id);
    const geom = feature?.getGeometry();
    if (!geom) return;

    this.ctx.map.getView().fit(geom.getExtent(), toOlFitOptions(opts));
  }

  /** Fit view to a subset of model features by ids (combined extent). */
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

    if (!found || isEmpty(extent)) return;

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


  private emitModelChanges(changes: ModelChange<M>[]): void {
    if (changes.length === 0) {
      return;
    }
    this.changeHandlers.forEach((handler) => handler(changes));
  }

  private clearInteractionStates(): void {
    this.registry.forEachId((id) => {
      const feature = this.registry.getFeature(id);
      if (feature) {
        clearFeatureStates(feature);
      }
    });
  }
}
