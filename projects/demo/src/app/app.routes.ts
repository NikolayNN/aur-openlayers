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
];
