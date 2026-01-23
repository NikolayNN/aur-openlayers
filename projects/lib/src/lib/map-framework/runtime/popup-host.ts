import type { Enabled, PopupHostApi, PopupItem } from '../public/types';

export type PopupHostOptions = {
  enabled?: Enabled;
  maxItems?: number;
  sort?: (a: PopupItem<any>, b: PopupItem<any>) => number;
  mount?: HTMLElement | (() => HTMLElement);
};

type ItemWithIndex = { item: PopupItem<any>; index: number };

export class PopupHost implements PopupHostApi {
  private items: PopupItem<any>[] = [];
  private container: HTMLElement | null = null;
  private target: HTMLElement | null = null;

  constructor(private readonly options: PopupHostOptions = {}) {
    if (options.mount) {
      this.mount(options.mount);
    }
  }

  push(items: PopupItem<any>[]): void {
    if (!this.ensureEnabled()) {
      return;
    }
    this.items = this.prepareItems([...this.items, ...items]);
    this.render();
  }

  set(items: PopupItem<any>[]): void {
    if (!this.ensureEnabled()) {
      return;
    }
    this.items = this.prepareItems(items);
    this.render();
  }

  clear(): void {
    if (!this.ensureEnabled()) {
      return;
    }
    this.items = [];
    this.render();
  }

  remove(key: string | number): void {
    if (!this.ensureEnabled()) {
      return;
    }
    this.items = this.items.filter((item) => this.getDedupKey(item) !== key);
    this.render();
  }

  getItems(): PopupItem<any>[] {
    if (!this.isEnabled()) {
      return [];
    }
    return [...this.items];
  }

  mount(target: HTMLElement | (() => HTMLElement)): void {
    if (!this.ensureEnabled()) {
      return;
    }
    const element = typeof target === 'function' ? target() : target;
    if (!element) {
      return;
    }
    if (this.target !== element) {
      this.unmount();
    }
    this.target = element;
    this.render();
  }

  dispose(): void {
    this.unmount();
    this.items = [];
  }

  private ensureEnabled(): boolean {
    if (this.isEnabled()) {
      return true;
    }
    this.items = [];
    this.unmount();
    return false;
  }

  private isEnabled(): boolean {
    const enabled = this.options.enabled;
    if (enabled === undefined) {
      return true;
    }
    return typeof enabled === 'function' ? enabled() : enabled;
  }

  private unmount(): void {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
    this.target = null;
  }

  private prepareItems(items: PopupItem<any>[]): PopupItem<any>[] {
    const deduped = this.dedup(items);
    const sorted = this.applySort(deduped);
    return this.applyLimit(sorted);
  }

  private dedup(items: PopupItem<any>[]): PopupItem<any>[] {
    const result: PopupItem<any>[] = [];
    const indices = new Map<string | number, number>();
    items.forEach((item) => {
      const key = this.getDedupKey(item);
      if (key === undefined) {
        result.push(item);
        return;
      }
      const existingIndex = indices.get(key);
      if (existingIndex !== undefined) {
        result[existingIndex] = item;
        return;
      }
      indices.set(key, result.length);
      result.push(item);
    });
    return result;
  }

  private applySort(items: PopupItem<any>[]): PopupItem<any>[] {
    const comparator = this.options.sort ?? this.defaultSort;
    const withIndex: ItemWithIndex[] = items.map((item, index) => ({ item, index }));
    withIndex.sort((a, b) => {
      const result = comparator(a.item, b.item);
      if (result !== 0) {
        return result;
      }
      return a.index - b.index;
    });
    return withIndex.map((entry) => entry.item);
  }

  private applyLimit(items: PopupItem<any>[]): PopupItem<any>[] {
    if (this.options.maxItems === undefined) {
      return items;
    }
    return items.slice(0, this.options.maxItems);
  }

  private getDedupKey(item: PopupItem<any>): string | number | undefined {
    if (item.dedupKey !== undefined) {
      return item.dedupKey;
    }
    const model = item.model as { id?: string | number };
    if (model && (typeof model.id === 'string' || typeof model.id === 'number')) {
      return model.id;
    }
    return undefined;
  }

  private defaultSort(a: PopupItem<any>, b: PopupItem<any>): number {
    const aPriority = a.priority ?? 0;
    const bPriority = b.priority ?? 0;
    return bPriority - aPriority;
  }

  private render(): void {
    if (!this.target) {
      return;
    }
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'mf-popup-host';
      this.target.appendChild(this.container);
    }
    this.container.innerHTML = '';
    this.items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'mf-popup-item';
      if (item.className) {
        card.classList.add(item.className);
      }
      if (typeof item.content === 'string') {
        card.textContent = item.content;
      } else {
        card.appendChild(item.content);
      }
      const key = this.getDedupKey(item);
      if (key !== undefined) {
        const close = document.createElement('button');
        close.type = 'button';
        close.dataset['popupClose'] = String(key);
        close.textContent = '×';
        close.addEventListener('click', () => this.remove(key));
        card.appendChild(close);
      }
      this.container!.appendChild(card);
    });
  }
}
