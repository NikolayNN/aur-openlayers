import type Style from 'ol/style/Style';

export type StyleCacheKey = string;

export class StyleCache {
  private readonly stringCache = new Map<string, Style | Style[]>();

  get(key: StyleCacheKey): Style | Style[] | undefined {
    return this.stringCache.get(key);
  }

  set(key: StyleCacheKey, value: Style | Style[]): void {
    this.stringCache.set(key, value);
  }
}
