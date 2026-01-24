import {Component} from '@angular/core';
import {
  MapContext,
  MapHostComponent,
  MapHostConfig,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
import type Geometry from 'ol/geom/Geometry';
import {fromLonLat} from 'ol/proj';
import Point from 'ol/geom/Point';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import {LineString} from 'ol/geom';
import {
  applyGeometryToMapPoint,
  mapPointToGeometry,
  MapPoint,
  MapPointGenerator,
} from '../shared/map-point';

const LAYER_ID = {
  POINTS: 'points',
  LINE: 'line',
} as const;

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

class Mapline  {
  public readonly id: string = 'one-per-layer';
  constructor(public readonly points: MapPoint[]) {
  }
}

type MapLineStyleOptions = {
  color: string;
  width: number;
};

const POINTS = new MapPointGenerator().getByCount(3);

@Component({
  selector: 'app-simple-map-two-static-layers',
  standalone: true,
  imports: [MapHostComponent],
  templateUrl: './simple-map-two-static-layers.component.html',
  styleUrl: './simple-map-two-static-layers.component.scss'
})
export class SimpleMapTwoStaticLayersComponent {
  readonly mapConfig: MapHostConfig<readonly VectorLayerDescriptor<any, Geometry, any>[]> = {
    schema: {
      layers: [
          {
            id: LAYER_ID.LINE,
            feature: {
              id: (model: Mapline) => model.id,
              geometry: {
                fromModel: (model: Mapline) =>
                  new LineString(model.points.map((p) => fromLonLat([p.lng, p.lat]))),
                applyGeometryToModel: (prev: Mapline) => prev, // карта статическая заглушка т.к. координаты с карты не изменяются
              },
              style: {
                base: () => ({
                  color: '#ef4444',
                  width: 5,
                }),
                render: (opts: MapLineStyleOptions) =>
                  new Style({
                    stroke: new Stroke({
                      color: opts.color,
                      width: opts.width,
                    }),
                  }),
              },
            },

          },
          {
            id: LAYER_ID.POINTS,
            feature: {
              id: (model: MapPoint) => model.id,
              geometry: {
                fromModel: mapPointToGeometry,
                applyGeometryToModel: applyGeometryToMapPoint,
              },
              style: {
                base: (model: MapPoint) => ({
                  color: '#1976d2',
                  radius: 6,
                  label: model.name,
                }),
                render: (opts: PointStyleOptions) =>
                  new Style({
                    image: new CircleStyle({
                      radius: opts.radius,
                      fill: new Fill({ color: opts.color }),
                      stroke: new Stroke({ color: '#ffffff', width: 2 }),
                    }),
                    text: new Text({
                      text: opts.label,
                      offsetY: 18,
                      fill: new Fill({ color: '#1f2937' }),
                      stroke: new Stroke({ color: '#ffffff', width: 3 }),
                      font: '600 12px "Inter", sans-serif',
                    }),
                  }),
              },
            },
          },
        ],
      },
      view: {
        centerLonLat: [27.5619, 53.9023],
        zoom: 11,
      },
      osm: true,
    };

  lineVisible = true;
  lineOpacity = 1; // 0..1

  private lineLayerApi?: VectorLayerApi<Mapline, LineString>;
  private pointLayerApi?: VectorLayerApi<MapPoint, Point>;

  onReady(ctx: MapContext): void {
    this.lineLayerApi = ctx.layers[LAYER_ID.LINE] as VectorLayerApi<Mapline, LineString> | undefined;
    this.pointLayerApi = ctx.layers[LAYER_ID.POINTS] as VectorLayerApi<MapPoint, Point> | undefined;

    this.pointLayerApi?.setModels(POINTS);
    this.pointLayerApi?.centerOnAllModels();

    this.lineLayerApi?.setModels([new Mapline(POINTS)]);
  }

  protected toggleLineLayer() {
    this.lineVisible = !this.lineVisible;
    this.lineLayerApi?.setVisible(this.lineVisible);
  }

  protected onLineOpacityInput(e: Event) {
    this.lineOpacity = Number((e.target as HTMLInputElement).value);
    this.lineLayerApi?.setOpacity(this.lineOpacity);
  }
}
