import Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import type OlMap from 'ol/Map';
import type VectorLayer from 'ol/layer/Vector';

import type {
  FeatureState,
  HitItem,
  InteractionBase,
  InteractionHandlerResult,
  MapContext,
  MapSchema,
  VectorLayerApi,
  VectorLayerDescriptor,
} from '../public/types';
import { getFeatureStates, setFeatureStates } from './style/feature-states';

type LayerEntry = {
  descriptor: VectorLayerDescriptor<any, any, any, any>;
  layer: VectorLayer;
  api: VectorLayerApi<any, any>;
  index: number;
};

export type HitTestArgs = {
  layerId: string;
  layer: VectorLayer;
  api: VectorLayerApi<any, any>;
  descriptor: VectorLayerDescriptor<any, any, any, any>;
  event: MapBrowserEvent<UIEvent>;
  hitTolerance: number;
};

export type HitTestFn = (args: HitTestArgs) => Array<HitItem<any, any>>;

export type InteractionManagerOptions<
  Layers extends readonly VectorLayerDescriptor<any, any, any, any>[]
> = {
  ctx: MapContext;
  map: OlMap;
  schema: MapSchema<Layers>;
  layers: Record<string, VectorLayer>;
  apis: Record<string, VectorLayerApi<any, any>>;
  hitTest?: HitTestFn;
};

export class InteractionManager<
  Layers extends readonly VectorLayerDescriptor<any, any, any, any>[]
> {
  private readonly ctx: MapContext;
  private readonly map: OlMap;
  private readonly schema: MapSchema<Layers>;
  private readonly layers: Record<string, VectorLayer>;
  private readonly apis: Record<string, VectorLayerApi<any, any>>;
  private readonly hitTest: HitTestFn;
  private readonly hoverItems = new Map<string, Map<string | number, HitItem<any, any>>>();
  private readonly selectedItems = new Map<string, Map<string | number, HitItem<any, any>>>();

  constructor(options: InteractionManagerOptions<Layers>) {
    this.ctx = options.ctx;
    this.map = options.map;
    this.schema = options.schema;
    this.layers = options.layers;
    this.apis = options.apis;
    this.hitTest = options.hitTest ?? this.createDefaultHitTest();

    this.map.on('pointermove', (event) => this.handlePointerMove(event));
    this.map.on('singleclick', (event) => this.handleSingleClick(event));
    this.map.on('dblclick', (event) => this.handleDoubleClick(event));
  }

  handlePointerMove(event: MapBrowserEvent<UIEvent>): void {
    const layers = this.getOrderedLayers();
    for (const entry of layers) {
      const hover = entry.descriptor.feature.interactions?.hover;
      if (!hover || !this.isEnabled(hover.enabled)) {
        continue;
      }
      const items = this.hitTest({
        layerId: entry.descriptor.id,
        layer: entry.layer,
        api: entry.api,
        descriptor: entry.descriptor,
        event,
        hitTolerance: this.getHitTolerance(hover.hitTolerance),
      });

      const handled = this.processHover(entry, hover, items, event);
      if (handled && this.shouldStopPropagation(hover)) {
        break;
      }
    }
  }

  handleSingleClick(event: MapBrowserEvent<UIEvent>): void {
    const layers = this.getOrderedLayers();
    for (const entry of layers) {
      const select = entry.descriptor.feature.interactions?.select;
      const click = entry.descriptor.feature.interactions?.click;
      if (!select && !click) {
        continue;
      }

      const selectEnabled = select && this.isEnabled(select.enabled);
      const clickEnabled = click && this.isEnabled(click.enabled);
      if (!selectEnabled && !clickEnabled) {
        continue;
      }

      const selectItems = selectEnabled
        ? this.hitTest({
            layerId: entry.descriptor.id,
            layer: entry.layer,
            api: entry.api,
            descriptor: entry.descriptor,
            event,
            hitTolerance: this.getHitTolerance(select?.hitTolerance),
          })
        : [];

      const clickItems = clickEnabled
        ? this.hitTest({
            layerId: entry.descriptor.id,
            layer: entry.layer,
            api: entry.api,
            descriptor: entry.descriptor,
            event,
            hitTolerance: this.getHitTolerance(click?.hitTolerance),
          })
        : [];

      const selectHandled = selectEnabled
        ? this.processSelect(entry, select!, selectItems, event)
        : false;
      const selectStops = selectHandled && this.shouldStopPropagation(select!);
      const allowClick =
        !selectHandled || (selectEnabled && this.shouldContinuePropagation(select!));

      if (clickEnabled && allowClick) {
        const clickHandled = this.processClick(entry, click!, clickItems, event);
        if (clickHandled && this.shouldStopPropagation(click!)) {
          break;
        }
      }

      if (selectStops) {
        break;
      }
    }
  }

  handleDoubleClick(event: MapBrowserEvent<UIEvent>): void {
    const layers = this.getOrderedLayers();
    for (const entry of layers) {
      const doubleClick = entry.descriptor.feature.interactions?.doubleClick;
      if (!doubleClick || !this.isEnabled(doubleClick.enabled)) {
        continue;
      }

      const items = this.hitTest({
        layerId: entry.descriptor.id,
        layer: entry.layer,
        api: entry.api,
        descriptor: entry.descriptor,
        event,
        hitTolerance: this.getHitTolerance(doubleClick.hitTolerance),
      });

      const handled = this.processDoubleClick(entry, doubleClick, items, event);
      if (handled && this.shouldStopPropagation(doubleClick)) {
        break;
      }
    }
  }

  private createDefaultHitTest(): HitTestFn {
    return ({ layer, api, event, hitTolerance }) => {
      const items: Array<HitItem<any, any>> = [];
      this.map.forEachFeatureAtPixel(
        event.pixel,
        (feature) => {
          if (!(feature instanceof Feature)) {
            return;
          }
          const model = api.getModelByFeature(feature as Feature<Geometry>);
          if (!model) {
            return;
          }
          items.push({ model, feature });
        },
        {
          layerFilter: (candidateLayer) => candidateLayer === layer,
          hitTolerance,
        },
      );
      return items;
    };
  }

  private getOrderedLayers(): LayerEntry[] {
    return this.schema.layers
      .map((descriptor, index) => ({
        descriptor,
        index,
        layer: this.layers[descriptor.id],
        api: this.apis[descriptor.id],
      }))
      .filter((entry) => entry.layer && entry.api)
      .sort((a, b) => {
        const aZ = a.layer.getZIndex() ?? 0;
        const bZ = b.layer.getZIndex() ?? 0;
        if (aZ !== bZ) {
          return bZ - aZ;
        }
        return a.index - b.index;
      });
  }

  private getHitTolerance(hitTolerance?: number): number {
    if (hitTolerance !== undefined) {
      return hitTolerance;
    }
    if (this.schema.options?.hitTolerance !== undefined) {
      return this.schema.options.hitTolerance;
    }
    return 0;
  }

  private isEnabled(enabled?: boolean | (() => boolean)): boolean {
    if (enabled === undefined) {
      return true;
    }
    if (typeof enabled === 'function') {
      return enabled();
    }
    return enabled;
  }

  private processHover(
    entry: LayerEntry,
    hover: NonNullable<NonNullable<LayerEntry['descriptor']['feature']['interactions']>['hover']>,
    items: Array<HitItem<any, any>>,
    event: MapBrowserEvent<UIEvent>,
  ): boolean {
    const prev = this.hoverItems.get(entry.descriptor.id) ?? new Map();
    const next = this.itemsToMap(entry, items);
    const entered = Array.from(next.entries())
      .filter(([id]) => !prev.has(id))
      .map(([, item]) => item);
    const left = Array.from(prev.entries())
      .filter(([id]) => !next.has(id))
      .map(([, item]) => item);

    let handled = false;
    if (left.length > 0 && hover.onLeave) {
      handled = this.isHandled(hover.onLeave({ items: left, ctx: this.ctx, event }));
    }
    if (entered.length > 0 && hover.onEnter) {
      handled = this.isHandled(hover.onEnter({ items: entered, ctx: this.ctx, event })) || handled;
    }

    if (hover.state) {
      this.applyState(left, hover.state, false);
      this.applyState(entered, hover.state, true);
    }

    this.hoverItems.set(entry.descriptor.id, next);
    return handled;
  }

  private processSelect(
    entry: LayerEntry,
    select: NonNullable<NonNullable<LayerEntry['descriptor']['feature']['interactions']>['select']>,
    items: Array<HitItem<any, any>>,
    event: MapBrowserEvent<UIEvent>,
  ): boolean {
    if (items.length === 0) {
      const prev = this.selectedItems.get(entry.descriptor.id);
      this.selectedItems.set(entry.descriptor.id, new Map());
      if (select.onClear) {
        const handled = this.isHandled(select.onClear({ ctx: this.ctx, event }));
        if (select.state && prev) {
          this.applyState(Array.from(prev.values()), select.state, false);
        }
        return handled;
      }
      if (select.state && prev) {
        this.applyState(Array.from(prev.values()), select.state, false);
      }
      return false;
    }

    const prev = this.selectedItems.get(entry.descriptor.id) ?? new Map();
    const next = this.itemsToMap(entry, items);
    const handled = select.onSelect
      ? this.isHandled(select.onSelect({ items, ctx: this.ctx, event }))
      : false;
    if (select.state) {
      const added = Array.from(next.entries())
        .filter(([id]) => !prev.has(id))
        .map(([, item]) => item);
      const removed = Array.from(prev.entries())
        .filter(([id]) => !next.has(id))
        .map(([, item]) => item);
      this.applyState(removed, select.state, false);
      this.applyState(added, select.state, true);
    }
    this.selectedItems.set(entry.descriptor.id, next);
    return handled;
  }

  private processClick(
    entry: LayerEntry,
    click: NonNullable<NonNullable<LayerEntry['descriptor']['feature']['interactions']>['click']>,
    items: Array<HitItem<any, any>>,
    event: MapBrowserEvent<UIEvent>,
  ): boolean {
    if (items.length === 0) {
      return false;
    }
    return this.isHandled(click.onClick({ items, ctx: this.ctx, event }));
  }

  private processDoubleClick(
    entry: LayerEntry,
    doubleClick: NonNullable<
      NonNullable<LayerEntry['descriptor']['feature']['interactions']>['doubleClick']
    >,
    items: Array<HitItem<any, any>>,
    event: MapBrowserEvent<UIEvent>,
  ): boolean {
    if (items.length === 0) {
      return false;
    }
    return this.isHandled(doubleClick.onDoubleClick({ items, ctx: this.ctx, event }));
  }

  private itemsToMap(
    entry: LayerEntry,
    items: Array<HitItem<any, any>>,
  ): Map<string | number, HitItem<any, any>> {
    const next = new Map<string | number, HitItem<any, any>>();
    items.forEach((item) => {
      const id = entry.descriptor.feature.id(item.model);
      next.set(id, item);
    });
    return next;
  }

  private applyState(items: Array<HitItem<any, any>>, state: FeatureState, enabled: boolean): void {
    const states = Array.isArray(state) ? state : [state];
    items.forEach((item) => {
      const current = new Set(getFeatureStates(item.feature));
      states.forEach((entry) => {
        if (enabled) {
          current.add(entry);
        } else {
          current.delete(entry);
        }
      });
      setFeatureStates(item.feature, Array.from(current));
    });
  }

  private isHandled(result: InteractionHandlerResult): boolean {
    return result === true;
  }

  private shouldStopPropagation(base: InteractionBase): boolean {
    return base.propagation !== 'continue';
  }

  private shouldContinuePropagation(base: InteractionBase): boolean {
    return base.propagation === 'continue';
  }
}
