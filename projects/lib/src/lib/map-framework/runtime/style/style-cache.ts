import type Style from 'ol/style/Style';

export type StyleCacheKey = string | object;

export class StyleCache {
  private readonly stringCache = new Map<string, Style | Style[]>();
  private readonly objectCache = new WeakMap<object, Style | Style[]>();

  get(key: StyleCacheKey): Style | Style[] | undefined {
    if (typeof key === 'string') {
      return this.stringCache.get(key);
    }
    return this.objectCache.get(key);
  }

  set(key: StyleCacheKey, value: Style | Style[]): void {
    if (typeof key === 'string') {
      this.stringCache.set(key, value);
      return;
    }
    this.objectCache.set(key, value);
  }
}
