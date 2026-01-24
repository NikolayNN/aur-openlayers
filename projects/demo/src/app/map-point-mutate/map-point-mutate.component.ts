import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import type Geometry from 'ol/geom/Geometry';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import {
  MapContext,
  MapHostComponent,
  MapHostConfig,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
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
  imports: [CommonModule, FormsModule, MapHostComponent],
  templateUrl: './map-point-mutate.component.html',
  styleUrl: './map-point-mutate.component.scss',
})
export class MapPointMutateComponent {
  readonly mapConfig: MapHostConfig<
    readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
  > = {
    schema: {
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
    },
    view: {
      centerLonLat: [27.5619, 53.9023],
      zoom: 11,
    },
    osm: true,
  };

  private pointLayerApi?: VectorLayerApi<MapPoint, Geometry>;

  onReady(ctx: MapContext): void {
    this.pointLayerApi = ctx.layers['points'] as VectorLayerApi<MapPoint, Geometry> | undefined;
    this.pointLayerApi?.setModels(POINTS);
    this.pointLayerApi?.centerOnAllModels();
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
    this.pointLayerApi?.mutate(id, () => updated);
    this.pointLayerApi?.centerOnModel(id, { maxZoom: 14 });
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


  protected readonly POINTS = POINTS;
}
