import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import Map from 'ol/Map';
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
import {LineString} from 'ol/geom';
import {LayerManager, MapSchema, VectorLayerApi, VectorLayerDescriptor} from '../../../../lib/src/lib/map-framework';
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

type MapLineStyleOptions = {
  color: string;
  width: number;
  dash: number[];
};

class MapLine {
  public readonly id = 'line-1';

  constructor(public readonly points: MapPoint[]) {}
}

const POINTS = new MapPointGenerator().getByCount(5);
const POINT_IDS = POINTS.map((point) => point.id);

@Component({
  selector: 'app-map-line-drag-points',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-line-drag-points.component.html',
  styleUrl: './map-line-drag-points.component.scss',
})
export class MapLineDragPointsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', {static: true}) mapElement!: ElementRef<HTMLDivElement>;

  activePoint: MapPoint | null = null;
  dragging = false;

  private map?: Map;
  private layerManager?: LayerManager<readonly VectorLayerDescriptor<any, Geometry, any>[]>;
  private unsubscribePointsChange?: () => void;
  private activePointId: string | null = null;

  ngAfterViewInit(): void {
    this.map = new Map({
      target: this.mapElement.nativeElement,
      layers: [new TileLayer({source: new OSM()})],
      view: new View({
        center: fromLonLat([27.5619, 53.9023]),
        zoom: 11,
      }),
    });

    const schema: MapSchema<readonly VectorLayerDescriptor<any, Geometry, any>[]> = {
      layers: [
        {
          id: LAYER_ID.LINE,
          feature: {
            id: (model: MapLine) => model.id,
            geometry: {
              fromModel: (model: MapLine) =>
                new LineString(model.points.map((p) => fromLonLat([p.lng, p.lat]))),
              applyGeometryToModel: (prev: MapLine) => prev,
            },
            style: {
              base: () => ({
                color: '#10b981',
                width: 4,
                dash: [10, 8],
              }),
              render: (opts: MapLineStyleOptions) =>
                new Style({
                  stroke: new Stroke({
                    color: opts.color,
                    width: opts.width,
                    lineDash: opts.dash,
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
                color: '#1d4ed8',
                radius: 7,
                label: model.name,
              }),
              states: {
                DRAG: () => ({
                  color: '#f97316',
                  radius: 9,
                }),
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
                    fill: new Fill({color: '#0f172a'}),
                    stroke: new Stroke({color: '#ffffff', width: 3}),
                    font: '600 12px "Inter", sans-serif',
                  }),
                }),
            },
            interactions: {
              translate: {
                cursor: 'grab',
                hitTolerance: 6,
                state: 'DRAG',
                onStart: ({item, ctx}) => {
                  this.dragging = true;
                  this.activePointId = String(item.model.id);
                  this.syncActivePoint(ctx);
                  this.updateLineFromPoints()
                  return true;
                },
                onChange: ({item, ctx}) => {
                  this.activePointId = String(item.model.id);
                  this.syncActivePoint(ctx);
                  this.updateLineFromPoints();
                  return true;
                },
                onEnd: ({item, ctx}) => {
                  this.dragging = false;
                  this.activePointId = String(item.model.id);
                  this.syncActivePoint(ctx);
                  this.updateLineFromPoints();
                  return true;
                },
              },
            },
          },
        },
      ],
    };

    this.layerManager = LayerManager.create(this.map, schema);

    this.pointLayerApi?.setModels(POINTS);
    this.pointLayerApi?.centerOnAllModels({
      padding: {top: 40, right: 40, bottom: 40, left: 40},
    });
    this.updateLineFromPoints();
  }

  ngOnDestroy(): void {
    this.unsubscribePointsChange?.();
    this.map?.setTarget(undefined);
  }

  private syncActivePoint(ctx: {layers: Record<string, VectorLayerApi<MapPoint, Geometry>>}): void {
    if (!this.activePointId) {
      this.activePoint = null;
      return;
    }
    const layer = ctx.layers[LAYER_ID.POINTS];
    this.activePoint = layer?.getModelById(this.activePointId) ?? null;
  }

  private updateLineFromPoints(): void {
    const points = POINT_IDS
      .map((id) => this.pointLayerApi?.getModelById(id))
      .filter((point): point is MapPoint => Boolean(point));

    if (!points.length) return;
    this.lineLayerApi?.setModels([new MapLine(points)]);
  }

  get pointLayerApi(): VectorLayerApi<MapPoint, Geometry> | undefined {
    return this.layerManager?.getApi(LAYER_ID.POINTS);
  }

  get lineLayerApi(): VectorLayerApi<MapLine, LineString> | undefined {
    return this.layerManager?.getApi(LAYER_ID.LINE);
  }
}
