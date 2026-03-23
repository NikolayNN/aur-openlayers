import {Component} from '@angular/core';
import {
  MapContext,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
import {MapHostComponent, MapHostConfig} from '../shared/map-host/map-host.component';
import {DemoHeaderComponent} from '../shared/demo-header/demo-header.component';
import type Geometry from 'ol/geom/Geometry';
import Point from 'ol/geom/Point';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import {
  applyGeometryToMapPoint,
  mapPointToGeometry,
  MapPoint,
  MapPointGenerator,
} from '../shared/map-point';

const LAYER_ID = {
  A: 'a',
  B: 'b',
  C: 'c',
} as const;

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

const gen = new MapPointGenerator();
const POINTS_A = gen.getByIds(['minsk-arena', 'minsk-lake', 'minsk-island']);
const POINTS_B = gen.getByIds(['minsk-library', 'minsk-botanical', 'minsk-parkstone']);
const POINTS_C = gen.getByIds(['minsk-tractors', 'minsk-zoo', 'minsk-chizhovka']);

const pointLayer = (id: string, color: string): VectorLayerDescriptor<MapPoint, Point, PointStyleOptions> => ({
  id,
  feature: {
    id: (model: MapPoint) => model.id,
    geometry: {
      fromModel: mapPointToGeometry,
      applyGeometryToModel: applyGeometryToMapPoint,
    },
    style: {
      base: (model: MapPoint) => ({color, radius: 6, label: model.name}),
      render: (opts: PointStyleOptions) =>
        new Style({
          image: new CircleStyle({
            radius: opts.radius,
            fill: new Fill({color: opts.color}),
            stroke: new Stroke({color: '#ffffff', width: 2}),
          }),
          text: new Text({
            text: opts.label,
            offsetY: 18,
            fill: new Fill({color: '#1f2937'}),
            stroke: new Stroke({color: '#ffffff', width: 3}),
            font: '600 12px "Inter", sans-serif',
          }),
        }),
    },
  },
});

@Component({
  selector: 'app-center-on-layers',
  standalone: true,
  imports: [MapHostComponent, DemoHeaderComponent],
  templateUrl: './center-on-layers.component.html',
  styleUrl: './center-on-layers.component.scss',
})
export class CenterOnLayersComponent {
  readonly mapConfig: MapHostConfig<readonly VectorLayerDescriptor<any, Geometry, any>[]> = {
    schema: {
      layers: [
        pointLayer(LAYER_ID.A, '#1976d2'),
        pointLayer(LAYER_ID.B, '#2e7d32'),
        pointLayer(LAYER_ID.C, '#c62828'),
      ],
    },
    view: {
      centerLonLat: [27.5619, 53.9023],
      zoom: 11,
    },
    osm: true,
  };

  private ctx?: MapContext;

  onReady(ctx: MapContext): void {
    this.ctx = ctx;

    (ctx.layers[LAYER_ID.A] as VectorLayerApi<MapPoint, Point>)?.setModels(POINTS_A);
    (ctx.layers[LAYER_ID.B] as VectorLayerApi<MapPoint, Point>)?.setModels(POINTS_B);
    (ctx.layers[LAYER_ID.C] as VectorLayerApi<MapPoint, Point>)?.setModels(POINTS_C);

    ctx.centerOnAllLayers();
  }

  centerAll(): void {
    this.ctx?.centerOnAllLayers();
  }

  centerLayers(ids: string[]): void {
    this.ctx?.centerOnLayers(ids);
  }
}
