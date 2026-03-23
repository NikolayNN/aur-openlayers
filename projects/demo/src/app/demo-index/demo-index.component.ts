import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

interface DemoCard {
  path: string;
  title: string;
  component: string;
  description: string;
}

@Component({
  selector: 'app-demo-index',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './demo-index.component.html',
  styleUrl: './demo-index.component.scss',
})
export class DemoIndexComponent {
  private readonly router = inject(Router);

  readonly demos: DemoCard[] = this.router.config
    .filter((route): route is typeof route & { data: { title: string } } =>
      !!route.data && 'title' in route.data
    )
    .map(route => ({
      path: '/' + route.path,
      title: route.data!['title'] as string,
      component: route.data!['component'] as string,
      description: route.data!['description'] as string,
    }));
}
