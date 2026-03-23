# Demo Navigation Redesign

## Goal

Replace the fixed navigation bar shown on every demo page with:
1. A dedicated **index page** displaying all demos as a card grid
2. A shared **demo header component** on each demo page with back button, metadata, and interaction instructions

## Current State

- `AppComponent` renders a `<nav>` with 18 `routerLink` anchors on every page
- `AppComponent` also renders a `<header>` with "Демо карт" title
- Each demo component has its own `<header class="map-header">` with `<h2>` title and `<p>` description
- Root route (`/`) redirects to `simple-map`
- 12 of 18 demos have sidebar controls (forms, panels, event logs); 6 are map-only

## Design

### 1. New `DemoIndexComponent`

**File:** `projects/demo/src/app/demo-index/demo-index.component.ts` (+ `.html`, `.scss`)

**Route:** `path: ''` (replaces the current redirect to `simple-map`)

**Behavior:**
- Injects `Router`, reads `router.config` to get all demo routes
- Filters routes that have `data` with `title` property (skips the index route itself)
- Renders a responsive CSS grid of cards (3 columns on desktop, 2 on tablet, 1 on mobile)

**Card content:**
- Component name (small, muted, uppercase) — from `route.data.component`
- Demo title (bold) — from `route.data.title`
- Short description (small, muted) — from `route.data.description`
- Entire card is a `routerLink` to the demo path

**Header above the grid:**
- `<h1>Демо карт</h1>`
- `<p>Примеры использования библиотеки в отдельных компонентах.</p>`

### 2. Simplified `AppComponent`

**Changes to `app.component.html`:**
Remove `<header class="app__header">` and `<nav class="app__nav">`. Keep only:

```html
<main class="app">
  <router-outlet/>
</main>
```

**Changes to `app.component.scss`:**
Remove `.app__header`, `.app__nav` styles. Keep `.app` container with padding and background.

**Changes to `app.component.ts`:**
Remove `RouterLink`, `RouterLinkActive` from imports. Keep only `RouterOutlet`.

### 3. New `DemoHeaderComponent`

**File:** `projects/demo/src/app/shared/demo-header/demo-header.component.ts` (+ `.html`, `.scss`)

**Inputs:**
- `title: string` — demo title (e.g., "Маршрут с перетаскиванием")
- `component: string` — Angular component name (e.g., "MapRouteDragComponent")
- `description: string` — what the demo demonstrates
- `features: string[]` — library features used (e.g., `['translate', 'OSRM routing', 'arrows']`)
- `interactions: string[]` — how to interact (e.g., `['Клик по карте для добавления точек', 'Перетаскивание промежуточных точек']`)

**Template structure:**
```html
<header class="demo-header">
  <div class="demo-header__top">
    <a routerLink="/" class="demo-header__back">← К списку</a>
    <div class="demo-header__title-block">
      <h2 class="demo-header__title">{{ title }}</h2>
      <span class="demo-header__component">{{ component }}</span>
    </div>
  </div>

  <p class="demo-header__description">{{ description }}</p>

  <div class="demo-header__meta">
    <div class="demo-header__features">
      <span class="demo-header__label">Фичи:</span>
      <span class="demo-header__tag" *ngFor="let f of features">{{ f }}</span>
    </div>
    <div class="demo-header__interactions">
      <span class="demo-header__label">Взаимодействие:</span>
      <span>{{ interactions.join(', ') }}</span>
    </div>
  </div>
</header>
```

**Styling:**
- Background block with rounded corners matching existing card style
- Back button styled as a pill/link
- Component name in small muted uppercase
- Features rendered as inline tags/badges
- Consistent with existing `styles.scss` design tokens (colors, border-radius, shadows)

### 4. Route Data in `app.routes.ts`

Each route gets a `data` object with metadata for the index page:

```typescript
{
  path: 'simple-map',
  data: {
    title: 'Статические точки',
    component: 'SimpleMapComponent',
    description: 'Слой с фиксированными точками и их названиями.'
  },
  loadComponent: () => import('./simple-map/simple-map.component').then(m => m.SimpleMapComponent),
}
```

**Route data for all 18 demos:**

| Path | Title | Component |
|------|-------|-----------|
| simple-map | Статические точки | SimpleMapComponent |
| simple-map-two-static-layers | Два слоя: точки и линия | SimpleMapTwoStaticLayersComponent |
| map-point-move | Перетаскивание точки | MapPointMoveComponent |
| map-point-change-style | Смена стиля точек | MapPointChangeStyleComponent |
| map-point-zoom-labels | Подписи точек на разных зумах | MapPointZoomLabelsComponent |
| map-translate-threshold-events | Сравнение translate.startThresholdPx | MapTranslateThresholdEventsComponent |
| map-select-interaction | Выбор точки на карте | MapSelectInteractionComponent |
| map-click-interaction | Клик по карте | MapClickInteractionComponent |
| static-map-point-popup | Попап точки при наведении | StaticMapPointPopupComponent |
| map-five-points-cluster | Кластеризация точек | MapFivePointsClusterComponent |
| map-line-drag-points | Линия по точкам с перетаскиванием | MapLineDragPointsComponent |
| map-polygons-labels | Полигоны с подписями | MapPolygonsLabelsComponent |
| map-polygons-modify | Редактирование полигонов | MapPolygonsModifyComponent |
| map-point-mutate | Редактирование данных точек | MapPointMutateComponent |
| map-route-iterations | Маршрут с изменением порядка | MapRouteIterationsComponent |
| map-route-add-point | Маршрут с добавлением точки | MapRouteAddPointComponent |
| map-route-edit-point | Маршрут: редактирование одной точки | MapRouteEditPointComponent |
| map-route-drag | Маршрут с промежуточными точками | MapRouteDragComponent |

### 5. Changes to Each Demo Component (x18)

For each of the 18 demo components:

**Template changes:**
- Remove the existing `<header class="map-header">` block (h2 + p)
- Add `<app-demo-header>` at the top of the template with filled-in metadata
- Features and interactions are specific to each demo (to be filled during implementation based on what the demo showcases)

**TypeScript changes:**
- Add `DemoHeaderComponent` to `imports` array

**No other changes** — map layout, controls, styling remain as-is.

### 6. File Changes Summary

**New files (4):**
- `demo-index/demo-index.component.ts`
- `demo-index/demo-index.component.html`
- `demo-index/demo-index.component.scss`
- `shared/demo-header/demo-header.component.ts` (inline template+styles or separate files)

**Modified files (21):**
- `app.component.ts` — remove RouterLink, RouterLinkActive imports
- `app.component.html` — remove header and nav
- `app.component.scss` — remove header and nav styles
- `app.routes.ts` — add index route, add `data` to all 18 routes
- 18 demo component `.html` files — replace header with `<app-demo-header>`
- 18 demo component `.ts` files — add DemoHeaderComponent to imports

**No deleted files.**

### 7. Styling Approach

- Reuse existing design tokens from `styles.scss` (colors, border-radius, shadows, font)
- Index page card grid: CSS grid with `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`
- Demo header: light background block with `border-radius: 12px`, subtle shadow, matching existing `.map-container` aesthetic
- Back button: pill-shaped, similar to existing nav link style
- Feature tags: small inline badges with light background
- Responsive: cards collapse to fewer columns on smaller screens
