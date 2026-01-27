# AurOpenlayers — декларативная обёртка над OpenLayers

AurOpenlayers — это фреймворк-обёртка над OpenLayers, который позволяет описывать карту и фичи декларативно, а не вручную связывать модели, слои, геометрию и события. Он снимает боль «императивной каши» при работе с OL: вместо того чтобы держать логику геометрии, стилей, интеракций и бизнес-моделей в разных местах, вы описываете всё рядом, в одном `MapSchema`.【F:projects/contract.md†L1-L18】

## Какую боль решает

При прямом использовании OpenLayers чаще всего приходится:
- вручную создавать слои/фичи, следить за их жизненным циклом и синхронизацией с моделями;
- держать отдельно правила стилизации для разных состояний/LOD;
- «клеить» события (hover/click/drag) на слои и самим контролировать хит‑тест и порядок обработки;
- изобретать инфраструктуру для батчинга обновлений и обеспечения производительности.

AurOpenlayers берёт это на себя: движок создаёт слои и фичи по описанию, синхронизирует модель и геометрию, применяет состояния и LOD‑стили, батчит обновления и поддерживает кластеризацию на уровне слоя.【F:projects/contract.md†L5-L18】

## Почему это лучше прямого использования OpenLayers

**1) Декларативность и «один источник правды».**
- Всё, что относится к фиче (id, геометрия, стили, интеракции) описано в одном месте — в `MapSchema` и типах `types.ts` (это единственный источник типов).

**2) Автоматическая привязка бизнес‑модели к feature.**
- Для фичи задаётся маппинг `model ↔ geometry`, и дальше синхронизация работает автоматически (включая обновления, инициированные картой).

**3) Гибкие стили и состояния.**
- Стили задаются как базовые значения и функции от модели/контекста, а состояния можно накладывать декларативно (например, `hover`, `select`, `drag`).

**4) Управляемые интеракции и события.**
- Определены единые правила hit‑test, propagation, а также порядок вызовов `select`/`click`, что снижает количество багов при сложных сценариях.

**5) Производительность и батчинг.**
- Обновления собираются в батчи с управляемой политикой сброса (`microtask`/`raf`), что удобно для drag/анимаций.

**6) Встроенные возможности, которые обычно пишутся вручную.**
- Кластеризация на уровне слоя, с переключением `enabledByDefault` и API для включения/выключения в рантайме.
- Единый popup‑хост с auto‑режимами (`click`/`hover`), дедупликацией и сортировкой элементов.
- Стандартизированные интеракции `hover/select/click/doubleClick/translate/modify` с декларативными хэндлерами и общими опциями (`cursor`, `state`, `propagation`).
- События изменения моделей с причинами (`mutate/translate/modify`) и батч‑уведомлениями для бизнес‑логики.

## Основные принципы

- **Декларативность** — карта и слои описываются схемой `MapSchema`, а не ручным созданием объектов.
- **Связь бизнес‑модели и feature** — в одном описании задаются id, геометрия и обновление модели.
- **Стилизация в одном месте** — базовый стиль и правила рендера сосредоточены рядом с описанием слоя.
- **Контракт поведения** — правила hit‑test, hover/select/click, drag/modify и кластеров заданы явно.
- **Слой как API** — слой предоставляет типизированный `VectorLayerApi`: `setModels`, `mutate`, `invalidate`, синхронизацию фич и (опционально) управление кластеризацией.

## Get started

### 1) Создать простую статическую карту

Ниже минимальный пример из demo: один слой точек, базовый стиль и установка моделей через `MapContext`.

```ts
import { Component } from '@angular/core';
import type Geometry from 'ol/geom/Geometry';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import {
  MapContext,
  VectorLayerDescriptor,
} from '../../../../lib/src/lib/map-framework';
import { MapHostComponent, MapHostConfig } from '../shared/map-host/map-host.component';
import {
  applyGeometryToMapPoint,
  mapPointToGeometry,
  MapPoint,
  MapPointGenerator,
} from '../shared/map-point';

const POINTS = new MapPointGenerator().getByCount(3);

type PointStyleOptions = {
  color: string;
  radius: number;
  label: string;
};

@Component({
  selector: 'app-simple-map',
  standalone: true,
  imports: [MapHostComponent],
  templateUrl: './simple-map.component.html',
  styleUrl: './simple-map.component.scss',
})
export class SimpleMapComponent {
  readonly mapConfig: MapHostConfig<
    readonly VectorLayerDescriptor<MapPoint, Geometry, PointStyleOptions>[]
  > = {
    schema: {
      layers: [
        {
          id: 'points',
          feature: {
            id: (model: MapPoint) => model.id,
            geometry: {
              fromModel: mapPointToGeometry,
              applyGeometryToModel: applyGeometryToMapPoint,
            },
            style: {
              base: (model: MapPoint) => ({
                color: '#1976d2',
                radius: 6,
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

  onReady(ctx: MapContext): void {
    ctx.layers['points']?.setModels(POINTS);
  }
}
```

Источник: demo `simple-map` — пример декларативного слоя и стилей.

### 2) Рекомендуемая архитектура: обёртка map-host

Чтобы локализовать работу с OpenLayers и иметь единую точку входа для карты, стоит вынести в приложении обёртку наподобие `shared/map-host`. Такой компонент:
- создаёт `Map` и `LayerManager`;
- инициализирует `MapContext` и контроллеры;
- берёт на себя размер и lifecycle карты.

Пример из demo (`projects/demo/src/app/shared/map-host/map-host.component.ts`) можно использовать как шаблон при создании своего `shared/map-host` в проекте.

## Полезные ссылки

- Demo (пример использования): `projects/demo` и маршруты в `projects/demo/src/app`.
- Типы API: `projects/lib/src/lib/map-framework/public/types.ts`.
- Контракт поведения: `projects/contract.md`.

## Дополнительно

- Полное описание контрактов поведения (hit-test, hover/select/click, drag/modify, кластеризация, батчинг) — в `contract.md`.
- `types.ts` остаётся единственным источником типов — договорённость проекта.


ВЕРСИИ
0.0.2 - angular 19, openlayers 6.5.0
