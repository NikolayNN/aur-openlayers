# Multi-Layer Centering

Добавление возможности центрирования карты на фичах из нескольких (или всех) слоёв одновременно.

## Решения

- Методы размещаются на `MapContext` (не утилитные функции)
- Скрытые слои (`setVisible(false)`) пропускаются
- Для кластеризованных слоёв используются исходные фичи (base source), а не кластеры
- Extent-логика выносится в утилитную функцию для изолированного тестирования
- `collectLayersExtent` — внутренняя утилита, не экспортируется через public-api

## Публичный API

### Новые методы на `MapContext`

```typescript
export type MapContext = {
  // ... existing fields ...

  /** Центрирует карту на всех видимых слоях. No-op если нет фич. */
  centerOnAllLayers: (opts?: ViewFitOptions) => void;

  /** Центрирует карту на указанных слоях (скрытые пропускаются). No-op если нет фич. */
  centerOnLayers: (layerIds: ReadonlyArray<string>, opts?: ViewFitOptions) => void;
};
```

### Новый метод на `VectorLayerApi`

```typescript
export type VectorLayerApi<M, G extends Geometry> = {
  // ... existing ...

  /** Возвращает extent всех фич базового источника (без кластеризации). */
  getExtent: () => Extent | null;
};
```

`getExtent` добавляется как обязательное поле. Все реализации `VectorLayerApi` проходят через `VectorLayerBase`, внешних реализаций нет.

## Реализация

### `VectorLayerBase.getExtent()`

```typescript
getExtent(): Extent | null {
  const extent = this.source.getExtent();
  return isEmpty(extent) ? null : extent;
}
```

Используется `this.source` (а не `getCenterOnAllModelsSource()`), поэтому для кластеризованных слоёв возвращается extent исходных фич. Переопределение в `ClusteredVectorLayer` не нужно.

> **Заметка:** Это поведение намеренно отличается от `centerOnAllModels()` на кластеризованных слоях.
> `centerOnAllModels()` использует `getCenterOnAllModelsSource()`, который в `ClusteredVectorLayer` возвращает кластерный source (текущие кластеры зависят от зума).
> `getExtent()` всегда возвращает extent базовых фич — это нужно для корректного кросс-слойного центрирования, где extent должен отражать реальное расположение данных.

### Утилита `collectLayersExtent` в `fit-layer.utils.ts`

```typescript
export function collectLayersExtent(
  layers: Record<string, VectorLayerApi<any, any>>,
  layerIds?: ReadonlyArray<string>,
): Extent | null {
  const extent = createEmpty();
  const ids = layerIds ?? Object.keys(layers);

  for (const id of ids) {
    const layer = layers[id];
    if (!layer || !layer.isVisible()) continue;
    const layerExtent = layer.getExtent();
    if (layerExtent) {
      extend(extent, layerExtent);
    }
  }

  return isEmpty(extent) ? null : extent;
}
```

### Методы в `createMapContext`

```typescript
centerOnAllLayers: (opts?: ViewFitOptions) => {
  const extent = collectLayersExtent(layers);
  if (extent) map.getView().fit(extent, toOlFitOptions(opts));
},

centerOnLayers: (layerIds, opts?) => {
  const extent = collectLayersExtent(layers, layerIds);
  if (extent) map.getView().fit(extent, toOlFitOptions(opts));
},
```

> **Заметка:** Замыкание захватывает ссылку на объект `layers` — тот же мутабельный объект, что и `MapContext.layers`. Это консистентно с тем, как `batch` захватывает `scheduler`.

## Затрагиваемые файлы

| Файл | Изменение |
|------|-----------|
| `public/types.ts` | Добавить `getExtent` в `VectorLayerApi`, `centerOnAllLayers`/`centerOnLayers` в `MapContext` |
| `runtime/vector-layer-base.ts` | Реализация `getExtent()` |
| `runtime/fit-layer.utils.ts` | Утилита `collectLayersExtent` |
| `runtime/map-context.ts` | Реализация двух методов в фабрике `createMapContext` |

## Тестирование

1. **Unit-тест `collectLayersExtent`** — мок `VectorLayerApi` с `isVisible()` и `getExtent()`:
   - Агрегация extent из нескольких слоёв
   - Скрытые слои пропускаются
   - Несуществующие layerIds игнорируются
   - Пустой массив `layerIds` (`[]`) → `null` (не fallback на все слои)
   - Все слои без фич → `null`

2. **Unit-тест методов на `MapContext`** — через `createMapContext` с мок-слоями:
   - `centerOnAllLayers` вызывает `view.fit` с правильным extent
   - `centerOnLayers` с подмножеством слоёв
   - No-op когда extent пустой
   - Передача `ViewFitOptions` (padding, duration, maxZoom)

3. **Unit-тест `getExtent` на `VectorLayerBase`**:
   - Возвращает extent базового source
   - На кластеризованном слое возвращает extent исходных фич, а не кластеров
   - Пустой source → `null`
