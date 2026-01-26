# Map Framework Contracts

целевая версия openlayers 6.5.0

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
- обработчик interaction получает массив `items` (HitItem: { model, feature }),
  НО ТОЛЬКО ДЛЯ ТЕКУЩЕГО СЛОЯ (1 слой = 1 featureDescriptor).
- порядок элементов в массиве `items` не гарантируется;
  если важен приоритет (например, выбор одного элемента из нескольких),
  он должен быть определён в обработчике interaction.

### Кластеризация

Если для слоя включена кластеризация, правила hit-test дополняются следующим образом:

- interactions (`feature.interactions.*`) срабатывают **только для обычных (не кластерных) фич слоя**.
- если hit-test попал в cluster-feature:
  - при `size === 1` фреймворк **unwrap’ит кластер** в исходную обычную feature и
    вызывает `feature.interactions.*` как обычно (`items` относятся к этой одной фиче);
  - при `size > 1` `feature.interactions.*` **НЕ вызываются**, так как это кластер, а не одиночная фича.  
    Поведение по клику / hover / select / popup для кластера
    настраивается отдельно через `descriptor.clustering.*`
    (например, `expandOnClick`, `clustering.interactions`, `clustering.popup`).

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

### M - Model
Generic модель представляет бизнес сущность
Правило иммутабельности:
   - считается иммутабельной моделью.
   - Любые изменения делаются ТОЛЬКО через `mutate/mutateMany` (или через внешний `setModels`).
   - update(prev) возвращает next (immutable).
   - если next === prev → no-op (изменения нет).
   - Мутация prev по ссылке запрещена.
Поведение фреймворка:
   - Если возвращён новый объект — фреймворк синхронизирует геометрию и обновляет слой.

### HitItem

Связка model + feature (результат hit-test на слое).

```ts
export type HitItem<M, G extends Geometry> = {
  model: M;
  feature: Feature<G>;
};
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

  /**
   * UX: курсор для interaction.
   *
   * Фреймворк устанавливает курсор на DOM-элемент карты.
   *
   * - hover / click / select / doubleClick:
   *   курсор применяется, пока указатель находится над хотя бы одной фичей текущего слоя.
   *
   * - translate / modify:
   *   курсор применяется на время активной сессии (start → end / abort);
   *   превью до старта может использовать то же правило, что и hover.
   *
   * Приоритет:
   * - активная сессия translate/modify имеет высший приоритет;
   * - иначе курсор задаёт верхний слой (hit-test сверху вниз).
   *
   * Если ни одно interaction не применимо — курсор сбрасывается в значение по умолчанию.
   */
  cursor?: string;

  /**
   * Состояния, которые применяются на время активности interaction.
   *
   * - Если `state` ЗАДАН:
   *   фреймворк сам управляет этим состоянием:
   *   применяет при активности и снимает при деактивации.
   *
   * - Если `state` НЕ ЗАДАН:
   *   фреймворк НЕ управляет состояниями вообще:
   *   он НЕ применяет их автоматически и НЕ снимает их автоматически.
   *   Управление полностью на стороне пользователя в хуках interaction
   *   (onEnter/onLeave/onSelect/onClear/onStart/onChange/onEnd и т.п.).
   *
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
export type ModelChangeReason =
  | "mutate"
  | "translate"
  | "modify";

export type ModelChange<M> = {
  /** предыдущая версия модели */
  prev: M;
  /** обновлённая версия модели (immutable) */
  next: M;
  /** причина изменения */
  reason: ModelChangeReason;
};

export type Unsubscribe = () => void;
```

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
   * IMMUTABLE update:
   * - бизнес-код НЕ мутирует модель по ссылке
   * - update(prev) обязан вернуть next
   * - если next === prev → no-op (sync/invalidate могут не выполняться)
   * - фреймворк после update гарантированно сделает:
   *   syncFeatureFromModel(next) + (batched) invalidate()
   */
  mutate: (id: string | number, update: (prev: M) => M) => void;
  
  /** массовая мутация (опционально) */
  mutateMany?: (
    ids: Array<string | number>,
    update: (prev: M) => M,
    reason?: ModelChangeReason,
  ) => void;
  
  /**
   * Кластеризация (доступна, если descriptor.clustering задан в schema)
   * Включение/выключение переключает source слоя (plain ↔ cluster).
   */
  setClusteringEnabled?: (enabled: boolean) => void;
  /** Текущее состояние кластеризации */
  isClusteringEnabled?: () => boolean;

  /**
   * События изменения моделей, произведённых ВНУТРИ карты
   * (mutate / translate / modify).
   *
   * Используется для синхронизации с внешним store / backend / UI.
   *
   * Гарантии:
   * - модель уже обновлена в слое
   * - feature уже синхронизирована
   * - invalidate запланирован (batched)
   * - изменения могут приходить батчем
   */
  onModelsChanged?: (cb: (changes: ModelChange<M>[]) => void) => Unsubscribe;
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
  batch: (fn: () => void, options?: { policy?: "microtask" | "raf" }) => void;
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
    /** geometry -> next model (immutable update) */
    applyGeometryToModel: (prev: M, geometry: G) => M;
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
    /** опциональный ключ кеша */
    cacheKey?: (opts: OPTS, view: StyleView) => string;
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
   *
   * ---------------------------------------------------------------------------
   * Правило конфликта: select vs click
   * ---------------------------------------------------------------------------
   *
   * Для одного физического события клика фреймворк использует единый
   * управляемый pipeline обработки (hit-test + interactions),
   * а не несколько независимых подписчиков на событие.
   *
   * Если на одном и том же слое одновременно включены `select` и `click`,
   * событие клика на этом слое обрабатывается в следующем порядке:
   *
   *   1. select
   *   2. click
   *
   * Если обработчик `select` вернул `handled = true` и при этом
   * `select.propagation` НЕ равно `"continue"`,
   * обработчик `click` для этого слоя НЕ вызывается.
   *
   * После обработки слоя дальнейшее распространение события на слои ниже
   * определяется правилами `InteractionBase.propagation`.
   *
   * ---------------------------------------------------------------------------
   * pickTarget — выбор цели для translate/modify при конфликте
   * ---------------------------------------------------------------------------
   *
   * Зачем:
   * При старте `translate`/`modify` под курсором может оказаться несколько фич одного слоя.
   * Эти интеракции работают только с ОДНОЙ активной целью (target).
   *
   * Термины:
   * - candidate — HitItem (model+feature), попавший под hit-test на старте интеракции.
   * - target — выбранный один HitItem, который будет редактироваться/перетаскиваться.
   *
   * Контракт:
   * 1) Сбор кандидатов
   * - Фреймворк делает hit-test на ТЕКУЩЕМ слое и формирует `candidates: HitItem[]`.
   * - `candidates` содержит элементы ТОЛЬКО текущего слоя (1 слой = 1 featureDescriptor).
   * - Порядок элементов в `candidates` НЕ гарантируется.
   * - Если включена кластеризация:
   *   - hit по cluster-feature size===1 -> unwrap -> в candidates попадает обычная feature (HitItem).
   *   - hit по cluster-feature size>1  -> translate/modify для feature НЕ стартует
   *     (кластер — отдельная сущность; поведение настраивается через `descriptor.clustering.*`).
   *
   * 2) Выбор target
   * - Если `pickTarget` ЗАДАН:
   *     фреймворк вызывает `pickTarget({ candidates, ctx, event })`.
   *     - Если возвращён `HitItem` -> он становится target.
   *     - Если возвращено `null` или `undefined` -> интеракция НЕ стартует (игнорируется).
   *
   * - Если `pickTarget` НЕ задан:
   *     - Если `candidates.length > 0` -> target = `candidates[0]`.
   *     - Если `candidates.length === 0` -> интеракция НЕ стартует.
   *
   * 3) Жизненный цикл и стабильность target
   *
   * - `pickTarget` вызывается ТОЛЬКО на старте интеракции.
   *
   * - Возвращённый `HitItem` используется ТОЛЬКО как выбор цели.
   *   Фреймворк НЕ хранит ссылки на `item.model` или `item.feature`
   *   как источник истины.
   *
   * - После выбора цели фреймворк фиксирует `targetKey`
   *   (обычно `descriptor.id(item.model)`).
   *
   * - Перед каждым вызовом `onStart / onChange / onEnd`
   *   фреймворк выполняет `resolveTarget(targetKey)`:
   *
   *     - если по `targetKey` найдена актуальная модель и feature —
   *       в хук передаётся НОВЫЙ `HitItem { model, feature }`;
   *
   *     - если цель больше не существует
   *       (модель удалена / feature пересоздана / слой обновлён),
   *       интеракция безопасно прерывается:
   *         - `onChange` / `onEnd` НЕ вызываются
   *         - интеракция считается завершённой.
   *
   * - Фреймворк НЕ пере-выбирает target по курсору на `onChange`,
   *   даже если под курсором появились другие фичи.
   *
   * 4) Возвращаемые значения и propagation
   * - Возврат `null/undefined` из `pickTarget` означает только "не стартовать" данную интеракцию.
   *   Это НЕ является `handled=true` само по себе (событие может обрабатываться другими интеракциями
   *   и/или слоями по правилам propagation).
   * - `handled/propagation` применяются к `onStart/onChange/onEnd` как обычно.
   *
   * Рекомендуемая сигнатура:
   * pickTarget?: (args: {
   *   candidates: Array<HitItem<M, G>>;
   *   ctx: MapContext;
   *   event: TranslateEvent | ModifyEvent;
   * }) => HitItem<M, G> | null | undefined;
   */
  interactions?: {
    
    click?: InteractionBase & {
      hitTolerance?: number;
      /**
       * NOTE about `InteractionBase.state` for click:
       * Click — событие без жизненного цикла (нет enter/leave или start/end),
       * поэтому если `state` задан, фреймворк НЕ применяет и НЕ снимает его автоматически.
       * Если нужен "flash"/подсветка по клику — делайте это вручную в `onClick`.
       */
      onClick: (args: {
        items: Array<HitItem<M, G>>;
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
    };
    
    doubleClick?: InteractionBase & {
      hitTolerance?: number;

      /**
       * NOTE about `InteractionBase.state` for doubleClick:
       * DoubleClick — тоже событие без жизненного цикла,
       * поэтому авто-применения/снятия `state` нет. Подсветка (если нужна) — вручную в `onDoubleClick`.
       */
      onDoubleClick: (args: {
        items: Array<HitItem<M, G>>;
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
    };
    
    hover?: InteractionBase & {
      hitTolerance?: number;
      onEnter?: (args: {
        items: Array<HitItem<M, G>>;
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
      onLeave?: (args: {
        items: Array<HitItem<M, G>>;
        ctx: MapContext;
        event: MapBrowserEvent<UIEvent>;
      }) => InteractionHandlerResult;
    };
    
    select?: InteractionBase & {
      hitTolerance?: number;
      onSelect?: (args: {
        items: Array<HitItem<M, G>>;
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
      /**
       * Throttle интервал (мс) для обновлений при перетаскивании.
       * Для плавности обычно выбирают 0 (без троттлинга) или ~16/33 (60/30 FPS).
       */
      moveThrottleMs?: number;
      pickTarget?: (args: {
        candidates: Array<HitItem<M, G>>;
        ctx: MapContext;
        event: TranslateEvent; 
      }) => HitItem<M, G> | null | undefined;
      onStart?: (args: {
        item: HitItem<M, G>;
        ctx: MapContext;
        event: TranslateEvent;
      }) => InteractionHandlerResult;
      onChange?: (args: {
        item: HitItem<M, G>;
        ctx: MapContext;
        event: TranslateEvent;
      }) => InteractionHandlerResult;
      onEnd?: (args: {
        item: HitItem<M, G>;
        ctx: MapContext;
        event: TranslateEvent;
      }) => InteractionHandlerResult;
    };
    
    /** Modify = редактирование геометрии (вершины/сегменты) */
    modify?: InteractionBase & {
      /**
       * Throttle интервал (мс) для обновлений при редактировании.
       * Для плавности обычно выбирают 0 (без троттлинга) или ~16/33 (60/30 FPS).
       */
      moveThrottleMs?: number;
      pickTarget?: (args: {
        candidates: Array<HitItem<M, G>>;
        ctx: MapContext;
        event: ModifyEvent;
      }) => HitItem<M, G> | null | undefined;
      onStart?: (args: {
        item: HitItem<M, G>;
        ctx: MapContext;
        event: ModifyEvent;
      }) => InteractionHandlerResult;
      onChange?: (args: {
        item: HitItem<M, G>;
        ctx: MapContext;
        event: ModifyEvent;
      }) => InteractionHandlerResult;
      onEnd?: (args: {
        item: HitItem<M, G>;
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
    cacheKey?: (args: { models: M[]; size: number; view: StyleView }) => string;
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
    /** планировщик сброса invalidate/changed */
    scheduler?: {
      /** дефолтный policy для flush */
      policy?: "microtask" | "raf";
      /** policy для translate/modify (например, RAF при drag) */
      interactionPolicy?: "microtask" | "raf";
    };
    /**
     * Глобальный popup-хост:
     * - агрегирует PopupItem’ы из feature.popup и clustering.popup
     * - применяет лимиты, сортировку и т.п.
     */
    popupHost?: {
      enabled?: Enabled;
      autoMode?: "off" | "click" | "hover";
      /** максимум элементов в списке (защита от бесконечного списка) */
      maxItems?: number;
      /** сортировка popups (если нужно) */
      sort?: (a: PopupItem<any>, b: PopupItem<any>) => number;
      /** куда рендерить: контейнер/портал */
      mount?: HTMLElement | (() => HTMLElement);
      stack?: "stop" | "continue";
    };
  };
}
```

## Батчинг и стратегия flush

По умолчанию `invalidate()` и `layer.changed()` собираются в один microtask flush.
Для тяжёлых апдейтов или drag-анимаций можно выбрать RAF:

```ts
const schema: MapSchema<any> = {
  options: {
    scheduler: {
      policy: "microtask",
      interactionPolicy: "raf",
    },
  },
  layers: [],
};
```

Также можно вручную задать policy для конкретной группы операций:

```ts
ctx.batch(() => {
  ctx.layers.points.mutate(id1, (prev) => ({ ...prev, coords: [1, 2] }));
  ctx.layers.points.mutate(id2, (prev) => ({ ...prev, coords: [3, 4] }));
}, { policy: "raf" });
```

## Runtime toggle enabled

Если `enabled` задан функцией и значение меняется во время жизни карты,
вызовите `layerManager.refreshEnabled()` чтобы:
- переподключить/отключить OL listeners,
- очистить hover/select/active translate/modify состояния,
- остановить активные throttle таймеры.

При disable происходит “тихий” cleanup: onLeave/onClear/onEnd не вызываются.

## Примеры

### 1) Базовый слой точек + hover/select + popup

```ts
const schema: MapSchema<any> = {
  options: {
    popupHost: { enabled: true, autoMode: "click" },
  },
  layers: [
    {
      id: "points",
      feature: {
        id: (m) => m.id,
        geometry: {
          fromModel: (m) => new Point(m.coords),
          applyGeometryToModel: (prev, geometry) => ({
            ...prev,
            coords: (geometry as Point).getCoordinates(),
          }),
        },
        style: {
          base: () => ({ color: "red" }),
          states: { HOVER: () => ({ color: "blue" }) },
          render: () => new Style(),
        },
        interactions: {
          hover: { state: "HOVER" },
          select: {
            onSelect: ({ items }) => console.log("selected", items.length),
          },
        },
        popup: {
          item: ({ model }) => ({ model, content: `Point ${model.id}` }),
        },
      },
    },
  ],
};
```

### 2) Кластеризация + expandOnClick + popup кластера

```ts
const schema: MapSchema<any> = {
  options: { popupHost: { enabled: true, autoMode: "click" } },
  layers: [
    {
      id: "clustered",
      feature: { id: (m) => m.id, geometry, style },
      clustering: {
        enabledByDefault: true,
        clusterStyle: {
          render: ({ size }) => new Style({}),
        },
        expandOnClick: { mode: "zoomToExtent", padding: 24 },
        popup: {
          item: ({ models, size }) => ({
            model: models[0],
            content: `Cluster size: ${size}`,
          }),
        },
      },
    },
  ],
};
```

### 3) Drag/translate + RAF flush

```ts
const schema: MapSchema<any> = {
  options: { scheduler: { policy: "microtask", interactionPolicy: "raf" } },
  layers: [
    {
      id: "draggable",
      feature: {
        id: (m) => m.id,
        geometry,
        style,
        interactions: { translate: { moveThrottleMs: 16 } },
      },
    },
  ],
};
```
