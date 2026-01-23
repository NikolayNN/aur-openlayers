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
];
