import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import OlMap from 'ol/Map';
import type Geometry from 'ol/geom/Geometry';
import Point from 'ol/geom/Point';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import {fromLonLat, toLonLat} from 'ol/proj';
import OSM from 'ol/source/OSM';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import {LayerManager, MapSchema, VectorLayerDescriptor} from '../../../../lib/src/lib/map-framework';

type EditablePoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type PointStyleOptions = {
  color: string;
  radius: number;
  id: string;
  name: string;
};

const POINTS: EditablePoint[] = [
  {id: 'p-1', name: 'Минск центр', lat: 53.9023, lng: 27.5619},
  {id: 'p-2', name: 'Нац. библиотека', lat: 53.9314, lng: 27.6434},
  {id: 'p-3', name: 'Минск-Арена', lat: 53.9362, lng: 27.4786},
];

@Component({
  selector: 'app-map-point-mutate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-point-mutate.component.html',
  styleUrl: './map-point-mutate.component.scss',
})
export class MapPointMutateComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', {static: true}) mapElement!: ElementRef<HTMLDivElement>;

  private map?: OlMap;
  private layerManager?: LayerManager<
    readonly VectorLayerDescriptor<EditablePoint, Geometry, PointStyleOptions>[]
  >;

  ngAfterViewInit(): void {
    this.map = new OlMap({
      target: this.mapElement.nativeElement,
      layers: [new TileLayer({source: new OSM()})],
      view: new View({
        center: fromLonLat([27.5619, 53.9023]),
        zoom: 11,
      }),
    });

    const schema: MapSchema<
      readonly VectorLayerDescriptor<EditablePoint, Geometry, PointStyleOptions>[]
    > = {
      layers: [
        {
          id: 'points',
          feature: {
            id: (m) => m.id,
            geometry: {
              fromModel: (m) => new Point(fromLonLat([m.lng, m.lat])),
              applyGeometryToModel: (prev, geom) => {
                if (!(geom instanceof Point)) return prev;
                const [lng, lat] = toLonLat(geom.getCoordinates());
                return {...prev, lng, lat};
              },
            },
            style: {
              base: (m) => ({color: '#7c3aed', radius: 7, id: m.id, name: m.name}),
              render: (o) =>
                new Style({
                  image: new CircleStyle({
                    radius: o.radius,
                    fill: new Fill({color: o.color}),
                    stroke: new Stroke({color: '#fff', width: 2}),
                  }),
                  text: new Text({
                    text: `[${o.id}] ${o.name}`,
                    offsetY: 18,
                    fill: new Fill({color: '#111827'}),
                    stroke: new Stroke({color: '#fff', width: 3}),
                    font: '600 12px "Inter", sans-serif',
                  }),
                }),
            },
          },
        },
      ],
    };

    this.layerManager = LayerManager.create(this.map, schema);

    const api = this.layerManager.getApi('points');
    api?.setModels(POINTS);
    api?.centerOnAllModels();
  }

  updatePoint(id: string, field: 'name' | 'lat' | 'lng', value: string | number): void {
    const p = this.getPoint(id);
    if (!p) return;

    if (field === 'name') {
      p.name = String(value);
    } else {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return;
      field === 'lat' ? (p.lat = n) : (p.lng = n);
    }

    this.layerManager?.getApi('points')?.mutate(id, (m) => ({
      ...m,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
    }));

    this.layerManager?.getApi('points')?.centerOnModel(id, {maxZoom: 14});
  }

  private getPoint(id: string): EditablePoint | undefined {
    return POINTS.find((p) => p.id === id);
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }

  protected readonly POINTS = POINTS;
}
