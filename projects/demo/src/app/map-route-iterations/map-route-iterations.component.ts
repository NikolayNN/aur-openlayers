import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import Map from 'ol/Map';
import type Geometry from 'ol/geom/Geometry';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import {fromLonLat, toLonLat} from 'ol/proj';
import OSM from 'ol/source/OSM';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import {LineString, Point} from 'ol/geom';
import {
  LayerManager,
  MapSchema,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
import {escapeHtml} from '../../../../lib/src/lib/map-framework/public-utils/html-escape.utils';
import {
  MapPoint,
  MapPointGenerator,
  mapPointToGeometry,
} from '../shared/map-point';

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

type MapLineStyleOptions = {
  color: string;
  width: number;
};

type IterationOption = {
  id: string;
  label: string;
  description: string;
  order: string[];
};

const POINT_IDS = [
  'minsk-center',
  'minsk-library',
  'minsk-arena',
  'minsk-tractors',
  'minsk-station',
];

const ITERATIONS: IterationOption[] = [
  {
    id: 'base',
    label: 'Итерация 1',
    description: 'Стартовый порядок точек для маршрута в районе Минска.',
    order: [...POINT_IDS],
  },
  {
    id: 'reverse',
    label: 'Итерация 2',
    description: 'Обратный порядок — легко сравнить разные варианты маршрута.',
    order: [...POINT_IDS].reverse(),
  },
  {
    id: 'loop',
    label: 'Итерация 3',
    description: 'Смешанная последовательность, чтобы показать перестановку точек.',
    order: [POINT_IDS[0], POINT_IDS[2], POINT_IDS[4], POINT_IDS[1], POINT_IDS[3]],
  },
];

const BASE_POINTS = new MapPointGenerator().getByIds(POINT_IDS);

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
}

class MapLine {
  public readonly id = 'route';

  constructor(public readonly points: OrderedMapPoint[]) {}
}

const applyGeometryToOrderedMapPoint = (prev: OrderedMapPoint, geom: unknown): OrderedMapPoint => {
  if (!(geom instanceof Point)) return prev;
  const [lng, lat] = toLonLat(geom.getCoordinates());
  return new OrderedMapPoint(
    prev.id,
    prev.name,
    lat,
    lng,
    prev.district,
    prev.address,
    prev.details,
    prev.status,
    prev.schedule,
    prev.orderIndex,
  );
};

@Component({
  selector: 'app-map-route-iterations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-route-iterations.component.html',
  styleUrl: './map-route-iterations.component.scss',
})
export class MapRouteIterationsComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('map', {static: true}) mapElement!: ElementRef<HTMLDivElement>;
  @ViewChild('popupHost', {static: true}) popupHostElement!: ElementRef<HTMLDivElement>;

  iterations = ITERATIONS;
  activeIterationId = ITERATIONS[0]?.id ?? 'base';

  orderedPoints: OrderedMapPoint[] = [];
  selectedPoint: OrderedMapPoint | null = null;
  selectedPointName = '';
  dragging = false;

  private map?: Map;
  private layerManager?: LayerManager<readonly VectorLayerDescriptor<any, Geometry, any>[]>;
  private pointsOrder: string[] = [...POINT_IDS];
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.orderedPoints = BASE_POINTS.map((point, index) =>
      this.createOrderedPoint(point, index + 1),
    );
    this.pointsOrder = this.orderedPoints.map((point) => point.id);
  }

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
          id: 'route-line',
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
              applyGeometryToModel: applyGeometryToOrderedMapPoint,
            },
            style: {
              base: (model: OrderedMapPoint) => ({
                color: '#2563eb',
                radius: 12,
                label: String(model.orderIndex),
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
              render: (opts: PointStyleOptions) =>
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
                  const model = items[0]?.model as OrderedMapPoint | undefined;
                  this.selectedPoint = model ?? null;
                  this.selectedPointName = model?.name ?? '';
                  return true;
                },
                onClear: () => {
                  this.selectedPoint = null;
                  this.selectedPointName = '';
                  return true;
                },
              },
              translate: {
                cursor: 'grab',
                hitTolerance: 6,
                state: 'DRAG',
                onStart: () => {
                  this.dragging = true;
                  this.syncFromLayer();
                  this.updateLineFromLayer();
                  return true;
                },
                onChange: () => {
                  this.syncFromLayer();
                  this.updateLineFromLayer();
                  return true;
                },
                onEnd: () => {
                  this.dragging = false;
                  this.syncFromLayer();
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
    };

    this.layerManager = LayerManager.create(this.map, schema);

    this.pointLayerApi?.setModels(this.orderedPoints);
    this.pointLayerApi?.centerOnAllModels({padding: {top: 48, right: 48, bottom: 48, left: 48}});
    this.updateLineFromLayer();
    setTimeout(() => this.map?.updateSize(), 0);

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.updateSize();
    });
    this.resizeObserver.observe(this.mapElement.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.setTarget(undefined);
  }

  setIteration(iteration: IterationOption): void {
    this.activeIterationId = iteration.id;
    this.applyPointOrder(iteration.order);
  }

  get activeIteration(): IterationOption | undefined {
    return this.iterations.find((iteration) => iteration.id === this.activeIterationId);
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
    const trimmed = value.trim();
    const updated = this.updateOrderedPoint(this.selectedPoint, {name: trimmed || this.selectedPoint.name});
    this.pointLayerApi.mutate(updated.id, () => updated);
    this.selectedPoint = updated;
    this.selectedPointName = updated.name;
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
    const api = this.pointLayerApi;
    if (!api) return;
    this.pointsOrder.forEach((id, index) => {
      const model = api.getModelById(id) as OrderedMapPoint | undefined;
      if (!model || model.orderIndex === index + 1) return;
      api.mutate(id, () => this.updateOrderedPoint(model, {orderIndex: index + 1}));
    });
  }

  private syncFromLayer(): void {
    const api = this.pointLayerApi;
    if (!api) return;
    this.orderedPoints = this.pointsOrder
      .map((id) => api.getModelById(id))
      .filter((point): point is OrderedMapPoint => Boolean(point));
    if (this.selectedPoint) {
      this.selectedPoint = api.getModelById(this.selectedPoint.id) ?? null;
      this.selectedPointName = this.selectedPoint?.name ?? '';
    }
  }

  private updateLineFromLayer(): void {
    const api = this.pointLayerApi;
    if (!api) return;
    const points = this.pointsOrder
      .map((id) => api.getModelById(id))
      .filter((point): point is OrderedMapPoint => Boolean(point));

    if (!points.length) return;
    this.lineLayerApi?.setModels([new MapLine(points)]);
  }

  private createOrderedPoint(point: MapPoint, orderIndex: number): OrderedMapPoint {
    return new OrderedMapPoint(
      point.id,
      point.name,
      point.lat,
      point.lng,
      point.district,
      point.address,
      point.details,
      point.status,
      point.schedule,
      orderIndex,
    );
  }

  private updateOrderedPoint(
    prev: OrderedMapPoint,
    updates: Partial<{name: string; lat: number; lng: number; orderIndex: number}>,
  ): OrderedMapPoint {
    return new OrderedMapPoint(
      prev.id,
      updates.name ?? prev.name,
      updates.lat ?? prev.lat,
      updates.lng ?? prev.lng,
      prev.district,
      prev.address,
      prev.details,
      prev.status,
      prev.schedule,
      updates.orderIndex ?? prev.orderIndex,
    );
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

  get pointLayerApi(): VectorLayerApi<OrderedMapPoint, Geometry> | undefined {
    return this.layerManager?.getApi('points');
  }

  get lineLayerApi(): VectorLayerApi<MapLine, LineString> | undefined {
    return this.layerManager?.getApi('route-line');
  }
}
