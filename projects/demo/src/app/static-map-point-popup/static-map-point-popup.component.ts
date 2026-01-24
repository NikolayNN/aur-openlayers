import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import Map from 'ol/Map';
import type Geometry from 'ol/geom/Geometry';
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
import {
  applyGeometryToMapPoint,
  mapPointToGeometry,
  MapPoint,
  MapPointGenerator,
} from '../shared/map-point';

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

const POINTS = new MapPointGenerator().getByIds([
  'minsk-center',
  'minsk-library',
  'minsk-arena',
  'minsk-tractors',
  'minsk-station',
]);

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
                fromModel: mapPointToGeometry,
                applyGeometryToModel: applyGeometryToMapPoint,
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
