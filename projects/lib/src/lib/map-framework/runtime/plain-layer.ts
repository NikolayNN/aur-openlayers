import Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import {createStyleFunction} from './style/style-pipeline';
import {VectorLayerBase, VectorLayerBaseOptions} from './vector-layer-base';

export type PlainLayerOptions<M, G extends Geometry, OPTS extends object> =
  VectorLayerBaseOptions<M, G, OPTS>;

export class PlainVectorLayer<M, G extends Geometry, OPTS extends object> extends VectorLayerBase<
  M,
  G,
  OPTS
> {
  constructor(options: PlainLayerOptions<M, G, OPTS>) {
    super(options);

    this.layer.setStyle(
      createStyleFunction({
        descriptor: this.descriptor,
        ctx: this.ctx,
        registryGetModel: (feature) => this.registry.getModelByFeature(feature as Feature<G>),
        map: this.ctx.map,
      }),
    );
  }
}
