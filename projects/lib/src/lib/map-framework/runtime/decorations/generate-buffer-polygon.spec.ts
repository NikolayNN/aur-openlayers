import { generateBufferPolygon } from './generate-buffer-polygon';

describe('generateBufferPolygon', () => {
  it('returns empty array for a single point', () => {
    const result = generateBufferPolygon([[0, 0]], 100, 'flat');
    expect(result.length).toBe(0);
  });

  it('returns empty array for empty coords', () => {
    const result = generateBufferPolygon([], 100, 'flat');
    expect(result.length).toBe(0);
  });

  it('generates a flat-capped buffer for a horizontal two-point line', () => {
    // Horizontal line from [0,0] to [1000,0], distance=100 (near equator, proj ≈ meters)
    const ring = generateBufferPolygon([[0, 0], [1000, 0]], 100, 'flat');
    expect(ring.length).toBeGreaterThan(0);

    // Ring should be closed
    expect(ring[0][0]).toBeCloseTo(ring[ring.length - 1][0], 5);
    expect(ring[0][1]).toBeCloseTo(ring[ring.length - 1][1], 5);

    // Check width: left side Y ≈ +100, right side Y ≈ -100
    const ys = ring.map((c: number[]) => c[1]);
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);
    expect(maxY).toBeCloseTo(100, -1); // ~100 (proj units near equator)
    expect(minY).toBeCloseTo(-100, -1);
  });

  it('generates a flat-capped buffer for a vertical two-point line', () => {
    // Vertical line from [0,0] to [0,1000], distance=50
    const ring = generateBufferPolygon([[0, 0], [0, 1000]], 50, 'flat');
    expect(ring.length).toBeGreaterThan(0);

    const xs = ring.map((c: number[]) => c[0]);
    const maxX = Math.max(...xs);
    const minX = Math.min(...xs);
    expect(maxX).toBeCloseTo(50, -1);
    expect(minX).toBeCloseTo(-50, -1);
  });

  it('generates round end caps with extra vertices', () => {
    const flatRing = generateBufferPolygon([[0, 0], [1000, 0]], 100, 'flat');
    const roundRing = generateBufferPolygon([[0, 0], [1000, 0]], 100, 'round');
    // Round caps add semicircle vertices at each end
    expect(roundRing.length).toBeGreaterThan(flatRing.length);
  });

  it('handles a line with a sharp turn (miter/bevel)', () => {
    // Right angle: go right 1000, then go up 1000
    const ring = generateBufferPolygon([[0, 0], [1000, 0], [1000, 1000]], 100, 'flat');
    expect(ring.length).toBeGreaterThan(0);

    // Should not produce extreme miter spikes — all points within reasonable bounds
    for (const [x, y] of ring) {
      expect(x).toBeGreaterThan(-300);
      expect(x).toBeLessThan(1300);
      expect(y).toBeGreaterThan(-300);
      expect(y).toBeLessThan(1300);
    }
  });

  it('returns zero distance produces degenerate (zero-width) polygon', () => {
    const ring = generateBufferPolygon([[0, 0], [1000, 0]], 0, 'flat');
    // With zero distance, all Y values should be ~0
    for (const [, y] of ring) {
      expect(y).toBeCloseTo(0, 5);
    }
  });
});
