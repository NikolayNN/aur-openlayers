# Route Drag Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive demo where the user places waypoints, builds a route via OSRM, and adjusts the route by dragging the trajectory line.

**Architecture:** Single Angular standalone component with three vector layers (route line, primary points, intermediate points). OSRM integration via fetch. Modify interaction on the route line to create intermediate waypoints. Translate interaction on intermediate points for repositioning.

**Tech Stack:** Angular 19 standalone, OpenLayers 6.5, aur-openlayers library (no modifications), OSRM demo API.

**Spec:** `docs/superpowers/specs/2026-03-23-route-drag-demo-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| Create: `projects/demo/src/app/map-route-drag/map-route-drag.component.ts` | Component: schema, interactions, state, OSRM calls |
| Create: `projects/demo/src/app/map-route-drag/map-route-drag.component.html` | Template: map host, control buttons, status |
| Create: `projects/demo/src/app/map-route-drag/map-route-drag.component.scss` | Styles: layout, buttons, status indicators |
| Modify: `projects/demo/src/app/app.routes.ts` | Add lazy route for `map-route-drag` |

---

### Task 1: Create component scaffold with models and empty schema

**Files:**
- Create: `projects/demo/src/app/map-route-drag/map-route-drag.component.ts`
- Create: `projects/demo/src/app/map-route-drag/map-route-drag.component.html`
- Create: `projects/demo/src/app/map-route-drag/map-route-drag.component.scss`

- [ ] **Step 1: Create the HTML template**

```html
<section class="map-container">
  <header class="map-header">
    <h2>Маршрут с перетаскиванием</h2>
    <p>
      Расставьте точки на карте кликами, постройте маршрут, затем перетаскивайте
      линию маршрута для добавления промежуточных точек. Двойной клик удаляет точку.
    </p>
  </header>

  <div class="map-layout">
    <aside class="map-info">
      <div class="map-info__header">
        <h3>Управление</h3>
        <span class="map-info__status" [class.is-active]="loading">
          {{ loading ? 'загрузка…' : phase === 'routed' ? 'маршрут' : 'расстановка' }}
        </span>
      </div>

      <p class="map-info__hint" *ngIf="phase === 'placing'">
        Кликните по карте, чтобы добавить точку маршрута. Двойной клик по точке — удалить.
      </p>
      <p class="map-info__hint" *ngIf="phase === 'routed'">
        Перетащите линию маршрута для добавления промежуточной точки.
        Двойной клик по любой точке — удалить.
      </p>

      <div class="map-info__actions">
        <button
          type="button"
          class="btn btn--primary"
          (click)="buildRoute()"
          [disabled]="primaryPoints.length < 2 || loading"
          *ngIf="phase === 'placing'"
        >
          Построить маршрут
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          (click)="resetRoute()"
          *ngIf="phase === 'routed'"
        >
          Сбросить маршрут
        </button>
      </div>

      <div class="map-info__points">
        <h4>Точки ({{ allWaypointsSorted.length }})</h4>
        <ol class="point-list">
          <li *ngFor="let wp of allWaypointsSorted" [class.is-intermediate]="wp.type === 'intermediate'">
            <span class="point-marker" [class.point-marker--intermediate]="wp.type === 'intermediate'">
              {{ wp.type === 'primary' ? wp.orderIndex : '·' }}
            </span>
            <span class="point-coords">
              {{ wp.lat | number:'1.4-4' }}, {{ wp.lng | number:'1.4-4' }}
            </span>
          </li>
        </ol>
      </div>
    </aside>

    <mff-map-host class="map-canvas" [config]="mapConfig" (ready)="onReady($event)"></mff-map-host>
  </div>
</section>
```

- [ ] **Step 2: Create the SCSS file**

Copy the layout pattern from `map-polygons-modify.component.scss` with additions for buttons and point list:

```scss
.map-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.map-info {
  background: #ffffff;
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  display: grid;
  gap: 0.85rem;
}

.map-info__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.map-info__header h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #111827;
}

.map-info__status {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  color: #475569;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.map-info__status.is-active {
  background: rgba(16, 185, 129, 0.2);
  color: #0f766e;
}

.map-info__hint {
  margin: 0;
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.45;
}

.map-info__actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  background: #ffffff;
  color: #1f2937;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:hover:not(:disabled) {
  background: #f8fafc;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.btn--primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn--ghost {
  background: transparent;
  border-color: rgba(15, 23, 42, 0.15);
  color: #64748b;
}

.btn--ghost:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.04);
}

.map-info__points h4 {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
  color: #0f172a;
}

.point-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: grid;
  gap: 0.3rem;
  max-height: 300px;
  overflow-y: auto;
}

.point-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #475569;
  padding: 0.25rem 0;
}

.point-list li.is-intermediate {
  color: #10b981;
}

.point-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.point-marker--intermediate {
  background: #10b981;
  width: 1rem;
  height: 1rem;
  margin: 0 0.25rem;
}

.point-coords {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
}

.map-canvas {
  min-height: 520px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.12);
}

@media (max-width: 960px) {
  .map-layout {
    grid-template-columns: 1fr;
  }

  .map-canvas {
    min-height: 420px;
  }
}
```

- [ ] **Step 3: Create the component TypeScript file with models, empty schema, and state**

```typescript
import { Component, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import type Geometry from 'ol/geom/Geometry';
import { LineString, Point } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import Polyline from 'ol/format/Polyline';
import {
  MapContext,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
import { MapHostComponent, MapHostConfig } from '../shared/map-host/map-host.component';

// --- Models ---

interface RouteWaypoint {
  id: string;
  lat: number;
  lng: number;
  orderIndex: number;
  type: 'primary' | 'intermediate';
}

interface RouteLine {
  id: string;
  coordinates: [number, number][]; // [lng, lat]
}

// --- Constants ---

const LAYER_ID = {
  ROUTE_LINE: 'route-line',
  PRIMARY_POINTS: 'primary-points',
  INTERMEDIATE_POINTS: 'intermediate-points',
} as const;

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

// --- Style types ---

type LineStyleOpts = {
  color: string;
  width: number;
  dash: number[];
};

type PrimaryPointStyleOpts = {
  color: string;
  radius: number;
  label: string;
  strokeColor: string;
};

type IntermediatePointStyleOpts = {
  color: string;
  radius: number;
  strokeColor: string;
};

// --- Helpers ---

let waypointCounter = 0;

function nextWaypointId(type: 'primary' | 'intermediate'): string {
  return `${type}-${++waypointCounter}`;
}

@Component({
  selector: 'app-map-route-drag',
  standalone: true,
  imports: [CommonModule, MapHostComponent],
  templateUrl: './map-route-drag.component.html',
  styleUrl: './map-route-drag.component.scss',
})
export class MapRouteDragComponent implements OnDestroy {
  phase: 'placing' | 'routed' = 'placing';
  primaryPoints: RouteWaypoint[] = [];
  intermediatePoints: RouteWaypoint[] = [];
  routeCoordinates: [number, number][] = [];
  loading = false;

  private abortController: AbortController | null = null;
  private primaryLayerApi?: VectorLayerApi<RouteWaypoint, Geometry>;
  private intermediateLayerApi?: VectorLayerApi<RouteWaypoint, Geometry>;
  private lineLayerApi?: VectorLayerApi<RouteLine, LineString>;
  private unsubscribes: (() => void)[] = [];
  private polylineFormat = new Polyline();

  readonly mapConfig: MapHostConfig<readonly VectorLayerDescriptor<any, Geometry, any>[]>;

  get allWaypointsSorted(): RouteWaypoint[] {
    return [...this.primaryPoints, ...this.intermediatePoints]
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  constructor(private readonly zone: NgZone) {
    this.mapConfig = this.buildMapConfig();
  }

  // --- Public methods (called from template) ---

  onReady(ctx: MapContext): void {
    this.primaryLayerApi = ctx.layers[LAYER_ID.PRIMARY_POINTS] as VectorLayerApi<RouteWaypoint, Geometry> | undefined;
    this.intermediateLayerApi = ctx.layers[LAYER_ID.INTERMEDIATE_POINTS] as VectorLayerApi<RouteWaypoint, Geometry> | undefined;
    this.lineLayerApi = ctx.layers[LAYER_ID.ROUTE_LINE] as VectorLayerApi<RouteLine, LineString> | undefined;

    // Subscribe to model changes for intermediate points (translate)
    const unsub = this.intermediateLayerApi?.onModelsChanged?.((changes) => {
      this.zone.run(() => {
        changes.forEach(({ next }) => {
          const idx = this.intermediatePoints.findIndex((p) => p.id === next.id);
          if (idx !== -1) {
            this.intermediatePoints = [
              ...this.intermediatePoints.slice(0, idx),
              next,
              ...this.intermediatePoints.slice(idx + 1),
            ];
          }
        });
      });
    });
    if (unsub) this.unsubscribes.push(unsub);
  }

  buildRoute(): void {
    this.phase = 'routed';
    this.fetchRoute();
  }

  resetRoute(): void {
    this.phase = 'placing';
    this.intermediatePoints = [];
    this.routeCoordinates = [];
    this.intermediateLayerApi?.clear();
    this.lineLayerApi?.clear();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((fn) => fn());
    this.abortController?.abort();
  }

  // --- OSRM ---

  private async fetchRoute(): Promise<void> {
    const waypoints = this.allWaypointsSorted;
    if (waypoints.length < 2) return;

    this.abortController?.abort();
    this.abortController = new AbortController();

    const coords = waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(';');
    const url = `${OSRM_BASE}/${coords}?overview=full&geometries=polyline`;

    this.zone.run(() => (this.loading = true));

    try {
      const res = await fetch(url, { signal: this.abortController.signal });
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes?.[0]) {
        console.error('OSRM error:', data);
        return;
      }

      const encodedPolyline = data.routes[0].geometry;
      const lineGeom = this.polylineFormat.readGeometry(encodedPolyline, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      }) as LineString;
      const coords3857 = lineGeom.getCoordinates();
      const coordsLonLat = coords3857.map((c) => toLonLat(c) as [number, number]);

      this.zone.run(() => {
        this.routeCoordinates = coordsLonLat;
        this.loading = false;
      });

      this.lineLayerApi?.setModels([{
        id: 'route',
        coordinates: coordsLonLat,
      }]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Fetch error:', err);
      this.zone.run(() => (this.loading = false));
    }
  }

  // --- Vertex detection after modify ---

  private findInsertedVertex(newCoords: [number, number][]): { coord: [number, number]; segmentIndex: number } | null {
    const oldCoords = this.routeCoordinates;
    if (newCoords.length <= oldCoords.length) return null;

    // Find the first coordinate that doesn't match the old set
    // The modify interaction inserts exactly one vertex
    for (let i = 0; i < newCoords.length; i++) {
      const oldIdx = i >= oldCoords.length ? -1 : i;
      if (oldIdx === -1 || newCoords[i][0] !== oldCoords[i][0] || newCoords[i][1] !== oldCoords[i][1]) {
        // This is the inserted vertex. The segment index is i (between old[i-1] and old[i])
        return { coord: newCoords[i], segmentIndex: i };
      }
    }
    return null;
  }

  private computeOrderIndexForSegment(segmentIndex: number): number {
    // Find which two waypoints this segment falls between
    // Map the segment index to approximate position along the route
    const waypoints = this.allWaypointsSorted;
    if (waypoints.length < 2) return 0.5;

    const totalRoutePoints = this.routeCoordinates.length;
    if (totalRoutePoints === 0) return waypoints[0].orderIndex + 0.5;

    // Approximate: segment position relative to total route length
    const fraction = segmentIndex / totalRoutePoints;
    const approxWaypointIdx = fraction * (waypoints.length - 1);
    const lowerIdx = Math.floor(approxWaypointIdx);
    const upperIdx = Math.min(lowerIdx + 1, waypoints.length - 1);

    const lower = waypoints[lowerIdx].orderIndex;
    const upper = waypoints[upperIdx].orderIndex;
    return (lower + upper) / 2;
  }

  // --- Point management ---

  private addPrimaryPoint(lon: number, lat: number): void {
    const nextIndex = this.primaryPoints.length + 1;
    const wp: RouteWaypoint = {
      id: nextWaypointId('primary'),
      lat,
      lng: lon,
      orderIndex: nextIndex,
      type: 'primary',
    };
    this.primaryPoints = [...this.primaryPoints, wp];
    this.primaryLayerApi?.addModel(wp);
  }

  private removePrimaryPoint(id: string): void {
    this.primaryPoints = this.primaryPoints.filter((p) => p.id !== id);
    this.primaryLayerApi?.removeModelsById([id]);

    // Renumber remaining primary points
    this.primaryPoints = this.primaryPoints.map((p, i) => ({ ...p, orderIndex: i + 1 }));
    this.primaryLayerApi?.setModels(this.primaryPoints);
  }

  private addIntermediatePoint(lon: number, lat: number, orderIndex: number): void {
    const wp: RouteWaypoint = {
      id: nextWaypointId('intermediate'),
      lat,
      lng: lon,
      orderIndex,
      type: 'intermediate',
    };
    this.intermediatePoints = [...this.intermediatePoints, wp];
    this.intermediateLayerApi?.addModel(wp);
  }

  private removeIntermediatePoint(id: string): void {
    this.intermediatePoints = this.intermediatePoints.filter((p) => p.id !== id);
    this.intermediateLayerApi?.removeModelsById([id]);
  }

  private removeAnyPoint(id: string): void {
    const primary = this.primaryPoints.find((p) => p.id === id);
    if (primary) {
      this.removePrimaryPoint(id);
    } else {
      this.removeIntermediatePoint(id);
    }

    const totalRemaining = this.primaryPoints.length + this.intermediatePoints.length;
    if (this.phase === 'routed') {
      if (totalRemaining >= 2) {
        this.fetchRoute();
      } else {
        this.resetRoute();
      }
    }
  }

  // --- Schema builder ---

  private buildMapConfig(): MapHostConfig<readonly VectorLayerDescriptor<any, Geometry, any>[]> {
    return {
      schema: {
        layers: [
          // Layer 1: Route line
          {
            id: LAYER_ID.ROUTE_LINE,
            zIndex: 1,
            feature: {
              id: (model: RouteLine) => model.id,
              geometry: {
                fromModel: (model: RouteLine) =>
                  new LineString(model.coordinates.map(([lng, lat]) => fromLonLat([lng, lat]))),
                applyGeometryToModel: (prev: RouteLine) => prev, // no-op: geometry managed via OSRM
              },
              style: {
                base: () => ({
                  color: '#2563eb',
                  width: 4,
                  dash: [] as number[],
                }),
                states: {
                  MODIFY: () => ({
                    width: 5,
                    dash: [12, 8],
                  }),
                },
                render: (opts: LineStyleOpts) =>
                  new Style({
                    stroke: new Stroke({
                      color: opts.color,
                      width: opts.width,
                      ...(opts.dash.length ? { lineDash: opts.dash } : {}),
                    }),
                  }),
              },
              interactions: {
                modify: {
                  enabled: () => this.phase === 'routed',
                  cursor: 'grab',
                  hitTolerance: 10,
                  state: 'MODIFY',
                  vertexStyle: new Style({
                    image: new CircleStyle({
                      radius: 6,
                      fill: new Fill({ color: '#ffffff' }),
                      stroke: new Stroke({ color: '#2563eb', width: 2 }),
                    }),
                  }),
                  onEnd: ({ item }) => {
                    const geom = item.feature.getGeometry() as LineString;
                    const newCoords3857 = geom.getCoordinates();
                    const newCoordsLonLat = newCoords3857.map((c) => toLonLat(c) as [number, number]);

                    const inserted = this.findInsertedVertex(newCoordsLonLat);
                    if (inserted) {
                      const orderIndex = this.computeOrderIndexForSegment(inserted.segmentIndex);
                      this.zone.run(() => {
                        this.addIntermediatePoint(inserted.coord[0], inserted.coord[1], orderIndex);
                      });
                      this.fetchRoute();
                    }
                    return true;
                  },
                },
              },
            },
          },

          // Layer 2: Intermediate points
          {
            id: LAYER_ID.INTERMEDIATE_POINTS,
            zIndex: 2,
            feature: {
              id: (model: RouteWaypoint) => model.id,
              geometry: {
                fromModel: (model: RouteWaypoint) =>
                  new Point(fromLonLat([model.lng, model.lat])),
                applyGeometryToModel: (prev: RouteWaypoint, geom: Geometry): RouteWaypoint => {
                  if (!(geom instanceof Point)) return prev;
                  const [lng, lat] = toLonLat(geom.getCoordinates());
                  return { ...prev, lng, lat };
                },
              },
              style: {
                base: () => ({
                  color: '#10b981',
                  radius: 8,
                  strokeColor: '#ffffff',
                }),
                states: {
                  DRAG: () => ({
                    color: '#f97316',
                    radius: 9,
                  }),
                  HOVER: () => ({
                    strokeColor: '#f97316',
                  }),
                },
                render: (opts: IntermediatePointStyleOpts) =>
                  new Style({
                    image: new CircleStyle({
                      radius: opts.radius,
                      fill: new Fill({ color: opts.color }),
                      stroke: new Stroke({ color: opts.strokeColor, width: 2 }),
                    }),
                  }),
              },
              interactions: {
                hover: {
                  cursor: 'pointer',
                  state: 'HOVER',
                },
                doubleClick: {
                  onDoubleClick: ({ items }) => {
                    const model = items[0]?.model;
                    if (model) {
                      this.zone.run(() => this.removeAnyPoint(model.id));
                    }
                    return true;
                  },
                },
                translate: {
                  enabled: () => this.phase === 'routed',
                  cursor: 'grab',
                  hitTolerance: 6,
                  state: 'DRAG',
                  onEnd: () => {
                    this.fetchRoute();
                    return true;
                  },
                },
              },
            },
          },

          // Layer 3: Primary points
          {
            id: LAYER_ID.PRIMARY_POINTS,
            zIndex: 3,
            feature: {
              id: (model: RouteWaypoint) => model.id,
              geometry: {
                fromModel: (model: RouteWaypoint) =>
                  new Point(fromLonLat([model.lng, model.lat])),
                applyGeometryToModel: (prev: RouteWaypoint) => prev,
              },
              style: {
                base: (model: RouteWaypoint) => ({
                  color: '#2563eb',
                  radius: 14,
                  label: String(model.orderIndex),
                  strokeColor: '#ffffff',
                }),
                states: {
                  HOVER: () => ({
                    strokeColor: '#f97316',
                  }),
                },
                render: (opts: PrimaryPointStyleOpts) => [
                  new Style({
                    image: new CircleStyle({
                      radius: opts.radius,
                      fill: new Fill({ color: opts.color }),
                      stroke: new Stroke({ color: opts.strokeColor, width: 2 }),
                    }),
                    text: new Text({
                      text: opts.label,
                      fill: new Fill({ color: '#ffffff' }),
                      stroke: new Stroke({ color: 'rgba(15, 23, 42, 0.45)', width: 2 }),
                      font: '700 12px "Inter", sans-serif',
                      textAlign: 'center',
                      textBaseline: 'middle',
                    }),
                  }),
                ],
              },
              interactions: {
                hover: {
                  cursor: 'pointer',
                  state: 'HOVER',
                },
                click: {
                  enabled: () => this.phase === 'placing',
                  onClick: ({ items, event }) => {
                    if (items.length === 0) {
                      // Click on empty space — add point
                      const [lng, lat] = toLonLat(event.coordinate) as [number, number];
                      this.zone.run(() => this.addPrimaryPoint(lng, lat));
                    }
                    return true;
                  },
                },
                doubleClick: {
                  onDoubleClick: ({ items }) => {
                    const model = items[0]?.model;
                    if (model) {
                      this.zone.run(() => this.removeAnyPoint(model.id));
                    }
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
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd projects/demo && npx ng build --configuration=development 2>&1 | head -30`
Expected: Build succeeds (or only warnings, no errors).

- [ ] **Step 5: Commit**

```bash
git add projects/demo/src/app/map-route-drag/
git commit -m "feat(demo): add route drag component scaffold with models and schema"
```

---

### Task 2: Register route and verify demo loads

**Files:**
- Modify: `projects/demo/src/app/app.routes.ts`

- [ ] **Step 1: Add lazy route**

Add after the last route entry in `app.routes.ts`:

```typescript
{
  path: 'map-route-drag',
  loadComponent: () =>
    import('./map-route-drag/map-route-drag.component').then(
      (m) => m.MapRouteDragComponent,
    ),
},
```

- [ ] **Step 2: Verify app compiles and route works**

Run: `cd projects/demo && npx ng serve --open`
Navigate to `http://localhost:4200/map-route-drag`
Expected: Map renders with the sidebar panel. Clicking on map adds numbered blue points. Double-clicking a point removes it.

- [ ] **Step 3: Commit**

```bash
git add projects/demo/src/app/app.routes.ts
git commit -m "feat(demo): register map-route-drag route"
```

---

### Task 3: Verify OSRM integration and route building

At this point the component already has `buildRoute()` and `fetchRoute()` implemented. This task verifies the end-to-end flow.

- [ ] **Step 1: Manual test — place 3+ points and click "Build Route"**

Run: `cd projects/demo && npx ng serve`
Navigate to `http://localhost:4200/map-route-drag`

Test steps:
1. Click 3 points on the map in Minsk area
2. Click "Построить маршрут"
3. Expected: blue route line appears on the map connecting the points via roads
4. Status changes to "маршрут"
5. Clicking on map no longer adds points

- [ ] **Step 2: Verify "Reset" button**

1. Click "Сбросить маршрут"
2. Expected: route line disappears, status returns to "расстановка"
3. Can click to add points again

- [ ] **Step 3: Commit if any fixes were needed**

```bash
git add -u
git commit -m "fix(demo): route-drag OSRM integration fixes"
```

---

### Task 4: Verify modify interaction (drag route line to add intermediate points)

The modify interaction is already defined in the schema. This task verifies the end-to-end flow of dragging the route line.

- [ ] **Step 1: Manual test — drag route line**

Run: `cd projects/demo && npx ng serve`
Navigate to `http://localhost:4200/map-route-drag`

Test steps:
1. Place 2 points, build route
2. Hover over the route line — cursor should change to `grab`
3. Drag the route line to a new position
4. Expected: green intermediate point appears, route recalculates through the new point
5. The intermediate point shows in the sidebar list with a green dot (no number)

- [ ] **Step 2: Verify intermediate point translate**

1. Drag the green intermediate point to a new position
2. Expected: route recalculates through the updated position

- [ ] **Step 3: Verify double-click deletion of intermediate point**

1. Double-click the green intermediate point
2. Expected: point disappears, route recalculates without it

- [ ] **Step 4: Verify double-click deletion of primary point**

1. Double-click a blue primary point
2. Expected: point disappears, remaining primary points renumber, route recalculates

- [ ] **Step 5: Debug and fix any issues found**

Common issues to check:
- `findInsertedVertex` may need adjustment if coordinate comparison uses floating point equality. Consider using a small epsilon or comparing projected coordinates instead of lon/lat.
- `computeOrderIndexForSegment` approximation may be inaccurate — verify the intermediate point is inserted in the correct position in the waypoint list.
- The modify interaction may conflict with double-click zoom. If so, disable the default `DoubleClickZoom` interaction on the OL map.

- [ ] **Step 6: Commit fixes**

```bash
git add -u
git commit -m "fix(demo): route-drag modify interaction and vertex detection fixes"
```

---

### Task 5: Final polish and edge cases

- [ ] **Step 1: Test edge case — delete all points during routed phase**

1. Build route with 2 points
2. Double-click to delete one point
3. Expected: route clears, returns to placing phase (only 1 point remains)

- [ ] **Step 2: Test edge case — multiple intermediate points**

1. Build route with 3 points
2. Drag route line in two different places to create 2 intermediate points
3. Expected: both green points visible, route passes through all 5 points in correct order

- [ ] **Step 3: Test rapid interactions**

1. Build route, then quickly drag line multiple times
2. Expected: AbortController cancels in-flight requests, no stale routes appear

- [ ] **Step 4: Verify sidebar point list order**

1. After adding intermediate points, check sidebar list
2. Expected: points listed in order (primary with numbers, intermediate with green dots, interleaved correctly by orderIndex)

- [ ] **Step 5: Commit any final fixes**

```bash
git add -u
git commit -m "fix(demo): route-drag edge cases and polish"
```

---

### Task 6: Final commit with all files

- [ ] **Step 1: Verify clean build**

Run: `npm run build:demo`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Final commit if needed**

```bash
git add -u
git commit -m "feat(demo): complete route-drag demo with OSRM routing and line dragging"
```
