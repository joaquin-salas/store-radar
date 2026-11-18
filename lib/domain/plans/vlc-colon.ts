/**
 * Valencia Colón — hand-made floor plan of a small neighbourhood store
 * (30 × 20 m, 600 m²). Door off-centre on the left with the till right next
 * to it, womenswear across the back-left, menswear front-right behind the
 * display window, six fitting cubicles in a row along the back wall and a
 * small stock room. No kids zone.
 */
import type { PlanSpec } from "../layout";

const rack = (x: number, y: number, w: number, h = 0.7) => ({ kind: "rack" as const, x, y, w, h });

const cubicles = [0, 1, 2, 3, 4, 5].map((i) => ({
  kind: "cubicle" as const,
  x: 18.2 + i * 1.28,
  y: 0.3,
  w: 1.22,
  h: 2.6,
  open: "bottom" as const,
}));

export const VLC_COLON: PlanSpec = {
  width: 30,
  depth: 20,
  outline: [
    [0, 0],
    [30, 0],
    [30, 20],
    [0, 20],
  ],
  door: { x1: 3, x2: 7 },
  glass: [
    [
      [0.6, 20],
      [2.4, 20],
    ],
    [
      [7.6, 20],
      [17.4, 20],
    ],
    [
      [18.6, 20],
      [29.4, 20],
    ],
  ],
  columns: [[9, 6.3]],
  staffAreas: [
    {
      label: "Stock",
      polygon: [
        [26, 0],
        [30, 0],
        [30, 6],
        [26, 6],
      ],
    },
  ],
  streetLabel: "Carrer de Colón",
  zones: [
    {
      zone: "womenswear",
      polygon: [
        [0, 0],
        [18, 0],
        [18, 13],
        [0, 13],
      ],
      labelAt: [1.6, 1.4],
      anchor: [9, 9],
    },
    {
      zone: "fitting-rooms",
      polygon: [
        [18, 0],
        [26, 0],
        [26, 6],
        [18, 6],
      ],
      labelAt: [18.4, 3.4],
      anchor: [22, 4.8],
      shortLabel: "Fitting",
    },
    {
      zone: "menswear",
      polygon: [
        [18, 6],
        [30, 6],
        [30, 20],
        [18, 20],
      ],
      labelAt: [18.6, 6.4],
      anchor: [24, 13],
    },
    {
      zone: "entrance",
      polygon: [
        [0, 13],
        [10, 13],
        [10, 20],
        [0, 20],
      ],
      labelAt: [0.6, 13.4],
      anchor: [5, 17],
    },
    {
      zone: "checkout",
      polygon: [
        [10, 13],
        [18, 13],
        [18, 20],
        [10, 20],
      ],
      labelAt: [10.5, 13.4],
      anchor: [16.5, 18.7],
    },
  ],
  fixtures: [
    // Womenswear: back and side wall shelving, two banks of racks, two tables.
    { kind: "shelf", x: 0.5, y: 0.3, w: 17.2, h: 0.7 },
    { kind: "shelf", x: 0.3, y: 3, w: 0.7, h: 9 },
    ...[4.5, 8].flatMap((y) => [rack(2.5, y, 5), rack(10.5, y, 5)]),
    { kind: "table", cx: 6, cy: 11.3, r: 0.9 },
    { kind: "table", cx: 13, cy: 11.3, r: 0.9 },
    // Fitting rooms: six cubicles along the back wall, curtains facing the room.
    ...cubicles,
    // Menswear: racks, side wall shelving, a table, the display window.
    ...[9.2, 12.6].flatMap((y) => [rack(19.5, y, 4.5), rack(24.5, y, 4)]),
    { kind: "shelf", x: 29.2, y: 7, w: 0.6, h: 8 },
    { kind: "table", cx: 23, cy: 16, r: 1 },
    { kind: "window", x: 19, y: 18.6, w: 10, h: 1.2 },
    // Entrance: a plinth with mannequins beside the door.
    { kind: "plinth", x: 7.7, y: 16.2, w: 1.8, h: 2.8 },
    // Checkout: counter facing the door, two tills, a short queue lane.
    { kind: "counter", x: 11, y: 15.6, w: 6, h: 1 },
    { kind: "till", x: 12, y: 15.75, w: 1.2, h: 0.7 },
    { kind: "till", x: 14.8, y: 15.75, w: 1.2, h: 0.7 },
    { kind: "barrier", x1: 10.5, y1: 18, x2: 15.5, y2: 18 },
  ],
  sensors: [
    { type: "street-counter", zone: "street", x: 5, y: 25.9, rangeM: 5 },
    { type: "zone-sensor", zone: "entrance", x: 5, y: 15.2, rangeM: 4 },
    { type: "zone-sensor", zone: "womenswear", x: 5, y: 6.5, rangeM: 6 },
    { type: "zone-sensor", zone: "womenswear", x: 13.5, y: 6.5, rangeM: 6 },
    { type: "zone-sensor", zone: "fitting-rooms", x: 22, y: 4.4, rangeM: 4 },
    { type: "zone-sensor", zone: "menswear", x: 24, y: 11, rangeM: 6 },
    { type: "checkout-sensor", zone: "checkout", x: 16.5, y: 17.4, rangeM: 4 },
  ],
};
