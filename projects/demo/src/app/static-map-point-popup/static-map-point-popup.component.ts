import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import Map from 'ol/Map';
import type Geometry from 'ol/geom/Geometry';
import Point from 'ol/geom/Point';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import { LayerManager, MapSchema, VectorLayerDescriptor } from '../../../../lib/src/lib/map-framework';
import {escapeHtml} from '../../../../lib/src/lib/map-framework/public-utils/html-escape.utils';

type MapPoint = {
  id: string;
  name: string;
  coords: [number, number];
  district: string;
  address: string;
  details: string;
  status: string;
  schedule: string;
};

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

const POINTS: MapPoint[] = [
  {
    id: 'minsk-center',
    name: 'Площадь Победы',
    coords: [27.5678, 53.9097],
    district: 'Центральный район',
    address: 'пр-т Независимости, 40',
    details: 'Памятник и мемориальный комплекс в центре города.',
    status: 'Статус: достопримечательность',
    schedule: 'Работает круглосуточно',
  },
  {
    id: 'minsk-center2',
    name: 'Площадь Победы2',
    coords: [27.5678, 53.9097],
    district: 'Центральный район2',
    address: 'пр-т Независимости2, 40',
    details: 'Для проверки как отобразяться ',
    status: 'Статус: достопримечательность2',
    schedule: 'Работает круглосуточно2',
  },
  {
    id: 'minsk-library1',
    name: 'Национальная библиотека1',
    coords: [27.6434, 53.9314],
    district: 'Первомайский район',
    address: 'пр-т Независимости, 116',
    details: 'Главная библиотека страны с обзорной площадкой.',
    status: 'Статус: культурный объект',
    schedule: 'Открыта с 10:00 до 21:00',
  },
  {
    id: 'minsk-library2',
    name: 'Национальная библиотека2',
    coords: [27.6434, 53.9314],
    district: 'Первомайский район',
    address: 'пр-т Независимости, 116',
    details: 'Главная библиотека страны с обзорной площадкой.',
    status: 'Статус: культурный объект',
    schedule: 'Открыта с 10:00 до 21:00',
  },
  {
    id: 'minsk-library3',
    name: 'Национальная библиотека3',
    coords: [27.6434, 53.9314],
    district: 'Первомайский район',
    address: 'пр-т Независимости, 116',
    details: 'Главная библиотека страны с обзорной площадкой.',
    status: 'Статус: культурный объект',
    schedule: 'Открыта с 10:00 до 21:00',
  },
  {
    id: 'minsk-arena',
    name: 'Минск-Арена',
    coords: [27.4786, 53.9362],
    district: 'Фрунзенский район',
    address: 'пр-т Победителей, 111',
    details: 'Крупный спортивно-развлекательный комплекс.',
    status: 'Статус: спортивный объект',
    schedule: 'Расписание зависит от мероприятий',
  },
  {
    id: 'minsk-tractors',
    name: 'Тракторный завод',
    coords: [27.6204, 53.8759],
    district: 'Партизанский район',
    address: 'ул. Долгобродская, 29',
    details: 'Промышленный гигант и один из символов города.',
    status: 'Статус: промышленный объект',
    schedule: 'Экскурсии по записи',
  },
];

@Component({
  selector: 'app-static-map-point-popup',
  standalone: true,
  templateUrl: './static-map-point-popup.component.html',
  styleUrl: './static-map-point-popup.component.scss',
})
export class StaticMapPointPopupComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) mapElement!: ElementRef<HTMLDivElement>;
  @ViewChild('popupHost', { static: true }) popupHostElement!: ElementRef<HTMLDivElement>;

  private map?: Map;
  private layerManager?: LayerManager<
    readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
  >;

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

    const schema: MapSchema<readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]> =
      {
        layers: [
          {
            id: 'points',
            feature: {
              id: (model: MapPoint) => model.id,
              geometry: {
                fromModel: (model: MapPoint) => new Point(fromLonLat(model.coords)),
                applyGeometryToModel: (prev: MapPoint) => prev,
              },
              style: {
                base: (model: MapPoint) => ({
                  color: '#2563eb',
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
              popup: {
                item: ({ model }) => ({
                  model: model,
                  className: 'popup-card',
                  content: this.buildPopupContent(model),
                }),
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
    let pointsLayerApi = this.layerManager.getApi('points');
    pointsLayerApi?.setModels(POINTS);
    pointsLayerApi?.centerOnAllModels();
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }

  private buildPopupContent(model: MapPoint): HTMLElement {
    const tpl = document.createElement('template');

    tpl.innerHTML = `
    <div class="popup-content">
      <h3>${escapeHtml(model.name)}</h3>
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
