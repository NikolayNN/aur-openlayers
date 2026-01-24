import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild} from '@angular/core';
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
import {LayerManager, MapSchema, VectorLayerApi, VectorLayerDescriptor} from '../../../../lib/src/lib/map-framework';
import {applyGeometryToMapPoint, mapPointToGeometry, MapPoint} from '../shared/map-point';

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

const INITIAL_POINT = new MapPoint('minsk-center', 'Точка Минска', 53.9097, 27.5678);

@Component({
  selector: 'app-map-point-move',
  standalone: true,
  templateUrl: './map-point-move.component.html',
  styleUrl: './map-point-move.component.scss',
})
export class MapPointMoveComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', {static: true}) mapElement!: ElementRef<HTMLDivElement>;

  currentPoint = INITIAL_POINT;

  private map?: Map;
  private layerManager?: LayerManager<
    readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
  >;
  private unsubscribe?: () => void;

  constructor(private readonly ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.map = new Map({
      target: this.mapElement.nativeElement,
      layers: [new TileLayer({source: new OSM()})],
      view: new View({
        center: fromLonLat([INITIAL_POINT.lng, INITIAL_POINT.lat]),
        zoom: 12,
      }),
    });

    const schema: MapSchema<
      readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
    > = {
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
                radius: 8,
                label: model.name,
              }),
              states: {
                DRAGGING: () => ({
                  color: '#f97316',
                  radius: 12,
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
                cursor: 'grabbing',
                hitTolerance: 6,
                state: 'DRAGGING',
              },
            },
          },
        },
      ],
    };

    this.layerManager = LayerManager.create(this.map, schema);

    const api = this.pointLayerApi;
    api?.setModels([INITIAL_POINT]);
    api?.centerOnAllModels({maxZoom: 13});

    this.unsubscribe = api?.onModelsChanged?.((changes) => {
      const latest = changes.at(-1);
      if (!latest) return;
      this.ngZone.run(() => {
        this.currentPoint = latest.next;
      });
    });
  }

  get pointLayerApi(): VectorLayerApi<MapPoint, Geometry> | undefined {
    return this.layerManager?.getApi('points');
  }

  formatCoord(value: number): string {
    return value.toFixed(6);
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.map?.setTarget(undefined);
  }
}
