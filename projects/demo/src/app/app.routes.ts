import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'simple-map',
  },
  {
    path: 'simple-map',
    loadComponent: () =>
      import('./simple-map/simple-map.component').then((m) => m.SimpleMapComponent),
  },
  {
    path: 'map-point-mutate',
    loadComponent: () =>
      import('./map-point-mutate/map-point-mutate.component').then(
        (m) => m.MapPointMutateComponent,
      ),
  },
  {
    path: 'map-point-move',
    loadComponent: () =>
      import('./map-point-move/map-point-move.component').then(
        (m) => m.MapPointMoveComponent,
      ),
  },
  {
    path: 'map-select-interaction',
    loadComponent: () =>
      import('./map-select-interaction/map-select-interaction.component').then(
        (m) => m.MapSelectInteractionComponent,
      ),
  },
  {
    path: 'simple-map-two-static-layers',
    loadComponent: () =>
      import('./simple-map-two-static-layers/simple-map-two-static-layers.component').then((m) => m.SimpleMapTwoStaticLayersComponent),
  },
  {
    path: 'map-five-points-cluster',
    loadComponent: () =>
      import('./map-five-points-cluster/map-five-points-cluster.component').then(
        (m) => m.MapFivePointsClusterComponent,
      ),
  },
  {
    path: 'map-line-drag-points',
    loadComponent: () =>
      import('./map-line-drag-points/map-line-drag-points.component').then(
        (m) => m.MapLineDragPointsComponent,
      ),
  },
  {
    path: 'map-route-iterations',
    loadComponent: () =>
      import('./map-route-iterations/map-route-iterations.component').then(
        (m) => m.MapRouteIterationsComponent,
      ),
  },
  {
    path: 'static-map-point-popup',
    loadComponent: () =>
      import('./static-map-point-popup/static-map-point-popup.component').then((m) => m.StaticMapPointPopupComponent),
  },
  {
    path: 'map-point-change-style',
    loadComponent: () =>
      import('./map-point-change-style/map-point-change-style.component').then(
        (m) => m.MapPointChangeStyleComponent,
      ),
  },
  {
    path: 'map-point-zoom-labels',
    loadComponent: () =>
      import('./map-point-zoom-labels/map-point-zoom-labels.component').then(
        (m) => m.MapPointZoomLabelsComponent,
      ),
  },
];
