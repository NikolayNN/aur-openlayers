import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import type {ModifyEvent} from 'ol/interaction/Modify';
import type OlMap from 'ol/Map';
import type Style from 'ol/style/Style';
import type {TranslateEvent} from 'ol/interaction/Translate';

export type FeatureStyleState = string;

export type MaybeFn<T, A extends any[] = []> = T | ((...args: A) => T);

export type Patch<T> = Partial<T> | ((prev: T) => Partial<T>);

export type Enabled = boolean | (() => boolean);

export type FlushPolicy = 'microtask' | 'raf';

export type BatchOptions = {
  policy?: FlushPolicy;
};

export type StyleView = {
  /** OpenLayers resolution (map.getView().getResolution()) */
  resolution: number;
  /** zoom optionally, if computed in implementation */
  zoom?: number;
};

export type FeatureState = FeatureStyleState | FeatureStyleState[];

export type HitItem<M, G extends Geometry> = {
  model: M;
  feature: Feature<G>;
};

export type InteractionBase = {
  /**
   * Presence of section + enabled => framework connects/disconnects the interaction on the fly.
   * If enabled is not specified — considered enabled.
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
   * States applied during interaction activity.
   *
   * - If `state` is SET:
   * the framework manages this state itself:
   * applies it when active and removes it when deactivated.
   *
   * - If `state` is NOT SET:
   * the framework does NOT manage states at all:
   * it does NOT apply or remove them automatically.
   * Management is fully on the user side in interaction hooks
   * (onEnter/onLeave/onSelect/onClear/onStart/onChange/onEnd etc.).
   *
   * Composition allowed: ["HOVER", "SELECTED"].
   */
  state?: FeatureState;
  /**
   * Propagation of the event "down" to lower layers if the handler on this layer
   * returned handled=true (see return values of on*).
   *
   * - "stop" — default: if event handled, do not proceed to lower layers.
   * - "continue" — continue to lower layers even if handled.
   * - "auto" — alias for future use (can be treated as "stop").
   */
  propagation?: 'stop' | 'continue' | 'auto';
};

export type InteractionHandlerResult = boolean | void;

export type ModelChangeReason = 'mutate' | 'translate' | 'modify';

export type ModelChange<M> = {
  /** previous model version */
  prev: M;
  /** updated model version (immutable) */
  next: M;
  /** reason for change */
  reason: ModelChangeReason;
};

export type ViewFitPadding =
  | { all: number }
  | { vertical: number; horizontal: number }
  | { top: number; right: number; bottom: number; left: number };

export type ViewFitOptions = {
  padding?: ViewFitPadding;
  duration?: number;
  maxZoom?: number;
};

export type Unsubscribe = () => void;

export type VectorLayerApi<M, G extends Geometry> = {
  /** replace entire set of models */
  setModels: (models: readonly M[]) => void;
  /** request layer/styles recalculation */
  invalidate: () => void;
  /** apply model changes -> feature.geometry (when model changes externally) */
  syncFeatureFromModel: (model: M) => void;
  /** find model by feature */
  getModelByFeature: (feature: Feature<G>) => M | undefined;
  /**
   * IMMUTABLE update:
   * - business code does NOT mutate model by reference
   * - update(prev) must return next
   * - if next === prev → no-op (sync/invalidate may not run)
   * - after update, framework guarantees:
   * syncFeatureFromModel(next) + (batched) invalidate()
   */
  mutate: (
    id: string | number,
    update: (prev: M) => M,
    reason?: ModelChangeReason,
  ) => void;

  /** bulk mutation (optional) */
  mutateMany?: (ids: Array<string | number>, update: (prev: M) => M) => void;

  /**
   * Clustering (available if descriptor.clustering is set in schema)
   * Enabling/disabling switches layer source (plain ↔ cluster).
   */
  setClusteringEnabled?: (enabled: boolean) => void;
  /** Current clustering state */
  isClusteringEnabled?: () => boolean;
  /**
   * Events for model changes made INSIDE the map
   * (mutate / translate / modify).
   *
   * Used for synchronization with external store / backend / UI.
   *
   * Guarantees:
   * - model already updated in layer
   * - feature already synchronized
   * - invalidate scheduled (batched)
   * - changes may come in batches
   */
  onModelsChanged?: (cb: (changes: ModelChange<M>[]) => void) => Unsubscribe;

  /**
   * Centers the map on all features of the layer and fits the view
   * so that all features are fully visible.
   *
   * If the layer has no features (empty extent), nothing happens.
   *
   * @param opts Fit options: padding (margins), duration (animation), maxZoom (zoom limit).
   */
  centerOnAllModels: (opts?: ViewFitOptions) => void;

  /**
   * Centers the map on a single feature of the layer by its id and fits
   * the view to the feature's extent.
   *
   * If the feature with the given id is not found or has no geometry,
   * nothing happens.
   *
   * @param id Identifier of the model/feature within the layer.
   * @param opts Fit options: padding (margins), duration (animation), maxZoom (zoom limit).
   */
  centerOnModel: (id: string | number, opts?: ViewFitOptions) => void;

  /**
   * Centers the map on a set of features of the layer specified by their ids
   * and fits the view to the combined extent of all found features.
   *
   * Missing ids are ignored. If no features are found, nothing happens.
   *
   * @param ids Identifiers of the models/features to include in the fit.
   * @param opts Fit options: padding (margins), duration (animation), maxZoom (zoom limit).
   */
  centerOnModels: (ids: ReadonlyArray<string | number>, opts?: ViewFitOptions) => void;

  /**
   * Controls layer visibility.
   *
   * @param visible When `true`, the layer is visible; when `false`, it is hidden.
   */
  setVisible: (visible: boolean) => void;

  /**
   * Returns current layer visibility state.
   *
   * @returns `true` if the layer is visible, otherwise `false`.
   */
  isVisible: () => boolean;

  /**
   * Sets layer opacity.
   *
   * @param opacity Layer opacity in range [0..1],
   * where 0 — fully transparent, 1 — fully opaque.
   */
  setOpacity: (opacity: number) => void;

  /**
   * Returns current layer opacity.
   *
   * @returns Layer opacity in range [0..1].
   */
  getOpacity: () => number;

  /**
   * Sets layer z-index (rendering order among layers).
   * Higher z-index is rendered on top of lower ones.
   *
   * @param z Layer z-index.
   */
  setZIndex: (z: number) => void;

  /**
   * Returns current layer z-index.
   *
   * @returns Layer z-index (may be undefined if not set explicitly).
   */
  getZIndex: () => number | undefined;

  /**
   * Returns model by id from the layer registry.
   *
   * @param id Model/feature id within the layer.
   * @returns Model if found, otherwise undefined.
   */
  getModelById: (id: string | number) => M | undefined;

  /**
   * Checks whether a model with the given id exists on the layer.
   *
   * @param id Model/feature id within the layer.
   */
  hasModel: (id: string | number) => boolean;

  /**
   * Returns current models of the layer (snapshot).
   * Order is not guaranteed.
   */
  getAllModels: () => readonly M[];

  /**
   * Returns ids of all models currently present on the layer (snapshot).
   * Order is not guaranteed.
   */
  getAllModelIds: () => Array<string | number>;

  /**
   * Applies style states to one or many features by id and triggers re-render.
   *
   * @param ids Model/feature id or a list of ids.
   * @param states Single state or list of states to set. Pass undefined/empty to clear.
   */
  setFeatureStates: (
    ids: string | number | ReadonlyArray<string | number>,
    states?: FeatureState,
  ) => void;
};

export type PopupItemSource = 'feature' | 'cluster' | 'interaction';

export type PopupItem<M> = {
  model: M;
  content: string | HTMLElement;
  className?: string;
  offset?: number[];
  dedupKey?: string | number;
  priority?: number;
  source?: PopupItemSource;
};

export interface PopupHostApi {
  push: (items: PopupItem<any>[]) => void;
  set: (items: PopupItem<any>[]) => void;
  clear: () => void;
  remove: (key: string | number) => void;
  getItems: () => PopupItem<any>[];
  mount: (target: HTMLElement | (() => HTMLElement)) => void;
  dispose: () => void;
}

export type MapContext = {
  map: OlMap;
  /** access to layers by id (typed by schema in implementation) */
  layers: Record<string, VectorLayerApi<any, any>>;
  popupHost?: PopupHostApi;
  /**
   * Batching: group multiple mutate/invalidate into one flush.
   * Example:
   * ctx.batch(() => {
   * ctx.layers.points.mutate(id1, ...)
   * ctx.layers.points.mutate(id2, ...)
   * ctx.layers.lines.invalidate()
   * })
   */
  batch: (fn: () => void, options?: BatchOptions) => void;
};

export interface FeatureDescriptor<M, G extends Geometry, OPTS extends object> {
  /** model identifier */
  id: (model: M) => string | number;
  /** Sync model ⇄ geometry */
  geometry: {
    /** model -> geometry */
    fromModel: (model: M) => G;
    /** geometry -> next model (immutable update) */
    applyGeometryToModel: (prev: M, geometry: G) => M;
    /** hook after feature creation */
    onCreate?: (args: { feature: Feature<G>; model: M; ctx: MapContext }) => void;
  };
  /** Style: functional (no class factories) */
  style: {
    /**
     * Base opts (full state) + LOD
     * Example LOD: disable label at far zoom, change strokeWidth, etc.
     */
    base: MaybeFn<OPTS, [model: M, view: StyleView]>;
    /**
     * PATCH-override by state (merged onto base) + LOD
     * If state is array — patches applied by statePriority (if set),
     * otherwise in array order.
     * Patches are applied sequentially; later patches override earlier ones.
     */
    states?: Partial<
      Record<FeatureStyleState, MaybeFn<Patch<OPTS>, [model: M, view: StyleView]>>
    >;
    /** opts -> Style | Style[] (+ view for LOD) */
    render: (opts: OPTS, view: StyleView) => Style | Style[];
    /** optional cache key */
    cacheKey?: (opts: OPTS, view: StyleView) => string | object;
    /** merge priority for states (if order matters) */
    statePriority?: FeatureStyleState[];
  };
  /**
   * Interactions:
   * - presence of section => framework connects handlers
   * - enabled => can enable/disable conditionally
   * - state => framework applies these states during interaction activity
   *
   * Handler return values:
   * - true => event handled (consumed)
   * - false/void => event not handled
   *
   * Propagation across layers after handled is controlled by InteractionBase.propagation.
   *
   * IMPORTANT: For hit-test (click/hover/select) handlers receive arrays
   * ONLY OF THE CURRENT LAYER.
   *
   * ---------------------------------------------------------------------------
   * Conflict rule: select vs click
   * ---------------------------------------------------------------------------
   *
   * For a single physical click event, the framework uses a unified
   * managed pipeline (hit-test + interactions),
   * not multiple independent event listeners.
   *
   * If both `select` and `click` are enabled on the same layer,
   * the click event on that layer is processed in this order:
   *
   * 1. select
   * 2. click
   *
   * If the `select` handler returned `handled = true` and
   * `select.propagation` is NOT `"continue"`,
   * the `click` handler for that layer is NOT called.
   *
   * Further propagation to lower layers follows InteractionBase.propagation rules.
   *
   * ---------------------------------------------------------------------------
   * pickTarget — target selection for translate/modify in case of conflict
   * ---------------------------------------------------------------------------
   *
   * Purpose:
   * When starting `translate`/`modify`, multiple features of the same layer may be under the cursor.
   * These interactions work with only ONE active target.
   *
   * Terms:
   * - candidate — HitItem (model+feature) that passed hit-test at interaction start.
   * - target — the single selected HitItem that will be edited/dragged.
   *
   * Contract:
   * 1) Collecting candidates
   * - Framework performs hit-test on the CURRENT layer and forms `candidates: HitItem[]`.
   * - `candidates` contains only elements of the current layer (1 layer = 1 featureDescriptor).
   * - Order of elements in `candidates` is NOT guaranteed.
   * - If clustering is enabled:
   * - hit on cluster-feature size===1 -> unwrap -> candidates contain regular feature (HitItem).
   * - hit on cluster-feature size>1 -> translate/modify for feature does NOT start
   * (cluster is a separate entity; behavior configured via `descriptor.clustering.*`).
   *
   * 2) Selecting target
   * - If `pickTarget` is SET:
   * framework calls `pickTarget({ candidates, ctx, event })`.
   * - If `HitItem` returned -> becomes target.
   * - If `null` or `undefined` returned -> interaction does NOT start (ignored).
   *
   * - If `pickTarget` is NOT set:
   * - If `candidates.length > 0` -> target = `candidates[0]`.
   * - If `candidates.length === 0` -> interaction does NOT start.
   *
   * 3) Lifecycle and target stability
   *
   * - `pickTarget` is called ONLY at interaction start.
   *
   * - Returned `HitItem` is used ONLY for target selection.
   * Framework does NOT store references to `item.model` or `item.feature`
   * as source of truth.
   *
   * - After selection, framework fixes `targetKey`
   * (usually `descriptor.id(item.model)`).
   *
   * - Before each `onStart / onChange / onEnd` call,
   * framework performs `resolveTarget(targetKey)`:
   *
   * - if current model and feature found by `targetKey` —
   * new `HitItem { model, feature }` is passed to the hook;
   *
   * - if target no longer exists
   * (model removed / feature recreated / layer updated),
   * interaction safely aborts:
   * - `onChange` / `onEnd` NOT called
   * - interaction considered finished.
   *
   * - Framework does NOT re-select target by cursor on `onChange`,
   * even if other features appear under the cursor.
   *
   * 4) Return values and propagation
   * - Returning `null/undefined` from `pickTarget` only means "do not start" this interaction.
   * It is NOT `handled=true` by itself (event may be processed by other interactions
   * and/or layers according to propagation rules).
   * - `handled/propagation` apply to `onStart/onChange/onEnd` as usual.
   *
   * Recommended signature:
   * pickTarget?: (args: {
   * candidates: Array<HitItem<M, G>>;
   * ctx: MapContext;
   * event: TranslateEvent | ModifyEvent;
   * }) => HitItem<M, G> | null | undefined;
   */
  interactions?: {
    click?: InteractionBase & {
      hitTolerance?: number;
      /**
       * NOTE about `InteractionBase.state` for click:
       * Click is an event without lifecycle (no enter/leave or start/end),
       * so if `state` is set, framework does NOT apply or remove it automatically.
       * If "flash"/highlight on click is needed — implement manually in `onClick`.
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
       * DoubleClick also has no lifecycle,
       * so no auto apply/remove of `state`. Highlight (if needed) — manually in `onDoubleClick`.
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

    /** Translate = drag&drop of entire feature */
    translate?: InteractionBase & {
      hitTolerance?: number;
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

    /** Modify = geometry editing (vertices/segments) */
    modify?: InteractionBase & {
      hitTolerance?: number;
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
   * Popup (optional)
   *
   * IMPORTANT: popup is not rendered directly here.
   * This section only forms PopupItem, while show/aggregation/limits are handled by global popupHost.
   */
  popup?: {
    enabled?: Enabled;
    item: (args: {
      model: M;
      feature: Feature<G>;
      ctx: MapContext;
      event?: MapBrowserEvent<UIEvent>;
    }) => PopupItem<M>;
  };
}

export type LayerClustering<M> = {
  /** default enabled/disabled */
  enabledByDefault?: boolean;
  /** OL Cluster parameters (px) */
  distance?: number;
  minDistance?: number;
  /**
   * Style for cluster-feature display (when clustering enabled).
   *
   * IMPORTANT: cluster-feature exists even for single elements (size === 1),
   * but implementation MUST render it as regular feature via `descriptor.feature.style`,
   * and apply `clusterStyle` only when size > 1.
   */
  clusterStyle: {
    render: (args: { models: M[]; size: number; view: StyleView }) => Style | Style[];
    cacheKey?: (args: { models: M[]; size: number; view: StyleView }) => string | object;
  };
  /**
   * Popup for cluster (configurable)
   * Applied when clustering enabled and size > 1 (by default).
   */
  popup?: {
    enabled?: Enabled;
    item: (args: {
      models: M[];
      size: number;
      ctx: MapContext;
      event?: MapBrowserEvent<UIEvent>;
    }) => PopupItem<M>;
    /** limit specifically for cluster (overrides popupHost.maxItems) */
    maxItems?: number;
  };
  /**
   * Expand cluster on click (when size > 1).
   * If not set — click on cluster can be ignored or handled separately in project.
   */
  expandOnClick?: {
    /** how to expand */
    mode?: 'zoomToExtent' | 'zoomIn';
    /** padding for fit(extent) */
    padding?: number | [number, number, number, number];
    /** maximum zoom for fit/zoomIn */
    maxZoom?: number;
    /** zoom step for zoomIn */
    zoomDelta?: number;
    /** animation duration */
    durationMs?: number;
    /**
     * Hook after expansion (after fit/animate call).
     * Can be used to open a panel with model list, etc.
     */
    onExpanded?: (args: { models: M[]; ctx: MapContext }) => void;
  };
};

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
   * Clustering (optional)
   * If set — layer supports switching plain/cluster (via source).
   */
  clustering?: LayerClustering<M>;
}

export interface MapSchema<
  Layers extends readonly VectorLayerDescriptor<any, any, any, any>[]
> {
  layers: Layers;
  options?: {
    /** global default for hitTolerance if not overridden on interaction */
    hitTolerance?: number;
    /** batching/invalidation scheduler */
    scheduler?: {
      /** flush policy used by default */
      policy?: FlushPolicy;
      /** flush policy used for translate/modify interactions */
      interactionPolicy?: FlushPolicy;
    };
    /**
     * Global popup host:
     * - aggregates PopupItem’s from feature.popup and clustering.popup
     * - applies limits, sorting, etc.
     */
    popupHost?: {
      enabled?: Enabled;
      autoMode?: 'off' | 'click' | 'hover';
      /** maximum items in list (protection against infinite list) */
      maxItems?: number;
      /** popup sorting (if needed) */
      sort?: (a: PopupItem<any>, b: PopupItem<any>) => number;
      /** where to render: container/portal */
      mount?: HTMLElement | (() => HTMLElement);
      stack?: 'stop' | 'continue';
    };
  };
}
