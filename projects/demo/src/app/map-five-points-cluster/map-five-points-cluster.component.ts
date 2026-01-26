import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import type Geometry from 'ol/geom/Geometry';
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
import { escapeHtml } from '../../../../lib/src/lib/map-framework/public-utils/html-escape.utils';
import { MapHostComponent, MapHostConfig } from '../shared/map-host/map-host.component';
import {
  applyGeometryToMapPoint,
  mapPointToGeometry,
  MapPoint,
  MapPointGenerator,
} from '../shared/map-point';

const LAYER_ID = 'points';

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

const POINTS = new MapPointGenerator().getByIds([
  'minsk-center',
  'minsk-museum',
  'minsk-theatre',
  'minsk-dynamo',
  'minsk-library',
]);

@Component({
  selector: 'app-map-five-points-cluster',
  standalone: true,
  imports: [CommonModule, MapHostComponent],
  templateUrl: './map-five-points-cluster.component.html',
  styleUrl: './map-five-points-cluster.component.scss',
})
export class MapFivePointsClusterComponent {
  @ViewChild('popupHost', { static: true }) popupHostElement!: ElementRef<HTMLDivElement>;

  isClusteringEnabled = true;

  readonly points = POINTS;

  readonly mapConfig: MapHostConfig<
    readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
  > = {
    schema: {
      layers: [
        {
          id: LAYER_ID,
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
                    fill: new Fill({ color: '#1f2937' }),
                    stroke: new Stroke({ color: '#ffffff', width: 3 }),
                    font: '600 12px "Inter", sans-serif',
                  }),
                }),
            },
            popup: {
              item: ({ model }) => ({
                model: model,
                className: 'popup-card',
                content: `<b>Не кластер</b> <p>model.name</p>`,
              }),
            },
          },
          clustering: {
            enabledByDefault: false,
            distance: 72,
            clusterStyle: {
              render: ({ size }) => {
                const radius = Math.min(28, 12 + size * 2);
                return new Style({
                  image: new CircleStyle({
                    radius,
                    fill: new Fill({ color: '#0ea5e9' }),
                    stroke: new Stroke({ color: '#0f172a', width: 2 }),
                  }),
                  text: new Text({
                    text: String(size),
                    fill: new Fill({ color: '#ffffff' }),
                    stroke: new Stroke({ color: 'rgba(15, 23, 42, 0.6)', width: 2 }),
                    font: '700 13px "Inter", sans-serif',
                  }),
                });
              },
            },
            popup: {
              item: ({ models }) => ({
                model: models[0],
                content: this.buildClusterPopupContent(models),
                className: 'popup-card',
              }),
            },
            expandOnClick: {
              mode: 'zoomToExtent',
              padding: {all: 120},
              maxZoom: 16,
              durationMs: 350,
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
    },
    view: {
      centerLonLat: [27.5619, 53.9023],
      zoom: 10,
    },
    osm: true,
  };

  private pointLayerApi?: VectorLayerApi<MapPoint, Geometry>;

  onReady(ctx: MapContext): void {
    this.pointLayerApi = ctx.layers[LAYER_ID] as VectorLayerApi<MapPoint, Geometry> | undefined;
    this.pointLayerApi?.setModels(POINTS);
    this.pointLayerApi?.centerOnAllModels({
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
    });
    this.pointLayerApi?.setClusteringEnabled?.(this.isClusteringEnabled);
  }

  toggleClustering(): void {
    if (!this.pointLayerApi?.setClusteringEnabled) return;
    this.isClusteringEnabled = !this.isClusteringEnabled;
    this.pointLayerApi.setClusteringEnabled(this.isClusteringEnabled);
  }

  private buildClusterPopupContent(models: MapPoint[]): HTMLElement {
    const tpl = document.createElement('template');
    const items = models.map((model) => `<li>${escapeHtml(model.name)}</li>`).join('');
    tpl.innerHTML = `
      <div class="popup-content">
        <h3>Кластер (${models.length})</h3>
        <ul>${items}</ul>
      </div>
    `;
    return tpl.content.firstElementChild as HTMLElement;
  }
}
