import { Component, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import Polygon from 'ol/geom/Polygon';
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

const LAYER_ID = 'polygons';

type MapPolygon = {
  id: string;
  name: string;
  color: string;
  coordinates: [number, number][];
};

type PolygonStyleOptions = {
  fillColor: string;
  strokeColor: string;
  label: string;
  strokeWidth: number;
  lineDash: boolean;
};

const POLYGONS: MapPolygon[] = [
  {
    id: 'polygon-1',
    name: 'Жилой сектор',
    color: '#2563eb',
    coordinates: [
      [27.5458, 53.9102],
      [27.5578, 53.9138],
      [27.5655, 53.9072],
      [27.5534, 53.9038],
      [27.5458, 53.9102],
    ],
  },
  {
    id: 'polygon-2',
    name: 'Деловой центр',
    color: '#f97316',
    coordinates: [
      [27.5698, 53.9058],
      [27.582, 53.9095],
      [27.5898, 53.9033],
      [27.5785, 53.899],
      [27.5698, 53.9058],
    ],
  },
  {
    id: 'polygon-3',
    name: 'Набережная зона',
    color: '#10b981',
    coordinates: [
      [27.552, 53.8988],
      [27.5622, 53.9025],
      [27.569, 53.896],
      [27.5592, 53.8925],
      [27.552, 53.8988],
    ],
  },
];

@Component({
  selector: 'app-map-polygons-modify',
  standalone: true,
  imports: [CommonModule, MapHostComponent],
  templateUrl: './map-polygons-modify.component.html',
  styleUrl: './map-polygons-modify.component.scss',
})
export class MapPolygonsModifyComponent implements OnDestroy {
  polygons: MapPolygon[] = POLYGONS.map((polygon) => ({
    ...polygon,
    coordinates: polygon.coordinates.map((coord) => [...coord] as [number, number]),
  }));

  isModifying = false;
  activePolygonName: string | null = null;

  readonly mapConfig: MapHostConfig<
    readonly VectorLayerDescriptor<MapPolygon, Polygon, PolygonStyleOptions>[]
  >;

  private polygonLayerApi?: VectorLayerApi<MapPolygon, Polygon>;
  private unsubscribeModelsChanged?: () => void;

  constructor(private readonly zone: NgZone) {
    this.mapConfig = {
      schema: {
        layers: [
          {
            id: LAYER_ID,
            feature: {
              id: (model: MapPolygon) => model.id,
              geometry: {
                fromModel: (model: MapPolygon) =>
                  new Polygon([
                    model.coordinates.map(([lng, lat]) => fromLonLat([lng, lat])),
                  ]),
                applyGeometryToModel: this.applyGeometryToPolygonModel,
              },
              style: {
                base: (model: MapPolygon) => ({
                  fillColor: `${model.color}55`,
                  strokeColor: model.color,
                  label: model.name,
                  strokeWidth: 2,
                  lineDash: false
                }),
                states: {
                  MODIFY: () => ({
                    strokeWidth: 5,
                    lineDash: true
                  }),
                },
                render: (opts: PolygonStyleOptions) =>
                  new Style({
                    fill: new Fill({ color: opts.fillColor }),
                    stroke: new Stroke({
                      color: opts.strokeColor,
                      width: opts.strokeWidth,
                      ...(opts.lineDash ? { lineDash: [12, 8] } : {}),
                    }),
                    text: new Text({
                      text: opts.label,
                      textAlign: 'center',
                      textBaseline: 'middle',
                      fill: new Fill({ color: '#0f172a' }),
                      stroke: new Stroke({ color: '#ffffff', width: 3 }),
                      font: '600 13px "Inter", sans-serif',
                    }),
                  }),
              },
              interactions: {
                modify: {
                  cursor: 'grabbing',
                  // Увеличенный радиус попадания: на тачпадах/retina-дисплеях
                  // вершину сложнее "зацепить" с небольшим hitTolerance,
                  // из-за чего может казаться, что полигон не редактируется.
                  hitTolerance: 16,
                  state: 'MODIFY',
                  //опциональная настройка маркера вида маркера при редактированиии
                  vertexStyle: new Style({
                    image: new CircleStyle({
                      radius: 6,
                      fill: new Fill({ color: '#f97316' }),
                      stroke: new Stroke({ color: '#ffffff', width: 2 }),
                    }),
                  }),
                  onStart: ({ item }) => {
                    this.zone.run(() => {
                      this.isModifying = true;
                      this.activePolygonName = item.model?.name ?? null;
                    });
                    return true;
                  },
                  onEnd: () => {
                    this.zone.run(() => {
                      this.isModifying = false;
                      this.activePolygonName = null;
                    });
                    return true;
                  },
                },
              },
            },
          },
        ],
      },
      view: {
        centerLonLat: [27.566, 53.904],
        zoom: 12,
      },
      osm: true,
    };
  }

  onReady(ctx: MapContext): void {
    this.polygonLayerApi = ctx.layers[LAYER_ID];

    this.polygonLayerApi?.setModels(this.polygons);
    this.polygonLayerApi?.centerOnAllModels();

    // Связка "карта → компонент":
    // изменения полигонов на карте (drag/modify) отражаются в локальном массиве `this.polygons`,
    // чтобы Angular-интерфейс оставался актуальным.
    this.unsubscribeModelsChanged = this.polygonLayerApi?.onModelsChanged?.((changes) => {
      this.zone.run(() => {
        const updated = [...this.polygons];
        changes.forEach(({ next }) => {
          const index = updated.findIndex((polygon) => polygon.id === next.id);
          if (index !== -1) {
            updated[index] = next;
          }
        });
        this.polygons = updated;
      });
    });
  }

  ngOnDestroy(): void {
    // Отписываемся от событий слоя при уничтожении компонента
    this.unsubscribeModelsChanged?.();
  }

  //UI: Для отображения вершин: если полигон замкнут (последняя точка = первой), убираем дубликат последней точки.
  getVerticesForDisplay(polygon: MapPolygon): [number, number][] {
    const vertices = polygon.coordinates;
    if (vertices.length < 2) {
      return vertices;
    }
    const first = vertices[0];
    const last = vertices[vertices.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      return vertices.slice(0, -1);
    }
    return vertices;
  }

  trackByPolygonId(_: number, polygon: MapPolygon): string {
    return polygon.id;
  }

  // Обновляет модель полигона по геометрии с карты: берём координаты внешнего контура, переводим в lon/lat и нормализуем.
  private applyGeometryToPolygonModel = (prev: MapPolygon, geometry: Polygon): MapPolygon => {
    const ring = geometry.getCoordinates()[0] ?? [];
    const updated = ring.map((coords) => toLonLat(coords) as [number, number]);
    return {
      ...prev,
      coordinates: this.normalizePolygon(updated),
    };
  };

  private normalizePolygon(vertices: [number, number][]): [number, number][] {
    if (vertices.length === 0) {
      return vertices;
    }
    const first = vertices[0];
    const last = vertices[vertices.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      return vertices;
    }
    return [...vertices, first];
  }
}
