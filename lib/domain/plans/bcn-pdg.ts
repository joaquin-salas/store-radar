/**
 * Barcelona Passeig de Gràcia — hand-made floor plan (50 × 32 m, ≈ 1,560 m²).
 * An Eixample building: a 9 m chamfered corner ("xamfrà") glazed as a corner
 * display window, a light well ("pati de llums") at the back, round cast-iron
 * columns. Door in the middle of the façade with an entrance runway,
 * womenswear wrapping the left side, menswear on the right, fitting rooms at
 * the back, an L-shaped kids corner and the checkout front-right.
 */
import type { PlanSpec } from "../layout";

const cubicles = [0, 1, 2, 3, 4].flatMap((i) => [
  { kind: "cubicle" as const, x: 22.3, y: 7.2 + i * 1.55, w: 3.2, h: 1.45, open: "right" as const },
  { kind: "cubicle" as const, x: 28.5, y: 7.2 + i * 1.55, w: 3.2, h: 1.45, open: "left" as const },
]);

const rack = (x: number, y: number, w: number, h = 0.7) => ({ kind: "rack" as const, x, y, w, h });

export const BCN_PDG: PlanSpec = {
  width: 50,
  depth: 32,
  outline: [
    [0, 0],
    [50, 0],
    [50, 32],
    [9, 32],
    [0, 23],
  ],
  door: { x1: 25, x2: 31 },
  glass: [
    [
      [0.6, 23.6],
      [8.4, 31.4],
    ],
    [
      [10, 32],
      [24.4, 32],
    ],
    [
      [31.6, 32],
      [49.4, 32],
    ],
  ],
  columns: [
    [11, 9],
    [11, 19],
    [33, 17],
    [44, 17],
  ],
  columnStyle: "round",
  staffAreas: [
    {
      label: "Stock",
      polygon: [
        [40, 0],
        [50, 0],
        [50, 10],
        [40, 10],
      ],
    },
    {
      label: "Light well",
      polygon: [
        [22, 0],
        [28, 0],
        [28, 5],
        [22, 5],
      ],
    },
  ],
  streetLabel: "Passeig de Gràcia",
  zones: [
    {
      zone: "womenswear",
      polygon: [
        [0, 0],
        [22, 0],
        [22, 22],
        [19, 22],
        [19, 32],
        [9, 32],
        [0, 23],
      ],
      labelAt: [1.6, 1.4],
      anchor: [10, 15],
    },
    {
      zone: "fitting-rooms",
      polygon: [
        [22, 5],
        [32, 5],
        [32, 15],
        [22, 15],
      ],
      labelAt: [22.5, 5.3],
      anchor: [27, 11],
      shortLabel: "Fitting",
    },
    {
      zone: "kids",
      polygon: [
        [28, 0],
        [40, 0],
        [40, 10],
        [32, 10],
        [32, 5],
        [28, 5],
      ],
      labelAt: [29, 1.2],
      anchor: [35, 6],
    },
    {
      zone: "menswear",
      polygon: [
        [22, 15],
        [32, 15],
        [32, 10],
        [50, 10],
        [50, 22],
        [22, 22],
      ],
      labelAt: [22.5, 15.4],
      anchor: [40, 16],
    },
    {
      zone: "entrance",
      polygon: [
        [19, 22],
        [37, 22],
        [37, 32],
        [19, 32],
      ],
      labelAt: [19.5, 22.4],
      anchor: [24, 28.5],
    },
    {
      zone: "checkout",
      polygon: [
        [37, 22],
        [50, 22],
        [50, 32],
        [37, 32],
      ],
      labelAt: [37.5, 22.4],
      anchor: [44, 29.8],
    },
  ],
  fixtures: [
    // Womenswear: back and side wall shelving, two banks of racks either side of
    // the columns, tables by the corner window.
    { kind: "shelf", x: 0.5, y: 0.3, w: 21, h: 0.8 },
    { kind: "shelf", x: 0.3, y: 4, w: 0.8, h: 17 },
    ...[5, 9, 13, 17, 21].flatMap((y) => [rack(3, y, 5.5), rack(13.5, y, 5.5)]),
    { kind: "table", cx: 8, cy: 27, r: 1 },
    { kind: "table", cx: 14, cy: 26, r: 1.1 },
    { kind: "window", x: 10, y: 30.6, w: 8, h: 1.2 },
    // Fitting rooms: two rows of 5 cubicles facing a corridor.
    ...cubicles,
    // Kids: wall shelving, low tables, a small rack.
    { kind: "shelf", x: 32.5, y: 0.3, w: 7.2, h: 0.7 },
    { kind: "table", cx: 38, cy: 3.4, r: 0.9 },
    { kind: "table", cx: 36, cy: 7, r: 0.8 },
    rack(32.8, 8.6, 5.5, 0.6),
    // Menswear: racks, side wall shelving, a table in the inner corner.
    ...[12.8, 19.5].flatMap((y) => [rack(34.5, y, 5), rack(40.5, y, 5)]),
    { kind: "shelf", x: 49.2, y: 11, w: 0.6, h: 10 },
    { kind: "table", cx: 27, cy: 18.5, r: 1.1 },
    // Entrance runway: plinths either side of the door and a feature table.
    { kind: "plinth", x: 20.5, y: 25, w: 4, h: 2 },
    { kind: "plinth", x: 31.5, y: 25, w: 4, h: 2 },
    { kind: "table", cx: 28, cy: 26.3, r: 1.2 },
    // Checkout: counter, tills, queue lane, display window.
    { kind: "counter", x: 39, y: 25, w: 10.5, h: 1.2 },
    { kind: "till", x: 41, y: 25.25, w: 1.2, h: 0.7 },
    { kind: "till", x: 44.5, y: 25.25, w: 1.2, h: 0.7 },
    { kind: "till", x: 48, y: 25.25, w: 1.2, h: 0.7 },
    { kind: "barrier", x1: 38.5, y1: 28.5, x2: 46, y2: 28.5 },
    { kind: "window", x: 38, y: 30.6, w: 11, h: 1.2 },
  ],
  sensors: [
    { type: "street-counter", zone: "street", x: 28, y: 37.8, rangeM: 6 },
    { type: "zone-sensor", zone: "entrance", x: 33.5, y: 28.5, rangeM: 6 },
    { type: "zone-sensor", zone: "womenswear", x: 6, y: 7, rangeM: 8 },
    { type: "zone-sensor", zone: "womenswear", x: 16, y: 15, rangeM: 8 },
    { type: "zone-sensor", zone: "womenswear", x: 10, y: 26, rangeM: 7 },
    { type: "zone-sensor", zone: "fitting-rooms", x: 27, y: 10, rangeM: 6 },
    { type: "zone-sensor", zone: "kids", x: 34.5, y: 4, rangeM: 6 },
    { type: "zone-sensor", zone: "menswear", x: 29, y: 19.5, rangeM: 7 },
    { type: "zone-sensor", zone: "menswear", x: 42, y: 15, rangeM: 8 },
    { type: "checkout-sensor", zone: "checkout", x: 44, y: 27, rangeM: 6 },
  ],
};
