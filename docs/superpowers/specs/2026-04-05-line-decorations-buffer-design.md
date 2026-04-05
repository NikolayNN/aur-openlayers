# Line Decorations: Buffer Polygon Along LineString

## Summary

Declarative mechanism for rendering a buffer polygon (corridor) around LineString geometries, configured as part of a layer's `FeatureDescriptor.decorations`. The library handles buffer polygon generation, internal layer management, dynamic updates, and lifecycle automatically.

## Motivation

Visualizing a coverage corridor along a route (e.g., 500m zone from a road) currently requires manually computing a buffer polygon, managing a separate layer, and keeping it in sync with the source line on geometry changes. This can be eliminated by declaring a `buffer` decoration alongside the LineString layer descriptor — the same pattern already established by arrow decorations.

## API

### New Type (in `types.ts`)

```typescript
export type BufferDecoration = {
  /** Buffer width in meters (one side — total corridor width = distance * 2). */
  distance: number;

  /** OpenLayers Style for the buffer polygon. */
  style: Style | Style[];

  /** End cap style. Default: 'round'. */
  cap?: 'round' | 'flat';
};
```

### Extended `LineDecorations`

```typescript
export type LineDecorations = {
  arrows?: ArrowDecoration;
  buffer?: BufferDecoration;
};
```

### Usage Example

```typescript
{
  id: 'route-line',
  zIndex: 1,
  feature: {
    id: (m: RouteLine) => m.id,
    geometry: { fromModel, applyGeometryToModel },
    style: {
      base: () => ({ color: '#2563eb', width: 4 }),
      render: (opts) => new Style({ stroke: new Stroke({ ... }) }),
    },
    decorations: {
      buffer: {
        distance: 500,
        style: new Style({
          fill: new Fill({ color: 'rgba(37, 99, 235, 0.15)' }),
          stroke: new Stroke({ color: '#2563eb', width: 1 }),
        }),
        cap: 'round',
      },
      arrows: {
        interval: (view) => Math.max(100, view.resolution * 80),
        style: ({ rotation }) => new Style({
          image: new RegularShape({
            points: 3, radius: 6, rotation,
            fill: new Fill({ color: '#2563eb' }),
            stroke: new Stroke({ color: '#fff', width: 1 }),
          }),
        }),
      },
    },
  },
}
```

Buffer and arrows can be used independently or together.

## Internal Mechanics

### Decoration Layer Creation

When `LayerManager` processes a descriptor with `decorations.buffer`, it:

1. Creates an internal OL `VectorLayer` with its own `VectorSource` for buffer polygon features.
2. Sets `zIndex = parentZIndex` on the buffer layer (renders below the parent line).
3. The internal layer is not exposed in `MapContext.layers` — it is purely visual.
4. No interactions are registered on the internal layer.

### Z-Index Stack (bottom to top)

```
__decoration_buffer  (zIndex: parentZIndex)
parentLayer          (zIndex: parentZIndex + 1)
__decoration_arrows  (zIndex: parentZIndex + 2)
```

When buffer decorations are introduced, arrow decoration zIndex shifts to `parentZIndex + 2` to leave room. If only arrows are used without buffer, the gap in zIndex is harmless.

### Recalculation Triggers

Buffer polygon features are recalculated on:

- **Parent layer model changes** — `setModels`, `addModel`, `addModels`, `removeModelsById`, `clear`, and `mutate`/`mutateMany` that change geometry.
- **`map.on('moveend')`** — for visibility sync check.

Recalculation is throttled via `requestAnimationFrame` to avoid overload during rapid drag operations.

### Buffer Generation Algorithm (`generateBufferPolygon`)

**Input:** `coords: number[][]`, `distance: number` (meters), `cap: 'round' | 'flat'`

**Step 1 — Per-segment distance conversion:**
- For each segment, compute the average latitude: convert midpoint from EPSG:3857 to EPSG:4326.
- Compute projected distance: `projectedDistance = distance / cos(latitude * PI / 180)`.

**Step 2 — Offset curves:**
- For each segment, compute the unit normal: `nx = -(by - ay) / segLen`, `ny = (bx - ax) / segLen`.
- Left offset point: `[x + nx * projDist, y + ny * projDist]`.
- Right offset point: `[x - nx * projDist, y - ny * projDist]`.

**Step 3 — Corner handling (joins):**
- At segment junctions, average the normals of adjacent segments (miter join).
- If the miter ratio exceeds 2, fall back to bevel to prevent spikes.

**Step 4 — End caps:**
- `'flat'`: connect left and right offset curve endpoints directly.
- `'round'`: generate a semicircle of ~8 points at each end of the line.

**Step 5 — Polygon assembly:**
- Concatenate: left offset curve → end cap → reversed right offset curve → start cap → close ring.
- Return as OL `Polygon` geometry.

### Geometry Extraction

Reuses the same `extractLineCoords` pattern as arrow decorations:
- `LineString` → single coordinate array
- `MultiLineString` → one buffer polygon per sub-line
- Other geometry types → ignored silently

### Performance

- RAF-throttled rebuild prevents recalculation storms during fast drag.
- Style is set directly on features (no style function on the layer).
- Buffer polygon vertex count is proportional to line vertex count (not resolution-dependent), so it stays lightweight.

### Lifecycle

- Parent `setVisible(false)` hides the buffer layer and clears its source.
- `setOpacity` is synchronized.
- `LayerManager.dispose()` removes the internal layer and all subscriptions.

## Edge Cases

| Case | Behavior |
|------|----------|
| Empty layer / no features | No buffer generated, internal layer empty |
| MultiLineString geometry | One buffer polygon per sub-line |
| Line with single point | Skipped — no buffer generated |
| Line with two points | Rectangle with caps |
| Self-intersecting offset curve (sharp bends) | Polygon self-overlaps visually; acceptable for visual corridor |
| Non-LineString geometry with `decorations.buffer` | Ignored silently |
| Parent visibility toggled | Buffer layer visibility synchronized |
| Parent opacity changed | Buffer layer opacity synchronized |
| Very large distance (> segment length) | Miter/bevel prevents spikes; visual accuracy degrades but remains usable |

## Scope

- **In scope:** `buffer` decoration type for LineString/MultiLineString with configurable distance, style, and end caps.
- **Out of scope:** Geodesically precise buffer calculation, functional buffer geometry (hit-testing, spatial queries), buffer width as function of zoom.

## Files to Modify

- `projects/lib/src/lib/map-framework/public/types.ts` — add `BufferDecoration`, extend `LineDecorations`
- `projects/lib/src/lib/map-framework/runtime/layer-manager.ts` — detect `decorations.buffer`, create `BufferDecorationManager`, adjust arrow zIndex to `+2`
- New file: `projects/lib/src/lib/map-framework/runtime/decorations/buffer-decoration-manager.ts` — buffer polygon generation and internal layer management
- New file: `projects/lib/src/lib/map-framework/runtime/decorations/generate-buffer-polygon.ts` — pure function for offset curve algorithm
- `projects/lib/src/lib/map-framework/runtime/decorations/arrow-decoration-manager.ts` — update zIndex from `+1` to `+2` unconditionally (regardless of whether buffer is present, to keep the z-index scheme consistent)
- `projects/lib/src/public-api.ts` — export `BufferDecoration`

## Testing

### Unit tests: `generateBufferPolygon`
- Straight horizontal line → rectangle with correct width
- Straight vertical line → rectangle
- Two-point line + `cap: 'round'` → rectangle with semicircles
- Two-point line + `cap: 'flat'` → rectangle
- Line with sharp angle → miter/bevel handles correctly
- Single point → empty result
- MultiLineString → one polygon per sub-line

### Unit tests: `BufferDecorationManager`
- Layer created with correct zIndex (below parent)
- Polygon features generated for LineString
- Updates when geometry changes
- Visibility/opacity sync with parent layer
- Cleanup on dispose

### Integration test in `LayerManager`
- Layer with `decorations: { buffer: {...}, arrows: {...} }` creates both managers
- Z-index ordering: buffer < parent < arrows
- `dispose()` cleans up both
