import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import OlMap from 'ol/Map';
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
  id: string;
  name: string;
};

const POINTS: MapPoint[] = new MapPointGenerator().getByCount(3);

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
    readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
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
      readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
    > = {
      layers: [
        {
          id: 'points',
          feature: {
            id: (m) => m.id,
            geometry: {
              fromModel: mapPointToGeometry,
              applyGeometryToModel: applyGeometryToMapPoint,
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
    const index = POINTS.findIndex((p) => p.id === id);
    if (index === -1) return;

    const current = POINTS[index];

    // 1) Собираем updates
    const updates =
      field === 'name'
        ? { name: String(value) }
        : (() => {
          const num = typeof value === 'number' ? value : Number(value);
          return Number.isFinite(num) ? { [field]: num } : null;
        })();

    if (!updates) return;

    const updated = this.updatePointModel(current, updates);

    POINTS[index] = updated;
    const api = this.layerManager?.getApi('points');
    api?.mutate(id, () => updated);
    api?.centerOnModel(id, { maxZoom: 14 });
  }

  private updatePointModel(
    prev: MapPoint,
    updates: Partial<Pick<MapPoint, 'name' | 'lat' | 'lng'>>,
  ): MapPoint {
    return new MapPoint(
      prev.id,
      updates.name ?? prev.name,
      updates.lat ?? prev.lat,
      updates.lng ?? prev.lng,
      prev.district,
      prev.address,
      prev.details,
      prev.status,
      prev.schedule,
    );
  }


  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }

  protected readonly POINTS = POINTS;
}
