import {Component, ElementRef, NgZone, OnInit, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import type Geometry from 'ol/geom/Geometry';
import {fromLonLat, toLonLat} from 'ol/proj';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import {LineString, Point} from 'ol/geom';
import {
  MapContext,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
import {MapHostComponent, MapHostConfig} from '../shared/map-host/map-host.component';
import {escapeHtml} from '../../../../lib/src/lib/map-framework/public-utils/html-escape.utils';
import {MapPoint, MapPointGenerator, mapPointToGeometry,} from '../shared/map-point';

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
  nameLabel: string;
};

type MapLineStyleOptions = {
  color: string;
  width: number;
};

type OrderedMapPoint = MapPoint & { orderIndex: number };
type MapLine = { id: string; points: OrderedMapPoint[] };

const asOrdered = (p: MapPoint, orderIndex: number): OrderedMapPoint => ({...p, orderIndex});
const patchPoint = (prev: OrderedMapPoint, patch: Partial<OrderedMapPoint>): OrderedMapPoint => ({
  ...prev,
  ...patch,
});

const BASE_POINTS = new MapPointGenerator().getByCount(5);

const LAYER_ID = {
  ROUTE_LINE: 'route-line',
  POINTS: 'points',
} as const;

const ROUTE_ID = 'single-route-id';

@Component({
  selector: 'app-map-route-iterations',
  standalone: true,
  imports: [CommonModule, FormsModule, MapHostComponent],
  templateUrl: './map-route-iterations.component.html',
  styleUrl: './map-route-iterations.component.scss',
})
export class MapRouteIterationsComponent implements OnInit {
  @ViewChild('popupHost', {static: true}) popupHostElement!: ElementRef<HTMLDivElement>;
  @ViewChild('mapHost', {static: true, read: ElementRef}) mapHostElement!: ElementRef<HTMLElement>;

  orderedPoints: OrderedMapPoint[] = [];
  selectedPoint: OrderedMapPoint | null = null;
  selectedPointName = '';
  isDragging = false;

  private pointsOrder: string[] = BASE_POINTS.map((p) => p.id);

  private pointLayerApi?: VectorLayerApi<OrderedMapPoint, Geometry>;
  private lineLayerApi?: VectorLayerApi<MapLine, LineString>;

  private unsubscribeModelsChanged?: () => void;

  readonly mapConfig: MapHostConfig<readonly VectorLayerDescriptor<any, Geometry, any>[]> = {
    schema: {
      layers: [

        {
          id: LAYER_ID.ROUTE_LINE,
          feature: {
            id: (model: MapLine) => model.id,
            geometry: {
              fromModel: (model: MapLine) =>
                new LineString(model.points.map((p) => fromLonLat([p.lng, p.lat]))),
              applyGeometryToModel: (prev: MapLine) => prev,
            },
            style: {
              base: () => ({color: '#38bdf8', width: 4}),
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
            id: (model: OrderedMapPoint) => model.id,
            geometry: {
              fromModel: mapPointToGeometry,
              applyGeometryToModel: (prev, geom) => {
                if (!(geom instanceof Point)) return prev;
                const [lng, lat] = toLonLat(geom.getCoordinates());
                return patchPoint(prev, {lng, lat});
              },
            },
            style: {
              base: (model: OrderedMapPoint) => ({
                color: '#2563eb',
                radius: 12,
                label: String(model.orderIndex),
                nameLabel: model.name,
              }),
              states: {
                SELECTED: () => ({color: '#f97316', radius: 14}),
                DRAG: () => ({color: '#16a34a', radius: 14}),
              },
              render: (opts: PointStyleOptions) => [
                new Style({
                  image: new CircleStyle({
                    radius: opts.radius,
                    fill: new Fill({color: opts.color}),
                    stroke: new Stroke({color: '#ffffff', width: 2}),
                  }),
                  text: new Text({
                    text: opts.label,
                    fill: new Fill({color: '#ffffff'}),
                    stroke: new Stroke({color: 'rgba(15, 23, 42, 0.45)', width: 2}),
                    font: '700 12px "Inter", sans-serif',
                    textAlign: 'center',
                    textBaseline: 'middle',
                  }),
                }),
                new Style({
                  text: new Text({
                    text: opts.nameLabel,
                    offsetY: 22,
                    fill: new Fill({color: '#111827'}),
                    stroke: new Stroke({color: '#ffffff', width: 3}),
                    font: '600 12px "Inter", sans-serif',
                    textAlign: 'center',
                  }),
                }),
              ],
            },
            popup: {
              item: ({model}) => ({
                model,
                className: 'popup-card',
                content: (() => {
                  const tpl = document.createElement('template');
                  tpl.innerHTML = `
                        <div class="popup-content">
                            <h3>${escapeHtml(model.name)}</h3>
                            <p><strong>Точка №${escapeHtml(String(model.orderIndex))}</strong></p>
                            <p>${escapeHtml(model.district)}</p>
                            <p>${escapeHtml(model.address)}</p>
                            <p>${escapeHtml(model.details)}</p>
                            <p>${escapeHtml(model.status)}</p>
                            <p>${escapeHtml(model.schedule)}</p>
                        </div>`.trim();
                  return tpl.content.firstElementChild as HTMLElement;
                })(),
              }),
            },
            interactions: {
              select: {
                cursor: 'pointer',
                state: 'SELECTED',
                hitTolerance: 6,
                onSelect: ({items}) => {
                  const model = items[0]?.model ?? null;
                  this.zone.run(() => {
                    this.selectedPoint = model;
                    this.selectedPointName = model?.name ?? '';
                  });
                  return true;
                },
                onClear: () => {
                  this.zone.run(() => {
                    this.clearSelectedPoint()
                  });
                  return true;
                },
              },
              translate: {
                cursor: 'grab',
                hitTolerance: 6,
                onStart: (point) => {
                  this.zone.run(() => (this.isDragging = true))
                  this.selectPoint(point.item.model);
                },
                onEnd: () => {
                  this.zone.run(() => (this.isDragging = false));
                },
              },
            },
          },
        },
      ],
      options: {
        popupHost: {
          autoMode: 'hover',
          mount: () => this.popupHostElement.nativeElement,
        },
      },
    },
    view: {
      centerLonLat: [27.5619, 53.9023],
      zoom: 11,
    },
    osm: true,
  };

  constructor(private readonly zone: NgZone) {
  }

  ngOnInit(): void {
    this.orderedPoints = BASE_POINTS.map((p, i) => asOrdered(p, i + 1));
    this.pointsOrder = this.orderedPoints.map((p) => p.id);
  }

  // вызывется когда карта готова
  onReady(ctx: MapContext): void {
    this.pointLayerApi = ctx.layers[LAYER_ID.POINTS] as VectorLayerApi<OrderedMapPoint, Geometry>;
    this.lineLayerApi = ctx.layers[LAYER_ID.ROUTE_LINE] as VectorLayerApi<MapLine, LineString>;

    this.pointLayerApi.setModels(this.orderedPoints);
    this.pointLayerApi.centerOnAllModels();

    this.unsubscribeModelsChanged = this.pointLayerApi.onModelsChanged?.(() => {
      // перестраиваем все модели и слои при любом изменении можно оптимизировать использовать модель  ModelChange[] и  смотреть что изменилось и точечно обновлять
      this.zone.run(() => this.rebuildFromLayer());
    });

    // первичная инициализация
    this.rebuildFromLayer();
  }

  movePointUp(index: number): void {
    if (index <= 0) return;
    this.selectPoint(this.orderedPoints[index - 1]);
    this.swapOrder(index, index - 1);
  }

  movePointDown(index: number): void {
    if (index >= this.pointsOrder.length - 1) return;
    this.selectPoint(this.orderedPoints[index - 1]);
    this.swapOrder(index, index + 1);
  }

  private swapOrder(firstIndex: number, secondIndex: number): void {
    const updated = [...this.pointsOrder];
    [updated[firstIndex], updated[secondIndex]] = [updated[secondIndex], updated[firstIndex]];
    this.applyPointOrder(updated);
  }

  private applyPointOrder(newOrder: string[]): void {
    this.pointsOrder = newOrder;
    this.updateOrderIndexes();
    this.rebuildFromLayer();
  }

  private updateOrderIndexes(): void {
    if (!this.pointLayerApi) return;

    this.pointsOrder.forEach((id, index) => {
      const model = this.pointLayerApi!.getModelById(id);
      if (!model || model.orderIndex === index + 1) return;

      this.pointLayerApi!.mutate(id, (prev) => patchPoint(prev, {orderIndex: index + 1}));
    });
  }

  onSelectedPointNameChange(value: string): void {
    if (!this.selectedPoint || !this.pointLayerApi) return;

    this.pointLayerApi.mutate(this.selectedPoint.id, (prev) => patchPoint(prev, {name: value}));

    this.selectedPointName = value;
  }

  private rebuildFromLayer(): void {
    if (!this.pointLayerApi) return;

    this.orderedPoints = this.pointsOrder
      .map((id) => this.pointLayerApi!.getModelById(id))
      .filter((p) => p !== undefined);


    if (this.selectedPoint) {
      this.selectedPoint = this.pointLayerApi.getModelById(this.selectedPoint.id) ?? null;
      this.selectedPointName = this.selectedPoint?.name ?? '';
    }

    if (this.lineLayerApi && this.orderedPoints.length) {
      this.lineLayerApi.setModels([{id: ROUTE_ID, points: this.orderedPoints}]);
    }
  }

  private clearSelectedPoint() {
    if (this.selectedPoint) {
      this.pointLayerApi?.setFeatureStates(this.selectedPoint.id, []);
      this.selectedPoint = null;
    }
  }

  protected selectPoint(point: MapPoint & { orderIndex: number }) {
    if (!this.pointLayerApi) return;
    this.clearSelectedPoint();
    this.selectedPoint = point;
    this.pointLayerApi?.setFeatureStates(this.selectedPoint.id, ['SELECTED']);
  }

  ngOnDestroy(): void {
    this.unsubscribeModelsChanged?.();
  }
}
