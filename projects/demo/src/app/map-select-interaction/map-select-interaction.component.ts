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
import {LayerManager, MapSchema, VectorLayerDescriptor} from '../../../../lib/src/lib/map-framework';
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

const POINTS = new MapPointGenerator().getByCount(5);

@Component({
  selector: 'app-map-select-interaction',
  standalone: true,
  templateUrl: './map-select-interaction.component.html',
  styleUrl: './map-select-interaction.component.scss',
})
export class MapSelectInteractionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) mapElement!: ElementRef<HTMLDivElement>;

  selectedPointName: string | null = null;

  private map?: Map;
  private layerManager?: LayerManager<
    readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
  >;

  constructor() {}

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
                states: {
                  SELECTED: () => ({
                    color: '#f97316',
                    radius: 10,
                  }),
                },
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
              interactions: {
                select: {
                  cursor: 'pointer',
                  state: 'SELECTED',
                  hitTolerance: 6,
                  onSelect: ({ items }) => {
                    this.selectedPointName = items[0]?.model?.name ?? null;
                    return true;
                  },
                  onClear: () => {
                      this.selectedPointName = null;
                    return true;
                  },
                },
              },
            },
          },
        ],
      };

    this.layerManager = LayerManager.create(this.map, schema);
    this.layerManager.getApi('points')?.setModels(POINTS);
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }
}
