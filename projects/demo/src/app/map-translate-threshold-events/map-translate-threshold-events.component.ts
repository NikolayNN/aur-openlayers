import { CommonModule } from '@angular/common';
import { Component, NgZone } from '@angular/core';
import type Geometry from 'ol/geom/Geometry';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import { MapContext, VectorLayerDescriptor } from '../../../../lib/src/lib/map-framework';
import { MapHostComponent, MapHostConfig } from '../shared/map-host/map-host.component';
import { applyGeometryToMapPoint, mapPointToGeometry, MapPoint } from '../shared/map-point';

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

type DemoMapKey = 'threshold0' | 'defaultThreshold';

type EventLogItem = {
  id: number;
  event: string;
  count: number;
};

const MAP_LAYER_ID = 'points';
const MAX_LOG_SIZE = 120;

@Component({
  selector: 'app-map-translate-threshold-events',
  standalone: true,
  imports: [CommonModule, MapHostComponent],
  templateUrl: './map-translate-threshold-events.component.html',
  styleUrl: './map-translate-threshold-events.component.scss',
})
export class MapTranslateThresholdEventsComponent {
  readonly thresholdZeroConfig = this.createMapConfig('threshold0', 0);
  readonly defaultThresholdConfig = this.createMapConfig('defaultThreshold');

  private readonly modelsByMap: Record<DemoMapKey, MapPoint> = {
    threshold0: new MapPoint('point-threshold-0', 'Точка A', 53.9097, 27.5678),
    defaultThreshold: new MapPoint('point-threshold-default', 'Точка B', 53.9097, 27.5678),
  };

  logsByMap: Record<DemoMapKey, EventLogItem[]> = {
    threshold0: [],
    defaultThreshold: [],
  };

  private nextLogId = 1;

  constructor(private readonly zone: NgZone) {}

  onReady(mapKey: DemoMapKey, ctx: MapContext): void {
    ctx.layers[MAP_LAYER_ID]?.setModels([this.modelsByMap[mapKey]]);
    ctx.layers[MAP_LAYER_ID]?.centerOnAllModels({ maxZoom: 13 });
    this.pushLog(mapKey, 'map ready');
  }

  clearLog(mapKey: DemoMapKey): void {
    this.logsByMap = {
      ...this.logsByMap,
      [mapKey]: [],
    };
  }

  private createMapConfig(
    mapKey: DemoMapKey,
    startThresholdPx?: number,
  ): MapHostConfig<readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]> {
    return {
      schema: {
        layers: [
          {
            id: MAP_LAYER_ID,
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
                  SELECTED: () => ({
                    color: '#8b5cf6',
                    radius: 10,
                  }),
                  DRAGGING: () => ({
                    color: '#f97316',
                    radius: 11,
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
                  hitTolerance: 6,
                  state: 'SELECTED',
                  onSelect: () => {
                    this.pushLog(mapKey, 'onSelect');
                    return true;
                  },
                  onClear: () => {
                    this.pushLog(mapKey, 'onClear');
                    return true;
                  },
                },
                translate: {
                  cursor: 'grabbing',
                  hitTolerance: 6,
                  state: 'DRAGGING',
                  ...(startThresholdPx !== undefined ? { startThresholdPx } : {}),
                  onStart: () => {
                    this.pushLog(mapKey, 'onDragStart');
                    return true;
                  },
                  onChange: () => {
                    this.pushLog(mapKey, 'onDragChange');
                    return true;
                  },
                  onEnd: () => {
                    this.pushLog(mapKey, 'onDragEnd');
                    return true;
                  },
                },
              },
            },
          },
        ],
      },
      view: {
        centerLonLat: [27.5678, 53.9097],
        zoom: 12,
      },
      osm: true,
    };
  }

  private pushLog(mapKey: DemoMapKey, event: string): void {
    this.zone.run(() => {
      const currentLog = this.logsByMap[mapKey];
      const firstItem = currentLog[0];

      if (firstItem?.event === event) {
        const updatedFirstItem: EventLogItem = {
          ...firstItem,
          count: firstItem.count + 1,
        };

        this.logsByMap = {
          ...this.logsByMap,
          [mapKey]: [updatedFirstItem, ...currentLog.slice(1)],
        };
        return;
      }

      const entry: EventLogItem = {
        id: this.nextLogId++,
        event,
        count: 1,
      };

      this.logsByMap = {
        ...this.logsByMap,
        [mapKey]: [entry, ...currentLog].slice(0, MAX_LOG_SIZE),
      };
    });
  }
}
