import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import Map from 'ol/Map';
import {LayerManager, MapSchema, VectorLayerApi, VectorLayerDescriptor} from '../../../../lib/src/lib/map-framework';
import type Geometry from 'ol/geom/Geometry';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import View from 'ol/View';
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
  public readonly id :string = 'one-per-layer'
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
  imports: [],
  templateUrl: './simple-map-two-static-layers.component.html',
  styleUrl: './simple-map-two-static-layers.component.scss'
})
export class SimpleMapTwoStaticLayersComponent implements AfterViewInit {
  @ViewChild('map', { static: true }) mapElement!: ElementRef<HTMLDivElement>;

  private map?: Map;
  private layerManager?: LayerManager<readonly VectorLayerDescriptor<MapPoint, Geometry, MapLineStyleOptions>[]>;

  lineVisible = true;
  lineOpacity = 1; // 0..1

  ngAfterViewInit(): void {
    this.map = new Map({
      target: this.mapElement.nativeElement,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat([27.5619, 53.9023]),
        zoom: 11,
      }),
    });

    const schema: MapSchema<readonly VectorLayerDescriptor<any, Geometry, any>[]> =
      {
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
                base: (model: Mapline) => ({
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
      };

    this.layerManager = LayerManager.create(this.map, schema);

    this.pointLayerApi?.setModels(POINTS);
    this.pointLayerApi?.centerOnAllModels();

    this.lineLayerApi?.setModels([new Mapline(POINTS)]);
  }

  get lineLayerApi(): VectorLayerApi<Mapline, LineString> | undefined {
    return this.layerManager?.getApi(LAYER_ID.LINE);
  }

  get pointLayerApi(): VectorLayerApi<MapPoint, Point> | undefined {
    return this.layerManager?.getApi(LAYER_ID.POINTS);
  }

  protected toggleLineLayer() {
    this.lineVisible = !this.lineVisible;
    this.lineLayerApi?.setVisible(this.lineVisible);
  }

  protected onLineOpacityInput(e: Event) {
    this.lineOpacity = Number((e.target as HTMLInputElement).value);
    this.lineLayerApi?.setOpacity(this.lineOpacity);
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }
}
