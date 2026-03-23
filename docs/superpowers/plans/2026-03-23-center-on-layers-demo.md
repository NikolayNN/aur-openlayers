# Center On Layers Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a demo component that demonstrates `centerOnAllLayers` and `centerOnLayers` on `MapContext`.

**Architecture:** Single Angular component with 3 point layers (geographically separated) and 6 buttons calling the centering methods. Follows the `simple-map-two-static-layers` pattern.

**Tech Stack:** Angular, OpenLayers, SCSS

**Spec:** `docs/superpowers/specs/2026-03-23-center-on-layers-demo-design.md`

---

### Task 1: Create the demo component and route

**Files:**
- Create: `projects/demo/src/app/center-on-layers/center-on-layers.component.ts`
- Create: `projects/demo/src/app/center-on-layers/center-on-layers.component.html`
- Create: `projects/demo/src/app/center-on-layers/center-on-layers.component.scss`
- Modify: `projects/demo/src/app/app.routes.ts`

- [ ] **Step 1: Create the component TypeScript file**

Create `projects/demo/src/app/center-on-layers/center-on-layers.component.ts`:

```typescript
import {Component} from '@angular/core';
import {
  MapContext,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
import {MapHostComponent, MapHostConfig} from '../shared/map-host/map-host.component';
import {DemoHeaderComponent} from '../shared/demo-header/demo-header.component';
import type Geometry from 'ol/geom/Geometry';
import Point from 'ol/geom/Point';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import {
  applyGeometryToMapPoint,
  mapPointToGeometry,
  MapPoint,
  MapPointGenerator,
} from '../shared/map-point';

const LAYER_ID = {
  A: 'a',
  B: 'b',
  C: 'c',
} as const;

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

const gen = new MapPointGenerator();
const POINTS_A = gen.getByIds(['minsk-arena', 'minsk-lake', 'minsk-island']);
const POINTS_B = gen.getByIds(['minsk-library', 'minsk-botanical', 'minsk-parkstone']);
const POINTS_C = gen.getByIds(['minsk-tractors', 'minsk-zoo', 'minsk-chizhovka']);

const pointLayer = (id: string, color: string): VectorLayerDescriptor<MapPoint, Point, PointStyleOptions> => ({
  id,
  feature: {
    id: (model: MapPoint) => model.id,
    geometry: {
      fromModel: mapPointToGeometry,
      applyGeometryToModel: applyGeometryToMapPoint,
    },
    style: {
      base: (model: MapPoint) => ({color, radius: 6, label: model.name}),
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
  },
});

@Component({
  selector: 'app-center-on-layers',
  standalone: true,
  imports: [MapHostComponent, DemoHeaderComponent],
  templateUrl: './center-on-layers.component.html',
  styleUrl: './center-on-layers.component.scss',
})
export class CenterOnLayersComponent {
  readonly mapConfig: MapHostConfig<readonly VectorLayerDescriptor<any, Geometry, any>[]> = {
    schema: {
      layers: [
        pointLayer(LAYER_ID.A, '#1976d2'),
        pointLayer(LAYER_ID.B, '#2e7d32'),
        pointLayer(LAYER_ID.C, '#c62828'),
      ],
    },
    view: {
      centerLonLat: [27.5619, 53.9023],
      zoom: 11,
    },
    osm: true,
  };

  private ctx?: MapContext;

  onReady(ctx: MapContext): void {
    this.ctx = ctx;

    (ctx.layers[LAYER_ID.A] as VectorLayerApi<MapPoint, Point>)?.setModels(POINTS_A);
    (ctx.layers[LAYER_ID.B] as VectorLayerApi<MapPoint, Point>)?.setModels(POINTS_B);
    (ctx.layers[LAYER_ID.C] as VectorLayerApi<MapPoint, Point>)?.setModels(POINTS_C);

    ctx.centerOnAllLayers();
  }

  centerAll(): void {
    this.ctx?.centerOnAllLayers();
  }

  centerLayers(ids: string[]): void {
    this.ctx?.centerOnLayers(ids);
  }
}
```

- [ ] **Step 2: Create the template**

Create `projects/demo/src/app/center-on-layers/center-on-layers.component.html`:

```html
<section class="map-container">
  <app-demo-header
    title="Центрирование по слоям"
    component="CenterOnLayersComponent"
    description="Центрирование карты на всех или выбранных слоях. Три слоя точек в разных частях Минска."
    [features]="['centerOnAllLayers', 'centerOnLayers']"
    [interactions]="['Кнопки центрирования']"
  />

  <div class="button-group">
    <button type="button" (click)="centerAll()">Все слои</button>
    <button type="button" (click)="centerLayers(['a'])">Слой A</button>
    <button type="button" (click)="centerLayers(['b'])">Слой B</button>
    <button type="button" (click)="centerLayers(['c'])">Слой C</button>
    <button type="button" (click)="centerLayers(['a', 'b'])">Слои A + B</button>
    <button type="button" (click)="centerLayers(['b', 'c'])">Слои B + C</button>
  </div>

  <mff-map-host class="map-canvas" [config]="mapConfig" (ready)="onReady($event)"></mff-map-host>
</section>
```

- [ ] **Step 3: Create the SCSS file**

Create `projects/demo/src/app/center-on-layers/center-on-layers.component.scss`:

```scss
.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
```

- [ ] **Step 4: Add the route**

In `projects/demo/src/app/app.routes.ts`, add the following route entry at the end of the `routes` array (before the closing `];`):

```typescript
  {
    path: 'center-on-layers',
    data: {
      title: 'Центрирование по слоям',
      component: 'CenterOnLayersComponent',
      description: 'Центрирование карты на всех или выбранных слоях.',
    },
    loadComponent: () =>
      import('./center-on-layers/center-on-layers.component').then(
        (m) => m.CenterOnLayersComponent,
      ),
  },
```

- [ ] **Step 5: Verify the demo works**

Run: `npx ng serve demo --open`
Navigate to `/center-on-layers`. Verify:
- 9 points visible in 3 colors (blue, green, red)
- Each button zooms/pans to the correct subset
- "Все слои" shows all 9 points

- [ ] **Step 6: Commit**

```bash
git add projects/demo/src/app/center-on-layers/ projects/demo/src/app/app.routes.ts
git commit -m "demo: add center-on-layers demo"
```
