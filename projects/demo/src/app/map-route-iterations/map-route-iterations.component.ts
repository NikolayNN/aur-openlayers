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
  MapHostComponent,
  MapHostConfig,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
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

class OrderedMapPoint extends MapPoint {
  constructor(
    id: string,
    name: string,
    lat: number,
    lng: number,
    district: string,
    address: string,
    details: string,
    status: string,
    schedule: string,
    public readonly orderIndex: number,
  ) {
    super(id, name, lat, lng, district, address, details, status, schedule);
  }

  public withLatLng(lng: number, lat: number): OrderedMapPoint {
    return new OrderedMapPoint(this.id, this.name, lat, lng, this.district, this.address, this.details, this.status, this.schedule, this.orderIndex);
  }

  public withOrderIndex(index: number): OrderedMapPoint {
    return new OrderedMapPoint(this.id, this.name, this.lat, this.lng, this.district, this.address, this.details, this.status, this.schedule, index);
  }

  public withName(name: string): OrderedMapPoint {
    return new OrderedMapPoint(this.id, name, this.lat, this.lng, this.district, this.address, this.details, this.status, this.schedule, this.orderIndex);
  }


  public static toOrdered(point: MapPoint, index: number): OrderedMapPoint {
    return new OrderedMapPoint(point.id, point.name, point.lat, point.lng, point.district, point.address, point.details, point.status, point.schedule, index);
  }
}

class MapLine {
  public readonly id = 'single-route-id';

  constructor(public readonly points: OrderedMapPoint[]) {
  }
}

const BASE_POINTS = new MapPointGenerator().getByCount(5);

const LAYER_ID = {
  ROUTE_LINE: 'route-line',
  POINTS: 'points',
} as const;

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
  dragging = false;


  private pointsOrder: string[] = BASE_POINTS.map((point) => point.id);
  private pointLayerApi?: VectorLayerApi<OrderedMapPoint, Geometry>;
  private lineLayerApi?: VectorLayerApi<MapLine, LineString>;

  readonly mapConfig: MapHostConfig<readonly VectorLayerDescriptor<any, Geometry, any>[]> = {
    schema: {
      layers: [
        {
          id: LAYER_ID.ROUTE_LINE,
          feature: {
            id: (model: MapLine) => model.id,
            geometry: {
              fromModel: (model: MapLine) =>
                new LineString(model.points.map((point) => fromLonLat([point.lng, point.lat]))),
              applyGeometryToModel: (prev: MapLine) => prev,
            },
            style: {
              base: () => ({
                color: '#38bdf8',
                width: 4,
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
          id: 'points',
          feature: {
            id: (model: OrderedMapPoint) => model.id,
            geometry: {
              fromModel: mapPointToGeometry,
              applyGeometryToModel: (prev, geom) => {
                if (!(geom instanceof Point)) return prev;
                const [lng, lat] = toLonLat(geom.getCoordinates());
                return prev.withLatLng(lng, lat);
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
                SELECTED: () => ({
                  color: '#f97316',
                  radius: 14,
                }),
                DRAG: () => ({
                  color: '#16a34a',
                  radius: 14,
                }),
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
                content: this.buildPopupContent(model),
              }),
            },
            interactions: {
              select: {
                cursor: 'pointer',
                state: 'SELECTED',
                hitTolerance: 6,
                onSelect: ({items}) => {
                  this.zone.run(() => {
                    const model = items[0]?.model as OrderedMapPoint | undefined;
                    this.selectedPoint = model ?? null;
                    this.selectedPointName = model?.name ?? '';
                  });
                  return true;
                },
                onClear: () => {
                  this.zone.run(() => {
                    this.selectedPoint = null;
                    this.selectedPointName = '';
                  });
                  return true;
                },
              },
              translate: {
                cursor: 'grab',
                hitTolerance: 6,
                onStart: () => {
                  this.zone.run(() => {
                    this.dragging = true;
                    this.syncFromLayer();
                  });
                  this.updateLineFromLayer();
                  return true;
                },
                onChange: () => {
                  this.zone.run(() => {
                    this.syncFromLayer();
                  });
                  this.updateLineFromLayer();
                  return true;
                },
                onEnd: () => {
                  this.zone.run(() => {
                    this.dragging = false;
                    this.syncFromLayer();
                  });
                  this.updateLineFromLayer();
                  return true;
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
    this.orderedPoints = BASE_POINTS.map((point, index) => OrderedMapPoint.toOrdered(point, index + 1));
    this.pointsOrder = this.orderedPoints.map((point) => point.id);
  }

  onReady(ctx: MapContext): void {
    this.pointLayerApi = ctx.layers[LAYER_ID.POINTS] as VectorLayerApi<OrderedMapPoint, Geometry>;
    this.lineLayerApi = ctx.layers[LAYER_ID.ROUTE_LINE] as VectorLayerApi<MapLine, LineString>;

    this.pointLayerApi.setModels(this.orderedPoints);
    this.pointLayerApi.centerOnAllModels({padding: {top: 48, right: 48, bottom: 48, left: 48}});
    this.updateLineFromLayer();
  }

  movePointUp(index: number): void {
    if (index <= 0) return;
    this.swapOrder(index, index - 1);
  }

  movePointDown(index: number): void {
    if (index >= this.pointsOrder.length - 1) return;
    this.swapOrder(index, index + 1);
  }

  onSelectedPointNameChange(value: string): void {
    if (!this.selectedPoint || !this.pointLayerApi) return;
    this.pointLayerApi.mutate(this.selectedPoint.id, (prev) => prev.withName(value));
    this.selectedPointName = value;
    this.syncFromLayer();
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  private swapOrder(firstIndex: number, secondIndex: number): void {
    const updated = [...this.pointsOrder];
    [updated[firstIndex], updated[secondIndex]] = [updated[secondIndex], updated[firstIndex]];
    this.applyPointOrder(updated);
  }

  private applyPointOrder(order: string[]): void {
    if (order.length !== this.pointsOrder.length) return;
    const normalized = Array.from(new Set(order));
    if (normalized.length !== this.pointsOrder.length) return;
    this.pointsOrder = [...normalized];
    this.updateOrderIndexes();
    this.syncFromLayer();
    this.updateLineFromLayer();
  }

  private updateOrderIndexes(): void {
    if (!this.pointLayerApi) return;
    this.pointsOrder.forEach((id, index) => {
      const model = this.pointLayerApi?.getModelById(id) as OrderedMapPoint | undefined;
      if (!model || model.orderIndex === index + 1) return;
      this.pointLayerApi?.mutate(id, (prev) => prev.withOrderIndex(index + 1));
    });
  }

  private syncFromLayer(): void {
    if (!this.pointLayerApi) return;
    this.orderedPoints = this.pointsOrder
      .map((id) => this.pointLayerApi?.getModelById(id))
      .filter((point): point is OrderedMapPoint => Boolean(point));
    if (this.selectedPoint) {
      this.selectedPoint = this.pointLayerApi?.getModelById(this.selectedPoint.id) ?? null;
      this.selectedPointName = this.selectedPoint?.name ?? '';
    }
  }

  private updateLineFromLayer(): void {
    if (!this.pointLayerApi) return;
    const points = this.pointsOrder
      .map((id) => this.pointLayerApi?.getModelById(id))
      .filter((point): point is OrderedMapPoint => Boolean(point));

    if (!points.length) return;
    this.lineLayerApi?.setModels([new MapLine(points)]);
  }

  private buildPopupContent(model: OrderedMapPoint): HTMLElement {
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
      </div>
    `;

    return tpl.content.firstElementChild as HTMLElement;
  }

}
