import { CommonModule } from '@angular/common';
import { Component, NgZone, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type Geometry from 'ol/geom/Geometry';
import Circle from 'ol/geom/Circle';
import { LineString } from 'ol/geom';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import {
  MapContext,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
import { MapHostComponent, MapHostConfig } from '../shared/map-host/map-host.component';
import {
  applyGeometryToMapPoint,
  MapPoint,
  MapPointGenerator,
  mapPointToGeometry,
} from '../shared/map-point';
import {Unsubscribe} from 'lib';

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

type LineStyleOptions = {
  color: string;
  width: number;
  dash: number[];
};

type DraftStyleOptions = {
  pointColor: string;
  pointRadius: number;
  radiusColor: string;
  radiusFill: string;
  radiusMeters: number;
};

const LAYER_ID = {
  ROUTE_POINTS: 'route-points',
  ROUTE_LINE: 'route-line',
  ADD_POINT_DRAFT: 'ADD_POINT_DRAFT',
} as const;

class RouteLine {
  public readonly id = 'route-line';

  constructor(public readonly points: MapPoint[]) {}
}

class DraftPoint extends MapPoint {
  constructor(
    id: string,
    name: string,
    lat: number,
    lng: number,
    public readonly radiusMeters: number,
  ) {
    super(id, name, lat, lng);
  }

  withRadius(radiusMeters: number): DraftPoint {
    return new DraftPoint(this.id, this.name, this.lat, this.lng, radiusMeters);
  }
}

const INITIAL_POINTS = new MapPointGenerator().getByCount(4);

@Component({
  selector: 'app-map-route-add-point',
  standalone: true,
  imports: [CommonModule, FormsModule, MapHostComponent],
  templateUrl: './map-route-add-point.component.html',
  styleUrl: './map-route-add-point.component.scss',
})
export class MapRouteAddPointComponent implements OnDestroy {
  isAddMode = false;
  draftRadius = 300;
  draftPoint: DraftPoint | null = null;

  readonly mapConfig: MapHostConfig<
    readonly VectorLayerDescriptor<any, Geometry, any>[]
  > = {
    schema: {
      layers: [
        {
          id: LAYER_ID.ROUTE_LINE,
          feature: {
            id: (model: RouteLine) => model.id,
            geometry: {
              fromModel: (model: RouteLine) =>
                new LineString(model.points.map((point) => fromLonLat([point.lng, point.lat]))),
              applyGeometryToModel: (prev: RouteLine) => prev,
            },
            style: {
              base: () => ({
                color: '#2563eb',
                width: 4,
                dash: [8, 6],
              }),
              render: (opts: LineStyleOptions) =>
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
          id: LAYER_ID.ROUTE_POINTS,
          feature: {
            id: (model: MapPoint) => model.id,
            geometry: {
              fromModel: mapPointToGeometry,
              applyGeometryToModel: applyGeometryToMapPoint,
            },
            style: {
              base: (model: MapPoint) => ({
                color: '#0ea5e9',
                radius: 7,
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
                    fill: new Fill({ color: '#0f172a' }),
                    stroke: new Stroke({ color: '#ffffff', width: 3 }),
                    font: '600 12px "Inter", sans-serif',
                  }),
                }),
            },
          },
        },
        {
          id: LAYER_ID.ADD_POINT_DRAFT,
          feature: {
            id: (model: DraftPoint) => model.id,
            geometry: {
              fromModel: (model: DraftPoint) =>
                new Point(fromLonLat([model.lng, model.lat])),
              applyGeometryToModel: (prev: DraftPoint, geom: unknown) => {
                if (!(geom instanceof Point)) return prev;
                const [lng, lat] = toLonLat(geom.getCoordinates());
                return new DraftPoint(prev.id, prev.name, lat, lng, prev.radiusMeters);
              },
            },
            style: {
              base: (model: DraftPoint) => ({
                pointColor: '#f97316',
                pointRadius: 8,
                radiusColor: 'rgba(249, 115, 22, 0.6)',
                radiusFill: 'rgba(249, 115, 22, 0.12)',
                radiusMeters: model.radiusMeters,
              }),
              render: (opts: DraftStyleOptions) => {
                const radiusStyle = new Style({
                  geometry: (feature) => {
                    const geometry = feature?.getGeometry();
                    if (geometry instanceof Point) {
                      return new Circle(geometry.getCoordinates(), opts.radiusMeters);
                    }
                    return geometry;
                  },
                  stroke: new Stroke({ color: opts.radiusColor, width: 2 }),
                  fill: new Fill({ color: opts.radiusFill }),
                });

                const pointStyle = new Style({
                  image: new CircleStyle({
                    radius: opts.pointRadius,
                    fill: new Fill({ color: opts.pointColor }),
                    stroke: new Stroke({ color: '#ffffff', width: 2 }),
                  }),
                });

                return [radiusStyle, pointStyle];
              },
            },
            interactions: {
              click: {
                enabled: () => this.isAddMode,
                onClick: ({ ctx, event }) => {
                  const [lng, lat] = toLonLat(event.coordinate) as [number, number];
                  const draft = new DraftPoint(
                    `draft-point`,
                    'Новая точка',
                    lat,
                    lng,
                    this.draftRadius,
                  );
                  this.zone.run(() => {
                    this.draftPoint = draft;
                  });
                  ctx.layers[LAYER_ID.ADD_POINT_DRAFT]?.setModels([draft]);
                  return true;
                },
              },
              translate: {
                cursor: 'grabbing',
                hitTolerance: 6,
                enabled: () => Boolean(this.draftPoint),
              },
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

  private routePoints: MapPoint[] = [...INITIAL_POINTS];
  private pointsLayerApi?: VectorLayerApi<MapPoint, Geometry>;
  private lineLayerApi?: VectorLayerApi<RouteLine, Geometry>;
  private draftLayerApi?: VectorLayerApi<DraftPoint, Geometry>;

  private unsubscribeDraft?: Unsubscribe;
  private unsubscribePointLayerChanged?: Unsubscribe;

  constructor(private readonly zone: NgZone) {}

  onReady(ctx: MapContext): void {
    this.pointsLayerApi = ctx.layers[LAYER_ID.ROUTE_POINTS];
    this.lineLayerApi = ctx.layers[LAYER_ID.ROUTE_LINE];
    this.draftLayerApi = ctx.layers[LAYER_ID.ADD_POINT_DRAFT];

    // отобразить существующие точки на слое
    this.pointsLayerApi?.setModels(this.routePoints);

    // подписка на изменение размера коллекции (в этом случае на добавление точки)
    this.unsubscribePointLayerChanged = this.pointsLayerApi?.onModelsCollectionChanged(cd => {
      this.lineLayerApi?.setModels([new RouteLine([...cd.next])]);
    });

    this.unsubscribeDraft = this.draftLayerApi?.onModelsChanged?.((changes) => {
      const latest = changes.at(-1);
      if (!latest) return;
      this.zone.run(() => {
        this.draftPoint = latest.next;
      });
    });
  }

  toggleAddMode(): void {
    this.isAddMode = !this.isAddMode;
  }

  updateDraftRadius(value: number): void {
    if (!this.draftPoint) return;
    this.draftLayerApi?.mutate(this.draftPoint.id, (prev) => prev.withRadius(value));
  }

  savePoint(): void {
    if (!this.draftPoint) return;
    const newPoint = new MapPoint(
      `route-${this.routePoints.length + 1}`,
      `Точка ${this.routePoints.length + 1}`,
      this.draftPoint.lat,
      this.draftPoint.lng,
    );
    this.pointsLayerApi?.addModel(newPoint);
    this.clearDraft();
    this.toggleAddMode();
  }

  clearDraft(): void {
    this.draftPoint = null;
    this.draftLayerApi?.clear();
  }

  get draftHint(): string {
    if (!this.isAddMode) {
      return 'Нажмите «Добавить точку», чтобы активировать режим постановки.';
    }
    if (!this.draftPoint) {
      return 'Кликните по карте, чтобы поставить черновую точку.';
    }
    return 'Перетащите точку или скорректируйте радиус действия.';
  }


  ngOnDestroy(): void {
    this.unsubscribeDraft?.();
    this.unsubscribePointLayerChanged?.();
  }
}
