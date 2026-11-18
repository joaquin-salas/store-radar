/**
 * Madrid Gran Vía — hand-made floor plan of the 60 × 40 m flagship (≈ 2,400 m²).
 * Corner building (chamfered front-right), L-shaped womenswear, a stock room
 * that is never tracked, fitting cubicles along a corridor, and a checkout
 * with tills and a queue lane next to the exit. All units are metres.
 */
import type { PlanSpec } from "../layout";

const racks = (ys: number[], xs: number[], w: number, h = 0.7) =>
  ys.flatMap((y) => xs.map((x) => ({ kind: "rack" as const, x, y, w, h })));

const cubicles = [0, 1, 2, 3, 4].flatMap((i) => [
  { kind: "cubicle" as const, x: 30.3, y: 2.6 + i * 1.85, w: 3.4, h: 1.75, open: "right" as const },
  { kind: "cubicle" as const, x: 36.3, y: 2.6 + i * 1.85, w: 3.4, h: 1.75, open: "left" as const },
]);

export const MAD_GRANVIA: PlanSpec = {
  width: 60,
  depth: 40,
  outline: [
    [0, 0],
    [60, 0],
    [60, 34],
    [54, 40],
    [0, 40],
  ],
  door: { x1: 27, x2: 33 },
  glass: [
    [
      [1, 40],
      [19, 40],
    ],
    [
      [21, 40],
      [26, 40],
    ],
    [
      [34, 40],
      [39, 40],
    ],
    [
      [41, 40],
      [53.3, 40],
    ],
    [
      [54.7, 39.3],
      [59.3, 34.7],
    ],
  ],
  columns: [
    [12, 13],
    [12, 25],
    [27, 12.6],
    [44, 26],
    [56, 26],
  ],
  staffAreas: [
    {
      label: "Stock · staff only",
      polygon: [
        [0, 0],
        [12, 0],
        [12, 9],
        [0, 9],
      ],
    },
  ],
  streetLabel: "Gran Vía",
  zones: [
    {
      zone: "womenswear",
      polygon: [
        [0, 9],
        [12, 9],
        [12, 0],
        [30, 0],
        [30, 28],
        [20, 28],
        [20, 40],
        [0, 40],
      ],
      labelAt: [13, 2.1],
      anchor: [12, 22],
    },
    {
      zone: "fitting-rooms",
      polygon: [
        [30, 0],
        [40, 0],
        [40, 12],
        [30, 12],
      ],
      labelAt: [30.5, 0.5],
      anchor: [35, 8],
      shortLabel: "Fitting",
    },
    {
      zone: "menswear",
      polygon: [
        [30, 12],
        [40, 12],
        [40, 0],
        [48, 0],
        [48, 14],
        [60, 14],
        [60, 28],
        [30, 28],
      ],
      labelAt: [30.6, 12.5],
      anchor: [46, 20],
    },
    {
      zone: "kids",
      polygon: [
        [48, 0],
        [60, 0],
        [60, 14],
        [48, 14],
      ],
      labelAt: [48.6, 0.5],
      anchor: [54, 8],
    },
    {
      zone: "entrance",
      polygon: [
        [20, 28],
        [40, 28],
        [40, 40],
        [20, 40],
      ],
      labelAt: [20.6, 28.5],
      anchor: [30, 34],
    },
    {
      zone: "checkout",
      polygon: [
        [40, 28],
        [60, 28],
        [60, 34],
        [54, 40],
        [40, 40],
      ],
      labelAt: [40.6, 28.5],
      anchor: [50, 36],
    },
  ],
  fixtures: [
    // Womenswear: two banks of racks, tables, back-wall shelving, mirror wall.
    ...racks([13, 17, 21, 25, 29, 33], [2.2], 5.6),
    ...racks([14.6, 17, 21, 26.6, 29, 33], [9.6], 5.6),
    { kind: "table", cx: 23.5, cy: 8.5, r: 1.1 },
    { kind: "table", cx: 23.5, cy: 16, r: 1.1 },
    { kind: "table", cx: 23.5, cy: 23.5, r: 1.1 },
    { kind: "shelf", x: 12.3, y: 0.3, w: 17.4, h: 0.8 },
    { kind: "mirror", x: 0.3, y: 15, w: 0.35, h: 12 },
    // Fitting rooms: 5 cubicles each side of a corridor, curtains facing it.
    ...cubicles,
    // Menswear.
    { kind: "shelf", x: 40.3, y: 0.3, w: 7.4, h: 0.8 },
    { kind: "table", cx: 44, cy: 7.5, r: 1.1 },
    ...racks([16.5, 20.5], [31.5, 42.5, 51.5], 6),
    { kind: "table", cx: 36, cy: 24.6, r: 1 },
    { kind: "table", cx: 50, cy: 24.6, r: 1 },
    // Kids.
    { kind: "table", cx: 51.5, cy: 5.5, r: 0.9 },
    { kind: "table", cx: 56.5, cy: 9.5, r: 0.9 },
    { kind: "rack", x: 49.5, y: 12, w: 6, h: 0.6 },
    { kind: "shelf", x: 59, y: 2.5, w: 0.7, h: 8 },
    // Entrance plinths with mannequins.
    { kind: "plinth", x: 21.6, y: 31, w: 4, h: 2.2 },
    { kind: "plinth", x: 34.4, y: 31, w: 4, h: 2.2 },
    // Display windows behind the shopfront glass.
    { kind: "window", x: 1, y: 38.4, w: 18, h: 1.3 },
    { kind: "window", x: 41, y: 38.4, w: 12, h: 1.3 },
    // Checkout: counter with a return, three tills, queue lane.
    { kind: "counter", x: 44, y: 31.3, w: 14.5, h: 1.2 },
    { kind: "counter", x: 57.3, y: 28.4, w: 1.2, h: 3 },
    { kind: "till", x: 46.2, y: 31.55, w: 1.2, h: 0.7 },
    { kind: "till", x: 50.2, y: 31.55, w: 1.2, h: 0.7 },
    { kind: "till", x: 54.2, y: 31.55, w: 1.2, h: 0.7 },
    { kind: "barrier", x1: 42, y1: 34.6, x2: 52, y2: 34.6 },
  ],
  sensors: [
    { type: "street-counter", zone: "street", x: 30, y: 45.6, rangeM: 7 },
    { type: "zone-sensor", zone: "entrance", x: 30, y: 30.5, rangeM: 8 },
    { type: "zone-sensor", zone: "womenswear", x: 6.5, y: 19, rangeM: 9 },
    { type: "zone-sensor", zone: "womenswear", x: 18, y: 9, rangeM: 9 },
    { type: "zone-sensor", zone: "womenswear", x: 14, y: 31, rangeM: 9 },
    { type: "zone-sensor", zone: "fitting-rooms", x: 35, y: 7, rangeM: 6 },
    { type: "zone-sensor", zone: "menswear", x: 37, y: 19, rangeM: 9 },
    { type: "zone-sensor", zone: "menswear", x: 54, y: 19, rangeM: 8 },
    { type: "zone-sensor", zone: "kids", x: 54, y: 7, rangeM: 7 },
    { type: "checkout-sensor", zone: "checkout", x: 50, y: 36.6, rangeM: 7 },
  ],
};
