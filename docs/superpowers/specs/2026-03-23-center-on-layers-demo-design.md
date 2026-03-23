# Center On Layers Demo

Демо для проверки `centerOnAllLayers` и `centerOnLayers` на `MapContext`.

## Компонент

Новый компонент `center-on-layers/` в демо-приложении с роутом `center-on-layers`.

## Идентификаторы слоёв

Константы, используемые как в schema descriptors, так и в вызовах `centerOnLayers`:

```typescript
const LAYER_ID = {
  A: 'a',
  B: 'b',
  C: 'c',
} as const;
```

## Данные

3 слоя точек, географически разнесённых по Минску для наглядности.

| Слой | Цвет | `getByIds()` | Район |
|------|------|-------------|-------|
| A | `#1976d2` (синий) | `['minsk-arena', 'minsk-lake', 'minsk-island']` | Запад |
| B | `#2e7d32` (зелёный) | `['minsk-library', 'minsk-botanical', 'minsk-parkstone']` | Восток |
| C | `#c62828` (красный) | `['minsk-tractors', 'minsk-zoo', 'minsk-chizhovka']` | Юг |

Точки берутся из `MapPointGenerator.getByIds()`.

## Инициализация

В `onReady(ctx: MapContext)`:
1. Сохранить `ctx` в поле компонента
2. Вызвать `setModels()` на каждом из 3 слоёв
3. Вызвать `ctx.centerOnAllLayers()` для начального отображения

## UI

Паттерн: `section.map-container` с header, кнопками и картой (как в `simple-map-two-static-layers`).

Кнопки над картой (в `div.button-group`):

| Кнопка | Вызов |
|--------|-------|
| Все слои | `ctx.centerOnAllLayers()` |
| Слой A | `ctx.centerOnLayers(['a'])` |
| Слой B | `ctx.centerOnLayers(['b'])` |
| Слой C | `ctx.centerOnLayers(['c'])` |
| Слои A + B | `ctx.centerOnLayers(['a', 'b'])` |
| Слои B + C | `ctx.centerOnLayers(['b', 'c'])` |

SCSS: минимальный — `.button-group` с `display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;`.

## Роутинг

Добавить роут в `app.routes.ts`:

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

## Затрагиваемые файлы

| Файл | Действие |
|------|----------|
| `projects/demo/src/app/center-on-layers/center-on-layers.component.ts` | Создать |
| `projects/demo/src/app/center-on-layers/center-on-layers.component.html` | Создать |
| `projects/demo/src/app/center-on-layers/center-on-layers.component.scss` | Создать |
| `projects/demo/src/app/app.routes.ts` | Добавить роут |
