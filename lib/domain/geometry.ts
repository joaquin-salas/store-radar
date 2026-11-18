/** Small 2D helpers for floor plans. Coordinates are metres, y grows downwards. */

export type Point = readonly [number, number];
export type Polygon = readonly Point[];

/** Ray-casting point-in-polygon test. */
export function inPolygon([x, y]: Point, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Absolute area (shoelace formula). */
export function polygonArea(polygon: Polygon): number {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
  }
  return Math.abs(sum) / 2;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function polygonBounds(polygon: Polygon): Bounds {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export const rectPolygon = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

export const toSvgPoints = (polygon: Polygon) => polygon.map((p) => `${p[0]},${p[1]}`).join(" ");

/** Shortest distance from a point to the polygon's edges. */
export function distanceToEdges([x, y]: Point, polygon: Polygon): number {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j];
    const [bx, by] = polygon[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}
