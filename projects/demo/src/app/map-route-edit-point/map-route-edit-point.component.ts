import {CommonModule} from '@angular/common';
import {Component, NgZone} from '@angular/core';
import type Geometry from 'ol/geom/Geometry';
import {LineString} from 'ol/geom';
import {fromLonLat} from 'ol/proj';
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
import {MapHostComponent, MapHostConfig} from '../shared/map-host/map-host.component';
import {
  applyGeometryToMapPoint,
  mapPointToGeometry,
  MapPoint,
  MapPointGenerator,
} from '../shared/map-point';

const LAYER_ID = {
  ROUTE: 'route',
  POINTS: 'points',
} as const;

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

type LineStyleOptions = {
  color: string;
  width: number;
};

class RouteLine {
  public readonly id = 'single-route';

  constructor(public readonly points: MapPoint[]) {}
}

@Component({
  selector: 'app-map-route-edit-point',
  standalone: true,
  imports: [CommonModule, MapHostComponent],
  templateUrl: './map-route-edit-point.component.html',
  styleUrl: './map-route-edit-point.component.scss',
})
export class MapRouteEditPointComponent {
  points: MapPoint[] = new MapPointGenerator().getByCount(6);
  editingPointId: string | null = null;
  isDragging = false;

  readonly mapConfig: MapHostConfig<readonly VectorLayerDescriptor<any, Geometry, any>[]> = {
    schema: {
      layers: [
        {
          id: LAYER_ID.ROUTE,
          feature: {
            id: (model: RouteLine) => model.id,
            geometry: {
              fromModel: (model: RouteLine) =>
                new LineString(model.points.map((p) => fromLonLat([p.lng, p.lat]))),
              applyGeometryToModel: (prev: RouteLine) => prev,
            },
            style: {
              base: () => ({
                color: '#16a34a',
                width: 4,
              }),
              render: (opts: LineStyleOptions) =>
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
          id: LAYER_ID.POINTS,
          feature: {
            id: (model: MapPoint) => model.id,
            geometry: {
              fromModel: mapPointToGeometry,
              applyGeometryToModel: applyGeometryToMapPoint,
            },
            style: {
              base: (model: MapPoint) => ({
                color: this.editingPointId === model.id ? '#f97316' : '#1d4ed8',
                radius: this.editingPointId === model.id ? 9 : 7,
                label: model.name,
              }),
              states: {
                DRAG: () => ({
                  color: '#dc2626',
                  radius: 10,
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
                    fill: new Fill({color: '#1f2937'}),
                    stroke: new Stroke({color: '#ffffff', width: 3}),
                    font: '600 12px "Inter", sans-serif',
                  }),
                }),
            },
            interactions: {
              translate: {
                cursor: 'grab',
                state: 'DRAG',
                pickTarget: ({candidates}) =>
                  candidates.find((candidate) => candidate.model.id === this.editingPointId),
                onStart: () => {
                  this.zone.run(() => {
                    this.isDragging = true;
                  });
                  return true;
                },
                onEnd: () => {
                  this.zone.run(() => {
                    this.isDragging = false;
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
      centerLonLat: [27.5619, 53.9023],
      zoom: 11,
    },
    osm: true,
  };

  private pointLayerApi?: VectorLayerApi<MapPoint, Geometry>;
  private routeLayerApi?: VectorLayerApi<RouteLine, LineString>;

  constructor(private readonly zone: NgZone) {}

  onReady(ctx: MapContext): void {
    this.pointLayerApi = ctx.layers[LAYER_ID.POINTS];
    this.routeLayerApi = ctx.layers[LAYER_ID.ROUTE];

    this.pointLayerApi?.setModels(this.points);
    this.pointLayerApi?.centerOnAllModels();
    this.routeLayerApi?.setModels([new RouteLine(this.points)]);

    this.pointLayerApi?.onModelsChanged?.((changes) => {
      this.zone.run(() => {
        changes.forEach((change) => {
          const index = this.points.findIndex((point) => point.id === change.next.id);
          if (index >= 0) {
            this.points = [
              ...this.points.slice(0, index),
              change.next,
              ...this.points.slice(index + 1),
            ];
          }
        });

        this.updateRouteLayer();
      });
    });
  }

  startEdit(pointId: string): void {
    this.editingPointId = pointId;
    this.pointLayerApi?.setModels(this.points);
    this.pointLayerApi?.centerOnModel(pointId, {maxZoom: 15});
  }

  stopEdit(): void {
    this.editingPointId = null;
    this.isDragging = false;
    this.pointLayerApi?.setModels(this.points);
  }

  deletePoint(pointId: string): void {
    this.points = this.points.filter((point) => point.id !== pointId);
    if (this.editingPointId === pointId) {
      this.stopEdit();
    }

    this.pointLayerApi?.setModels(this.points);
    this.updateRouteLayer();

    if (this.points.length) {
      this.pointLayerApi?.centerOnAllModels();
    }
  }

  private updateRouteLayer(): void {
    if (this.points.length < 2) {
      this.routeLayerApi?.setModels([]);
      return;
    }

    this.routeLayerApi?.setModels([new RouteLine(this.points)]);
  }
}
