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
import {LayerManager, MapSchema, VectorLayerDescriptor} from '../../../../lib/src/lib/map-framework';



type MapPoint = {
  id: string;
  name: string;
  coords: [number, number];
};

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

const POINTS: MapPoint[] = [
  { id: 'minsk-center', name: 'Минск', coords: [27.5619, 53.9023] },
  { id: 'minsk-library', name: 'Нац. библиотека', coords: [27.6434, 53.9314] },
  { id: 'minsk-arena', name: 'Минск-Арена', coords: [27.4786, 53.9362] },
];

@Component({
  selector: 'app-simple-map',
  standalone: true,
  templateUrl: './simple-map.component.html',
  styleUrl: './simple-map.component.scss',
})
export class SimpleMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) mapElement!: ElementRef<HTMLDivElement>;

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
                  color: '#1976d2',
                  radius: 6,
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
                      fill: new Fill({ color: '#1f2937' }),
                      stroke: new Stroke({ color: '#ffffff', width: 3 }),
                      font: '600 12px "Inter", sans-serif',
                    }),
                  }),
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
