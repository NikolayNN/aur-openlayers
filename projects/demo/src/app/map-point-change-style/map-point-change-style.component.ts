import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import OlMap from 'ol/Map';
import type Geometry from 'ol/geom/Geometry';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import {fromLonLat} from 'ol/proj';
import OSM from 'ol/source/OSM';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import {LayerManager, MapSchema, VectorLayerDescriptor} from '../../../../lib/src/lib/map-framework';
import {
  applyGeometryToMapPoint,
  mapPointToGeometry,
  MapPoint,
  MapPointGenerator,
} from '../shared/map-point';

const BASE_COLOR = '#1976d2';
const STATE_COLOR_MAP = {
  red: '#ef4444',
  yellow: '#facc15',
  green: '#22c55e',
} as const;

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

const POINTS: MapPoint[] = new MapPointGenerator().getByIds([
  'minsk-center',
  'minsk-library',
  'minsk-arena',
]);

const COLOR_OPTIONS = [
  {label: 'Красный', state: 'red', color: STATE_COLOR_MAP.red},
  {label: 'Желтый', state: 'yellow', color: STATE_COLOR_MAP.yellow},
  {label: 'Зеленый', state: 'green', color: STATE_COLOR_MAP.green},
  {label: 'Сброс', state: undefined, color: '#94a3b8'},
] as const;

@Component({
  selector: 'app-map-point-change-style',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-point-change-style.component.html',
  styleUrl: './map-point-change-style.component.scss',
})
export class MapPointChangeStyleComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', {static: true}) mapElement!: ElementRef<HTMLDivElement>;

  private map?: OlMap;
  private layerManager?: LayerManager<
    readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
  >;

  readonly points = POINTS;
  readonly colorOptions = COLOR_OPTIONS;
  ngAfterViewInit(): void {
    this.map = new OlMap({
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

    const schema: MapSchema<readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]> = {
      layers: [
        {
          id: 'points',
          feature: {
            id: (model: MapPoint) => model.id,
            geometry: {
              fromModel: mapPointToGeometry,
              applyGeometryToModel: applyGeometryToMapPoint,
            },
            style: {
              base: (model: MapPoint) => ({
                color: BASE_COLOR,
                radius: 7,
                label: model.name,
              }),
              states: {
                red: () => ({color: STATE_COLOR_MAP.red}),
                yellow: () => ({color: STATE_COLOR_MAP.yellow}),
                green: () => ({color: STATE_COLOR_MAP.green}),
              },
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
                    fill: new Fill({color: '#111827'}),
                    stroke: new Stroke({color: '#ffffff', width: 3}),
                    font: '600 12px "Inter", sans-serif',
                  }),
                }),
            },
          },
        },
      ],
    };

    this.layerManager = LayerManager.create(this.map, schema);

    const api = this.layerManager.getApi('points');
    api?.setModels(POINTS);
    api?.centerOnAllModels({padding: {all: 80}});
  }

  changePointColor(pointId: string, state?: keyof typeof STATE_COLOR_MAP): void {
    const api = this.layerManager?.getApi('points');
    api?.setFeatureStates(pointId, state);
    api?.centerOnModel(pointId, {maxZoom: 13});
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }
}
