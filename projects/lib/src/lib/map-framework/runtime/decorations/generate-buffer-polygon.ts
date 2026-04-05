import { toLonLat } from 'ol/proj';

/**
 * Compute projected buffer distance for a segment by converting meters
 * to EPSG:3857 units using the segment's average latitude.
 */
function projectedDistance(ax: number, ay: number, bx: number, by: number, meters: number): number {
  const midY = (ay + by) / 2;
  const [, lat] = toLonLat([0, midY]);
  const scale = Math.cos((lat * Math.PI) / 180);
  return scale > 1e-10 ? meters / scale : meters;
}

/**
 * Compute the unit normal of a segment (pointing left when walking from a→b).
 */
function segmentNormal(ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [0, 0];
  return [-dy / len, dx / len];
}

/**
 * Generate a semicircle of points around a center, from startAngle to startAngle + PI.
 */
function semicircle(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  segments: number,
): number[][] {
  const points: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (Math.PI * i) / segments;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

/**
 * Generate a closed polygon ring representing a buffer around a polyline.
 *
 * @param coords Line vertices in EPSG:3857.
 * @param distance Buffer width in meters (one side).
 * @param cap End cap style: 'round' or 'flat'.
 * @returns Closed ring (first == last point), or empty array if line is degenerate.
 */
export function generateBufferPolygon(
  coords: number[][],
  distance: number,
  cap: 'round' | 'flat',
): number[][] {
  if (coords.length < 2) return [];

  const n = coords.length;
  const left: number[][] = [];
  const right: number[][] = [];

  // Compute per-vertex offset using averaged normals at joins
  for (let i = 0; i < n; i++) {
    let nx: number, ny: number, dist: number;

    if (i === 0) {
      // First vertex — use first segment's normal
      dist = projectedDistance(coords[0][0], coords[0][1], coords[1][0], coords[1][1], distance);
      [nx, ny] = segmentNormal(coords[0][0], coords[0][1], coords[1][0], coords[1][1]);
    } else if (i === n - 1) {
      // Last vertex — use last segment's normal
      dist = projectedDistance(coords[n - 2][0], coords[n - 2][1], coords[n - 1][0], coords[n - 1][1], distance);
      [nx, ny] = segmentNormal(coords[n - 2][0], coords[n - 2][1], coords[n - 1][0], coords[n - 1][1]);
    } else {
      // Interior vertex — average normals of adjacent segments
      const dist1 = projectedDistance(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1], distance);
      const dist2 = projectedDistance(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1], distance);
      dist = (dist1 + dist2) / 2;

      const [n1x, n1y] = segmentNormal(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      const [n2x, n2y] = segmentNormal(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);

      nx = n1x + n2x;
      ny = n1y + n2y;
      const len = Math.hypot(nx, ny);

      if (len > 1e-10) {
        nx /= len;
        ny /= len;
        // Miter length factor: 1 / cos(half-angle between segments)
        const dot = n1x * nx + n1y * ny;
        const miterScale = dot > 0.5 ? 1 / dot : 2; // Clamp miter at ratio 2 to prevent spikes
        dist *= miterScale;
      } else {
        [nx, ny] = segmentNormal(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      }
    }

    const x = coords[i][0];
    const y = coords[i][1];
    left.push([x + nx * dist, y + ny * dist]);
    right.push([x - nx * dist, y - ny * dist]);
  }

  // Assemble the polygon ring: left forward → end cap → right backward → start cap → close
  const ring: number[][] = [];

  // Left side (forward)
  for (let i = 0; i < n; i++) {
    ring.push(left[i]);
  }

  // End cap
  if (cap === 'round') {
    const [n2x, n2y] = segmentNormal(coords[n - 2][0], coords[n - 2][1], coords[n - 1][0], coords[n - 1][1]);
    const endAngle = Math.atan2(-n2y, -n2x);
    const dist = projectedDistance(coords[n - 2][0], coords[n - 2][1], coords[n - 1][0], coords[n - 1][1], distance);
    ring.push(...semicircle(coords[n - 1][0], coords[n - 1][1], dist, endAngle, 8));
  } else {
    ring.push(right[n - 1]);
  }

  // Right side (backward)
  for (let i = n - 2; i >= 0; i--) {
    ring.push(right[i]);
  }

  // Start cap
  if (cap === 'round') {
    const [n1x, n1y] = segmentNormal(coords[0][0], coords[0][1], coords[1][0], coords[1][1]);
    const startAngle = Math.atan2(n1y, n1x);
    const dist = projectedDistance(coords[0][0], coords[0][1], coords[1][0], coords[1][1], distance);
    ring.push(...semicircle(coords[0][0], coords[0][1], dist, startAngle, 8));
  }

  // Close ring
  ring.push(ring[0].slice());

  return ring;
}
