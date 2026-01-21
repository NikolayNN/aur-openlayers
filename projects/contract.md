# Map Framework Contracts

## Цель

Декларативно описать слои/фичи/стили/взаимодействия, а фреймворк сам:
- создает Features и Layers по MapSchema
- синхронизирует Model ⇄ Feature.Geometry
- применяет состояния стиля (hover/select/drag/modify) + LOD (resolution/zoom)
- батчит обновления, чтобы не пересчитывать стиль/слой слишком часто
- (опционально) включает кластеризацию на уровне слоя

## ПРАВИЛО HIT-TEST ДЛЯ INTERACTIONS

Все interactions работают по одному принципу:
- hit-test делается ПОСЛОЙНО (top→down),
- обработчик interaction получает массивы models/features,
  НО ТОЛЬКО ДЛЯ ТЕКУЩЕГО СЛОЯ (1 слой = 1 featureDescriptor).

## PROPAGATION (ПРОКИДЫВАНИЕ СОБЫТИЯ НА СЛОИ НИЖЕ)

Любой обработчик interaction может "поглотить" событие, вернув `true`.
Дальнейшая обработка по слоям регулируется InteractionBase.propagation:

- "stop"      — дефолт: если handled=true, на слои ниже не идём.
- "continue"  — даже если handled=true, продолжаем по слоям.
- "auto"      — алиас на будущее (можно трактовать как "stop").

## Типы и интерфейсы

Ниже приведены все типы и интерфейсы напрямую из кода.

### FeatureStyleState

Состояния — строковые (каждый feature/проект может иметь свои).

```typescript
export type FeatureStyleState = string;
```

### MaybeFn

Значение или функция от аргументов.

```typescript
export type MaybeFn<T, A extends any[] = []> = T | ((...args: A) => T);
```

### Patch

Патч: частично или через updater(prev).

```typescript
export type Patch<T> = Partial<T> | ((prev: T) => Partial<T>);
```

### Enabled

Включатель: boolean или функция.

```typescript
export type Enabled = boolean | (() => boolean);
```

### StyleView

Параметры вида для LOD-стилей.

```typescript
export type StyleView = {
  /** OpenLayers resolution (map.getView().getResolution()) */
  resolution: number;
  /** zoom опционально, если вычислите в реализации */
  zoom?: number;
};
```

### FeatureState

Композиция состояний.

```typescript
export type FeatureState = FeatureStyleState | FeatureStyleState[];
```

### InteractionBase

Базовые поля для любой interaction.

```typescript
export type InteractionBase = {
  /**
   * Наличие секции + enabled => фреймворк подключит/отключит интеракцию на лету.
   * Если enabled не задан — считается включенной.
   */
  enabled?: Enabled;
  /** UX: курсор декларативно */
  cursor?: string | { enter?: string; leave?: string };
  /**
   * Какие состояния применить при активности interaction.
   * Разрешена композиция: ["HOVER", "SELECTED"].
   */
  state?: FeatureState;
  /**
   * Пропагация события "вниз" по слоям, если обработчик на этом слое
   * вернул handled=true (см. возвращаемые значения on*).
   *
   * - "stop"      — дефолт: если событие обработано, дальше по слоям не идём.
   * - "continue"  — даже если обработано, продолжаем обработку ниже.
   * - "auto"      — алиас на будущее (в реализации можно трактовать как "stop").
   */
  propagation?: "stop" | "continue" | "auto";
};
```

### InteractionHandlerResult

Общий контракт для обработчиков interactions:
- получаем массивы ТОЛЬКО текущего слоя;
- возвращаем `true` чтобы пометить событие как handled (consumed).

```typescript
export type InteractionHandlerResult = boolean | void;
```

### VectorLayerApi

API слоя (то, что нужно дергать из других descriptor’ов и бизнес-кода).

Ключевое:
- mutate(...) — ЕДИНСТВЕННЫЙ легкий контракт для авто model→feature.
- batch(...) — батчинг на уровне контекста.

```typescript
export type VectorLayerApi<M, G extends Geometry> = {
  /** заменить весь набор моделей */
  setModels: (models: readonly M[]) => void;
  /** попросить слой/стили пересчитаться */
  invalidate: () => void;
  /** применить изменения модели -> feature.geometry (когда модель меняется извне) */
  syncFeatureFromModel: (model: M) => void;
  /** найти модель по feature */
  getModelByFeature: (feature: Feature<G>) => M | undefined;
  /**
   * ЛЁГКИЙ КОНТРАКТ для авто model->feature:
   * - бизнес-код мутирует модель только здесь
   * - фреймворк после fn гарантированно сделает:
   *    syncFeatureFromModel(model) + (batched) invalidate()
   */
  mutate: (id: string | number, fn: (model: M) => void) => void;
  /** массовая мутация (опционально) */
  mutateMany?: (ids: Array<string | number>, fn: (model: M) => void) => void;
  /**
   * Кластеризация (доступна, если descriptor.clustering задан в schema)
   * Включение/выключение переключает source слоя (plain ↔ cluster).
   */
  setClusteringEnabled?: (enabled: boolean) => void;
  /** Текущее состояние кластеризации */
  isClusteringEnabled?: () => boolean;
};
```

### PopupItem

Элемент, который рендерится в глобальном popup-хосте.

```typescript
export type PopupItem<M> = {
  model: M;
  content: string | HTMLElement;
  className?: string;
  offset?: number[];
};
```

### MapContext

Минимальный контекст для обработчиков.

```typescript
export type MapContext = {
  map: OlMap;
  /** доступ к слоям по id (типизируется по schema в реализации) */
  layers: Record<string, VectorLayerApi<any, any>>;
  /**
   * Батчинг: сгруппировать несколько mutate/invalidate в один flush.
   * Пример:
   *   ctx.batch(() => {
   *     ctx.layers.points.mutate(id1, ...)
   *     ctx.layers.points.mutate(id2, ...)
   *     ctx.layers.lines.invalidate()
   *   })
   */
  batch: (fn: () => void) => void;
};
```

### FeatureDescriptor

Описание фичи: sync + стиль + взаимодействия + popup — всё в одном месте.

```typescript
export interface FeatureDescriptor<M, G extends Geometry, OPTS extends object> {
  /** идентификатор модели */
  id: (model: M) => string | number;
  /** Sync model ⇄ geometry */
  geometry: {
    /** model -> geometry */
    fromModel: (model: M) => G;
    /** geometry -> model (мутация модели) */
    applyGeometryToModel: (model: M, geometry: G) => void;
    /** хук после создания feature */
    onCreate?: (args: { feature: Feature<G>; model: M; ctx: MapContext }) => void;
  };
  /** Style: функционально (без фабрик-классов) */
  style: {
    /**
     * Базовые opts (полное состояние) + LOD
     * Пример LOD: на дальнем zoom отключать label, менять strokeWidth и т.п.
     */
    base: MaybeFn<OPTS, [model: M, view: StyleView]>;
    /**
     * PATCH-override по state (мерджится на base) + LOD
     * Если state массив — патчи применяются по statePriority (если задан),
     * иначе в порядке массива.
     */
    states?: Partial<
      Record<FeatureStyleState, MaybeFn<Patch<OPTS>, [model: M, view: StyleView]>>
    >;
    /** opts -> Style | Style[] (+ view для LOD) */
    render: (opts: OPTS, view: StyleView) => Style | Style[];
    /** опциональный ключ кеша (WeakMap по object или string) */
    cacheKey?: (opts: OPTS, view: StyleView) => object | string;
    /** приоритет мерджа состояний (если порядок важен) */
    statePriority?: FeatureStyleState[];
  };
  /**
   * Interactions:
   *  - наличие секции => фреймворк подключит обработчики
   *  - enabled => можно включать/выключать условием
   *  - state => фреймворк применит эти состояния на время активности интеракции
   *
   * Возвращаемые значения обработчиков:
   * - true  => событие обработано (handled/consumed)
   * - false/void => событие не обработано
   *
   * Пропагация по слоям после handled регулируется InteractionBase.propagation.
   *
   * ВАЖНО: Для hit-test (click/hover/select) обработчики получают массивы
   * ТОЛЬКО ТЕКУЩЕГО СЛОЯ.
   */
  interactions?: {
    click?: InteractionBase & {
      hitTolerance?: number;
      onClick: (args: {
        models: M[];
        features: Feature<G>[];
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
    };
    hover?: InteractionBase & {
      hitTolerance?: number;
      onEnter?: (args: {
        models: M[];
        features: Feature<G>[];
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
      onLeave?: (args: {
        models: M[];
        features: Feature<G>[];
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
    };
    select?: InteractionBase & {
      hitTolerance?: number;
      onSelect?: (args: {
        models: M[];
        features: Feature<G>[];
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
      onClear?: (args: {
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
    };
    /** Translate = drag&drop целиком */
    translate?: InteractionBase & {
      moveThrottleMs?: number;
      onStart?: (args: {
        model: M;
        feature: Feature<G>;
        ctx: MapContext;
        event: TranslateEvent;
      }) => InteractionHandlerResult;
      onChange?: (args: {
        model: M;
        feature: Feature<G>;
        ctx: MapContext;
        event: TranslateEvent;
      }) => InteractionHandlerResult;
      onEnd?: (args: {
        model: M;
        feature: Feature<G>;
        ctx: MapContext;
        event: TranslateEvent;
      }) => InteractionHandlerResult;
    };
    /** Modify = редактирование геометрии (вершины/сегменты) */
    modify?: InteractionBase & {
      moveThrottleMs?: number;
      onStart?: (args: {
        model: M;
        feature: Feature<G>;
        ctx: MapContext;
        event: ModifyEvent;
      }) => InteractionHandlerResult;
      onChange?: (args: {
        model: M;
        feature: Feature<G>;
        ctx: MapContext;
        event: ModifyEvent;
      }) => InteractionHandlerResult;
      onEnd?: (args: {
        model: M;
        feature: Feature<G>;
        ctx: MapContext;
        event: ModifyEvent;
      }) => InteractionHandlerResult;
    };
  };
  /**
   * Popup (опционально)
   *
   * ВАЖНО: попап не “рендерится” тут напрямую.
   * Эта секция лишь формирует PopupItem, а показ/агрегация/лимиты — в global popupHost.
   */
  popup?: {
    enabled?: Enabled;
    item: (args: { model: M; ctx: MapContext }) => PopupItem<M>;
  };
}
```

### LayerClustering

Описание кластеризации для слоя.

```typescript
export type LayerClustering<M> = {
  /** по умолчанию включено/выключено */
  enabledByDefault?: boolean;
  /** параметры OL Cluster (px) */
  distance?: number;
  minDistance?: number;
  /**
   * Стиль отображения cluster-feature (когда кластеризация включена).
   *
   * ВАЖНО: cluster-feature существует и для одиночных элементов (size === 1),
   * но в этом случае реализация ДОЛЖНА отображать элемент как обычную фичу
   * через `descriptor.feature.style`, а `clusterStyle` применять только когда size > 1.
   */
  clusterStyle: {
    render: (args: { models: M[]; size: number; view: StyleView }) => Style | Style[];
    cacheKey?: (args: { models: M[]; size: number; view: StyleView }) => object | string;
  };
  /**
   * Popup для кластера (конфигурируемый)
   * Применяется когда кластеризация включена и size > 1 (по умолчанию).
   */
  popup?: {
    enabled?: Enabled;
    item: (args: { models: M[]; size: number; ctx: MapContext }) => PopupItem<M>;
    /** лимит именно для кластера (перекрывает popupHost.maxItems) */
    maxItems?: number;
  };
  /**
   * Раскрытие кластера по клику (когда size > 1).
   * Если не задано — клик по кластеру можно игнорировать или обрабатывать в проекте отдельно.
   */
  expandOnClick?: {
    /** как раскрывать */
    mode?: "zoomToExtent" | "zoomIn";
    /** padding для fit(extent) */
    padding?: number | [number, number, number, number];
    /** максимальный zoom при fit/zoomIn */
    maxZoom?: number;
    /** шаг зума для zoomIn */
    zoomDelta?: number;
    /** длительность анимации */
    durationMs?: number;
    /**
     * Хук после раскрытия (после вызова fit/animate).
     * Можно использовать для открытия панели со списком моделей и т.п.
     */
    onExpanded?: (args: { models: M[]; ctx: MapContext }) => void;
  };
};
```

### VectorLayerDescriptor

1 слой = 1 тип feature/model.

```typescript
export interface VectorLayerDescriptor<
  M,
  G extends Geometry,
  OPTS extends object,
  ID extends string = string
> {
  id: ID;
  title?: string;
  zIndex?: number;
  visibleByDefault?: boolean;
  feature: FeatureDescriptor<M, G, OPTS>;
  /**
   * Кластеризация (опционально)
   * Если задано — слой поддерживает переключение plain/cluster (через source).
   */
  clustering?: LayerClustering<M>;
}
```

### MapSchema

Описание карты: список слоёв + общие настройки.

```typescript
export interface MapSchema<
  Layers extends readonly VectorLayerDescriptor<any, any, any, any>[]
> {
  layers: Layers;
  options?: {
    /** общий дефолт для hitTolerance, если не переопределено на interaction */
    hitTolerance?: number;
    /**
     * Глобальный popup-хост:
     * - агрегирует PopupItem’ы из feature.popup и clustering.popup
     * - применяет лимиты, сортировку и т.п.
     */
    popupHost?: {
      enabled?: Enabled;
      /** максимум элементов в списке (защита от бесконечного списка) */
      maxItems?: number;
      /** сортировка popups (если нужно) */
      sort?: (a: PopupItem<any>, b: PopupItem<any>) => number;
      /** куда рендерить: контейнер/портал */
      mount?: HTMLElement | (() => HTMLElement);
    };
  };
}
```
