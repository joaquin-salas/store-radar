"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ZONE_LABELS } from "@/lib/domain/catalog";
import { type Point, distanceToEdges, inPolygon, polygonBounds, toSvgPoints } from "@/lib/domain/geometry";
import {
  type Fixture,
  type FloorPlan as Plan,
  type PlanZone,
  SENSOR_LABELS,
  isBlocked,
} from "@/lib/domain/layout";
import { createRng } from "@/lib/domain/random";
import { formatDuration, formatInt, formatPercent } from "@/lib/format";
import type { LiveSnapshot } from "@/lib/queries";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ layers */

export type PlanLayer = "occupancy" | "people" | "sensors" | "flows";
export const PLAN_LAYERS: { id: PlanLayer; label: string }[] = [
  { id: "occupancy", label: "Occupancy" },
  { id: "people", label: "People" },
  { id: "sensors", label: "Sensors" },
  { id: "flows", label: "Flows" },
];
const DEFAULT_LAYERS: Record<PlanLayer, boolean> = {
  occupancy: true,
  people: true,
  sensors: false,
  flows: false,
};
const LAYERS_STORAGE_KEY = "store-radar:plan-layers";

/** Layer toggles, remembered per browser (a per-viewer convenience only). */
export function usePlanLayers() {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYERS_STORAGE_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read of browser storage after hydration
      if (saved && typeof saved === "object") setLayers((l) => ({ ...l, ...saved }));
    } catch {
      /* storage unavailable: keep defaults */
    }
  }, []);
  const toggle = (id: PlanLayer) =>
    setLayers((l) => {
      const next = { ...l, [id]: !l[id] };
      try {
        localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return { layers, toggle };
}

export function LayerToggles({
  layers,
  onToggle,
}: {
  layers: Record<PlanLayer, boolean>;
  onToggle: (id: PlanLayer) => void;
}) {
  const swatch: Record<PlanLayer, string> = {
    occupancy: "bg-[linear-gradient(90deg,var(--plan-heat-1),var(--plan-heat-5))] rounded-xs",
    people: "bg-[var(--plan-person)] rounded-full",
    sensors: "bg-status-good rounded-full",
    flows: "bg-highlight rounded-xs",
  };
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Floor plan layers">
      {PLAN_LAYERS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={layers[id]}
          onClick={() => onToggle(id)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
            "focus-visible:outline-ring outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
            layers[id]
              ? "border-line-control bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground border-border hover:bg-muted",
          )}
        >
          <span className={cn("size-2.5", swatch[id], !layers[id] && "opacity-50")} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

const HEAT_STEPS = 6;
const MAX_DOTS_PER_ZONE = 60;
const MAX_FLOWS = 8;
const WARNING_AT = 0.85;
/** Display scale shared by all stores (≈ 900 px for the 60 m flagship). */
const PX_PER_METRE = 14;
/** Zone label size in metres: a bit smaller in small stores so labels fit their zones. */
const labelSize = (plan: Plan) => Math.min(1.3, Math.max(0.95, plan.width / 40));

/** Share of capacity in 20% buckets: 0 = empty … 5 = over 80%. */
const heatStep = (fill: number) =>
  fill <= 0 ? 0 : Math.max(1, Math.min(HEAT_STEPS - 1, Math.ceil(fill * (HEAT_STEPS - 1))));

const zoneName = (z: PlanZone) => ZONE_LABELS[z.zone];

function fixtureCenter(f: Fixture): Point {
  if (f.kind === "table") return [f.cx, f.cy];
  if (f.kind === "barrier") return [(f.x1 + f.x2) / 2, f.y1];
  return [f.x + f.w / 2, f.y + f.h / 2];
}

type Hover =
  { kind: "zone"; zone: PlanZone } | { kind: "sensor"; id: string } | { kind: "flow"; index: number } | null;

/* ------------------------------------------------------------------ component */

export function FloorPlan({
  plan,
  live,
  layers,
}: {
  plan: Plan;
  live: LiveSnapshot | undefined;
  layers: Record<PlanLayer, boolean>;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<Hover>(null);
  const vb = plan.viewBox;

  const zoneLive = useMemo(() => new Map(live?.zones.map((z) => [z.zone, z])), [live]);
  const sensorLive = useMemo(() => new Map(live?.sensors.map((s) => [s.id, s])), [live]);
  const stepOf = (z: PlanZone) => (layers.occupancy ? heatStep(zoneLive.get(z.zone)?.fill ?? 0) : 0);
  const onHigh = (p: Point) => {
    const z = plan.zones.find((q) => inPolygon(p, q.polygon));
    return z ? stepOf(z) >= 4 : false;
  };

  // People dots, re-seeded on every snapshot so the plan visibly moves.
  const tick = live ? `${live.asOf.hour}:${live.asOf.minute}:${live.asOf.second}` : "init";
  const dots = useMemo(() => {
    const out: { key: string; x: number; y: number }[] = [];
    for (const z of plan.zones) {
      const count = Math.min(MAX_DOTS_PER_ZONE, zoneLive.get(z.zone)?.occupancy ?? 0);
      const b = polygonBounds(z.polygon);
      for (let i = 0; i < count; i++) {
        const rng = createRng(`${plan.storeId}|${z.zone}|${i}|${tick}`);
        let p: Point = [0, 0];
        for (let tries = 0; tries < 200; tries++) {
          p = [b.minX + rng.next() * (b.maxX - b.minX), b.minY + rng.next() * (b.maxY - b.minY)];
          const underLabel =
            p[0] < z.labelAt[0] + 12 && p[1] > z.labelAt[1] - 0.4 && p[1] < z.labelAt[1] + 2.6;
          const nearWall = distanceToEdges(p, plan.outline) < 0.5;
          if (inPolygon(p, z.polygon) && !isBlocked(plan, p) && !underLabel && !nearWall) break;
        }
        out.push({ key: `${z.zone}-${i}`, x: p[0], y: p[1] });
      }
    }
    return out;
  }, [plan, zoneLive, tick]);

  const flows = useMemo(() => {
    const list = (live?.flows ?? []).filter((f) => f.count >= 2).slice(0, MAX_FLOWS);
    const max = Math.max(1, ...list.map((f) => f.count));
    const anchor = (end: string): Point =>
      end === "street" ? plan.streetAnchor : (plan.zones.find((z) => z.zone === end)?.anchor ?? [0, 0]);
    return list.map((f, i) => {
      const [x1, y1] = anchor(f.from);
      const [x2, y2] = anchor(f.to);
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const bend = (i % 2 ? 1 : -1) * Math.min(5, len * 0.18);
      const cx = (x1 + x2) / 2 - ((y2 - y1) / len) * bend;
      const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * bend;
      return {
        ...f,
        d: `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`,
        mid: [(x1 + 2 * cx + x2) / 4, (y1 + 2 * cy + y2) / 4] as Point,
        // Thinner arrows in smaller stores so they don't swamp the plan.
        width: (0.25 + (f.count / max) * 1.1) * Math.min(1, Math.max(0.6, plan.width / 50)),
      };
    });
  }, [live, plan]);

  const cubicles = plan.fixtures.filter((f) => f.kind === "cubicle").length;
  const hoveredSensor = hover?.kind === "sensor" ? plan.sensors.find((s) => s.id === hover.id) : undefined;
  const hoverPoint: Point | null =
    hover?.kind === "zone"
      ? hover.zone.anchor
      : hoveredSensor
        ? [hoveredSensor.x, hoveredSensor.y]
        : hover?.kind === "flow"
          ? (flows[hover.index]?.mid ?? null)
          : null;

  const hoverProps = (h: NonNullable<Hover>) => ({
    tabIndex: 0,
    onMouseEnter: () => setHover(h),
    onFocus: () => setHover(h),
    onBlur: () => setHover(null),
  });

  return (
    <div className="relative">
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="mx-auto block h-auto w-full select-none"
        // Same real-world scale for every store, so a smaller store looks smaller.
        style={{ maxWidth: `${vb.w * PX_PER_METRE}px` }}
        role="img"
        aria-label="Store floor plan with live occupancy"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern
            id={`${uid}-hatch`}
            width={1.2}
            height={1.2}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={1.2} height={1.2} fill="var(--plan-staff)" />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={1.2}
              stroke="var(--muted-foreground)"
              strokeWidth={0.18}
              opacity={0.55}
            />
          </pattern>
          <marker
            id={`${uid}-arrow`}
            viewBox="0 0 6 6"
            refX={4.6}
            refY={3}
            markerWidth={3.2}
            markerHeight={3.2}
            orient="auto"
          >
            <path d="M0 0L6 3L0 6z" fill="var(--highlight)" />
          </marker>
          {plan.zones.map((z) => (
            <clipPath key={z.zone} id={`${uid}-clip-${z.zone}`}>
              <polygon points={toSvgPoints(z.polygon)} />
            </clipPath>
          ))}
          {/* Sensor coverage is clipped to the sensor's own area: indoor nodes to the
              building, the street node to the street. */}
          <clipPath id={`${uid}-building`}>
            <polygon points={toSvgPoints(plan.outline)} />
          </clipPath>
          <clipPath id={`${uid}-street`}>
            <rect x={plan.street.x} y={plan.street.y} width={plan.street.w} height={plan.street.h} rx={1} />
          </clipPath>
        </defs>

        {/* Street */}
        <rect
          x={plan.street.x}
          y={plan.street.y}
          width={plan.street.w}
          height={plan.street.h}
          rx={1}
          fill="var(--plan-street)"
        />
        <text
          x={plan.street.x + 0.9}
          y={plan.street.y + plan.street.h - 1.1}
          fontSize={1.6}
          fill="var(--muted-foreground)"
        >
          {plan.streetLabel}
        </text>

        {/* Zones */}
        {plan.zones.map((z) => {
          const zl = zoneLive.get(z.zone);
          const fill = zl?.fill ?? 0;
          const alert = layers.occupancy && fill >= WARNING_AT ? (fill >= 1 ? "critical" : "warning") : null;
          return (
            <g
              key={z.zone}
              role="button"
              aria-label={`${zoneName(z)}: ${zl?.occupancy ?? 0} of ${zl?.capacity ?? "?"} people${alert === "critical" ? ", full" : alert === "warning" ? ", nearly full" : ""}`}
              className="outline-none"
              {...hoverProps({ kind: "zone", zone: z })}
            >
              <polygon
                points={toSvgPoints(z.polygon)}
                fill={layers.occupancy ? `var(--plan-heat-${stepOf(z)})` : "var(--plan-zone-neutral)"}
                stroke="var(--background)"
                strokeWidth={0.18}
                className="transition-[fill] duration-700"
              />
              {alert && (
                <polygon
                  points={toSvgPoints(z.polygon)}
                  fill="none"
                  stroke={alert === "critical" ? "var(--status-critical)" : "var(--status-warning)"}
                  strokeWidth={0.9}
                  strokeDasharray={alert === "warning" ? "1.2 0.8" : undefined}
                  clipPath={`url(#${uid}-clip-${z.zone})`}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}

        {/* Staff-only areas (never tracked) */}
        {plan.staffAreas.map((a) => {
          const b = polygonBounds(a.polygon);
          return (
            <g key={a.label} pointerEvents="none">
              <polygon points={toSvgPoints(a.polygon)} fill={`url(#${uid}-hatch)`} />
              <text
                x={b.minX + 0.5}
                y={b.minY + (b.maxY - b.minY) / 2 + 0.4}
                fontSize={Math.min(1.25, (b.maxX - b.minX - 1) / (a.label.length * 0.62))}
                fill="var(--muted-foreground)"
              >
                {a.label}
              </text>
            </g>
          );
        })}

        {/* Fixtures and columns */}
        <g pointerEvents="none">
          {plan.fixtures.map((f, i) => (
            <FixtureShape key={i} f={f} high={onHigh(fixtureCenter(f))} />
          ))}
          {plan.columns.map(([x, y], i) =>
            plan.columnStyle === "round" ? (
              <circle
                key={`col-${i}`}
                cx={x}
                cy={y}
                r={0.55}
                fill="var(--plan-fixture)"
                stroke="var(--plan-wall)"
                strokeWidth={0.22}
              />
            ) : (
              <rect
                key={`col-${i}`}
                x={x - 0.45}
                y={y - 0.45}
                width={0.9}
                height={0.9}
                fill="var(--plan-wall)"
                opacity={0.85}
              />
            ),
          )}
        </g>

        {/* Walls, shopfront glass and door swings */}
        <g pointerEvents="none">
          <path
            d={wallPath(plan)}
            fill="none"
            stroke="var(--plan-wall)"
            strokeWidth={0.55}
            strokeLinejoin="round"
          />
          {plan.glass.map(([a, b], i) => (
            <g key={i}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--background)" strokeWidth={0.5} />
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--plan-glass)" strokeWidth={0.16} />
            </g>
          ))}
          <DoorSwing plan={plan} />
        </g>

        {/* People */}
        {layers.people && (
          <g pointerEvents="none">
            {dots.map((d) => (
              <circle
                key={d.key}
                r={0.36}
                fill={onHigh([d.x, d.y]) ? "var(--plan-person-on-high)" : "var(--plan-person)"}
                className="transition-transform duration-[1200ms] ease-in-out motion-reduce:transition-none"
                style={{ transform: `translate(${d.x}px, ${d.y}px)` }}
              />
            ))}
          </g>
        )}

        {/* Flows */}
        {layers.flows &&
          flows.map((f, i) => (
            <g
              key={`${f.from}-${f.to}`}
              role="button"
              aria-label={`${f.count} people from ${flowEndName(f.from)} to ${flowEndName(f.to)} in the last hour`}
              className="outline-none"
              {...hoverProps({ kind: "flow", index: i })}
            >
              <path d={f.d} fill="none" stroke="transparent" strokeWidth={2.4} />
              <path
                d={f.d}
                fill="none"
                stroke="var(--highlight)"
                strokeWidth={f.width}
                strokeLinecap="round"
                opacity={hover?.kind === "flow" && hover.index !== i ? 0.35 : 0.85}
                markerEnd={`url(#${uid}-arrow)`}
                pointerEvents="none"
              />
            </g>
          ))}

        {/* Sensors with coverage */}
        {layers.sensors &&
          plan.sensors.map((s) => (
            <g
              key={s.id}
              role="button"
              aria-label={`${SENSOR_LABELS[s.type]} ${s.id}`}
              className="outline-none"
              {...hoverProps({ kind: "sensor", id: s.id })}
            >
              <circle
                cx={s.x}
                cy={s.y}
                r={s.rangeM}
                fill="var(--status-good)"
                fillOpacity={0.06}
                stroke="var(--status-good)"
                strokeWidth={0.12}
                strokeDasharray="0.6 0.4"
                clipPath={`url(#${uid}-${s.zone === "street" ? "street" : "building"})`}
                pointerEvents="none"
              />
              <circle cx={s.x} cy={s.y} r={1.4} fill="transparent" />
              <circle
                cx={s.x}
                cy={s.y}
                r={0.55}
                fill="var(--status-good)"
                stroke="var(--background)"
                strokeWidth={0.18}
              />
            </g>
          ))}

        {/* Hovered/focused zone outline, drawn after zones, fixtures and walls so no
            neighbouring zone paints over its shared edges. */}
        {hover?.kind === "zone" && (
          <polygon
            points={toSvgPoints(hover.zone.polygon)}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={0.35}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}

        {/* Zone labels (always on top) */}
        <g pointerEvents="none">
          {plan.zones.map((z) => {
            const zl = zoneLive.get(z.zone);
            return (
              <ZoneLabel
                key={z.zone}
                at={z.labelAt}
                name={z.shortLabel ?? zoneName(z)}
                count={zl ? `${zl.occupancy}/${zl.capacity}` : "–"}
                fill={layers.occupancy ? (zl?.fill ?? 0) : 0}
                size={labelSize(plan)}
              />
            );
          })}
        </g>

        <ScaleBar x={0} y={plan.street.y + plan.street.h + 2.2} />
      </svg>

      {/* Hover card */}
      {hover && hoverPoint && (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute z-10 w-56 rounded-lg border p-3 text-xs shadow-lg"
          style={tooltipPosition(hoverPoint, vb)}
        >
          {hover.kind === "zone" && (
            <ZoneCard z={hover.zone} live={zoneLive.get(hover.zone.zone)} cubicles={cubicles} />
          )}
          {hoveredSensor && <SensorCard sensor={hoveredSensor} reading={sensorLive.get(hoveredSensor.id)} />}
          {hover.kind === "flow" && flows[hover.index] && <FlowCard flow={flows[hover.index]} />}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

const flowEndName = (end: string) =>
  end === "street" ? "Street" : ZONE_LABELS[end as keyof typeof ZONE_LABELS];

/** The building outline as a wall, leaving a gap for the door on the shopfront. */
export function wallPath(plan: Plan): string {
  const pts = plan.outline;
  const { x1, x2 } = plan.door;
  const d = plan.depth;
  // Outlines run clockwise from the back-left corner, so starting at the front-left
  // corner walks front-left → back-left → back-right → … → front-right.
  const start = pts.findIndex(([x, y]) => y === d && x <= x1);
  const walk = [...pts.slice(start), ...pts.slice(0, start)];
  return [`M${x1} ${d}`, ...walk.map(([x, y]) => `L${x} ${y}`), `L${x2} ${d}`].join(" ");
}

export function DoorSwing({ plan }: { plan: Plan }) {
  const { x1, x2 } = plan.door;
  const d = plan.depth;
  const half = (x2 - x1) / 2;
  return (
    <path
      d={`M${x1} ${d} L${x1} ${d - half} A${half} ${half} 0 0 1 ${x1 + half} ${d} M${x2} ${d} L${x2} ${d - half} A${half} ${half} 0 0 0 ${x2 - half} ${d}`}
      fill="none"
      stroke="var(--muted-foreground)"
      strokeWidth={0.1}
    />
  );
}

function FixtureShape({ f, high }: { f: Fixture; high: boolean }) {
  const fill = high ? "var(--plan-fixture-on-high)" : "var(--plan-fixture)";
  const stroke = high ? "var(--plan-fixture-stroke-on-high)" : "var(--plan-fixture-stroke)";
  switch (f.kind) {
    case "table":
      return <circle cx={f.cx} cy={f.cy} r={f.r} fill={fill} stroke={stroke} strokeWidth={0.12} />;
    case "barrier": {
      const posts: number[] = [];
      for (let x = f.x1; x <= f.x2 + 0.01; x += 2.5) posts.push(x);
      return (
        <g>
          <line
            x1={f.x1}
            y1={f.y1}
            x2={f.x2}
            y2={f.y2}
            stroke={stroke}
            strokeWidth={0.12}
            strokeDasharray="0.5 0.35"
          />
          {posts.map((x) => (
            <circle key={x} cx={x} cy={f.y1} r={0.18} fill={stroke} />
          ))}
        </g>
      );
    }
    case "till":
      return (
        <rect
          x={f.x}
          y={f.y}
          width={f.w}
          height={f.h}
          rx={0.1}
          fill="var(--muted-foreground)"
          opacity={0.7}
        />
      );
    case "mirror":
      return <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="var(--plan-glass)" opacity={0.35} />;
    case "window": {
      const mannequins: number[] = [];
      for (let x = f.x + 1.5; x < f.x + f.w; x += 3) mannequins.push(x);
      return (
        <g>
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.1}
            opacity={0.8}
          />
          {mannequins.map((x) => (
            <circle key={x} cx={x} cy={f.y + f.h / 2} r={0.32} fill={stroke} />
          ))}
        </g>
      );
    }
    case "shelf":
    case "counter":
      return (
        <rect
          x={f.x}
          y={f.y}
          width={f.w}
          height={f.h}
          rx={0.15}
          fill={stroke}
          strokeWidth={0}
          opacity={0.55}
        />
      );
    case "rack":
      return (
        <g>
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={0.35}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.12}
          />
          <line
            x1={f.x + 0.3}
            y1={f.y + f.h / 2}
            x2={f.x + f.w - 0.3}
            y2={f.y + f.h / 2}
            stroke={stroke}
            strokeWidth={0.08}
          />
        </g>
      );
    case "cubicle": {
      // Curtain along the open side, inset slightly from the corners.
      const [x1, y1, x2, y2] =
        f.open === "left"
          ? [f.x, f.y + 0.2, f.x, f.y + f.h - 0.2]
          : f.open === "right"
            ? [f.x + f.w, f.y + 0.2, f.x + f.w, f.y + f.h - 0.2]
            : f.open === "top"
              ? [f.x + 0.15, f.y, f.x + f.w - 0.15, f.y]
              : [f.x + 0.15, f.y + f.h, f.x + f.w - 0.15, f.y + f.h];
      return (
        <g>
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={0.12}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.12}
          />
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={high ? "var(--plan-person-on-high)" : "var(--plan-glass)"}
            strokeWidth={0.22}
            strokeDasharray="0.3 0.2"
          />
        </g>
      );
    }
    case "plinth":
      return (
        <g>
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={0.3}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.12}
          />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={f.x + 0.8 + i * 1.2} cy={f.y + f.h / 2} r={0.32} fill={stroke} />
          ))}
        </g>
      );
  }
}

/** Label pill sized to its text (re-measured once web fonts have loaded). */
function ZoneLabel({
  at,
  name,
  count,
  fill,
  size,
}: {
  at: Point;
  name: string;
  count: string;
  fill: number;
  /** Font size in metres; the pill scales with it. */
  size: number;
}) {
  const textRef = useRef<SVGTextElement>(null);
  const pad = size * 0.62;
  const [width, setWidth] = useState((name.length + count.length) * size * 0.55 + pad * 2);
  useLayoutEffect(() => {
    const measure = () => {
      const len = textRef.current?.getComputedTextLength();
      if (len) setWidth(len + pad * 2);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
  }, [name, count, fill, pad]);
  const border =
    fill >= 1 ? "var(--status-critical)" : fill >= WARNING_AT ? "var(--status-warning)" : "var(--border)";
  return (
    <g>
      <rect
        x={at[0]}
        y={at[1]}
        width={width}
        height={size * 1.46}
        rx={size * 0.73}
        fill="var(--plan-pill)"
        stroke={border}
        strokeWidth={0.1}
      />
      <text
        ref={textRef}
        x={at[0] + pad}
        y={at[1] + size * 1.06}
        fontSize={size}
        fontWeight={600}
        fill="var(--foreground)"
      >
        {name}
        <tspan fontWeight={400} dx={size * 0.46}>
          {count}
        </tspan>
        {fill >= 1 && (
          <tspan fill="var(--status-critical)" fontWeight={700} dx={size * 0.3}>
            !
          </tspan>
        )}
      </text>
    </g>
  );
}

function ScaleBar({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="var(--muted-foreground)" strokeWidth={0.15} pointerEvents="none">
      <line x1={x} y1={y} x2={x + 10} y2={y} />
      {[0, 5, 10].map((t) => (
        <line key={t} x1={x + t} y1={y - 0.4} x2={x + t} y2={y + 0.4} />
      ))}
      <text x={x + 10.8} y={y + 0.5} fontSize={1.2} fill="var(--muted-foreground)" stroke="none">
        10 m
      </text>
    </g>
  );
}

function tooltipPosition([x, y]: Point, vb: Plan["viewBox"]) {
  const left = ((x - vb.x) / vb.w) * 100;
  const top = ((y - vb.y) / vb.h) * 100;
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(${left > 60 ? "calc(-100% - 12px)" : "12px"}, ${top > 60 ? "calc(-100% - 12px)" : "12px"})`,
  };
}

function ZoneCard({
  z,
  live,
  cubicles,
}: {
  z: PlanZone;
  live: LiveSnapshot["zones"][number] | undefined;
  cubicles: number;
}) {
  const status = !live
    ? "–"
    : live.fill >= 1
      ? "Full"
      : live.fill >= WARNING_AT
        ? "Nearly full"
        : `${formatPercent(live.fill)} full`;
  return (
    <>
      <p className="mb-1.5 font-medium">{zoneName(z)}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums">
        <dt className="text-muted-foreground">People now</dt>
        <dd className="text-right font-medium">{live ? `${live.occupancy} of ${live.capacity}` : "–"}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className={cn("text-right", live && live.fill >= 1 && "text-status-critical font-medium")}>
          {status}
        </dd>
        {z.zone === "fitting-rooms" && cubicles > 0 && (
          <>
            <dt className="text-muted-foreground">Layout</dt>
            <dd className="text-right">{cubicles} cubicles · 2 each</dd>
          </>
        )}
        <dt className="text-muted-foreground">Visitors today</dt>
        <dd className="text-right">{live ? formatInt(live.visitorsToday) : "–"}</dd>
        <dt className="text-muted-foreground">Avg dwell</dt>
        <dd className="text-right">{live ? formatDuration(live.avgDwellSec) : "–"}</dd>
      </dl>
    </>
  );
}

function SensorCard({
  sensor,
  reading,
}: {
  sensor: Plan["sensors"][number];
  reading: LiveSnapshot["sensors"][number] | undefined;
}) {
  return (
    <>
      <p className="font-medium">{SENSOR_LABELS[sensor.type]}</p>
      <p className="text-muted-foreground mb-1.5 font-mono text-[11px]">{sensor.id}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums">
        <dt className="text-muted-foreground">Status</dt>
        <dd className="flex items-center justify-end gap-1">
          <span className="bg-status-good size-1.5 rounded-full" aria-hidden /> Online
        </dd>
        <dt className="text-muted-foreground">Zone</dt>
        <dd className="text-right">{ZONE_LABELS[sensor.zone]}</dd>
        <dt className="text-muted-foreground">Range</dt>
        <dd className="text-right">≈ {sensor.rangeM} m</dd>
        {reading && (
          <>
            <dt className="text-muted-foreground">Last signal</dt>
            <dd className="text-right">{reading.lastSignalSec}s ago</dd>
            <dt className="text-muted-foreground">Detections (15 min)</dt>
            <dd className="text-right">{formatInt(reading.detections)}</dd>
          </>
        )}
      </dl>
    </>
  );
}

function FlowCard({ flow }: { flow: { from: string; to: string; count: number } }) {
  return (
    <>
      <p className="mb-1.5 font-medium">
        {flowEndName(flow.from)} → {flowEndName(flow.to)}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground">People, last hour</dt>
        <dd className="text-right font-medium">{formatInt(flow.count)}</dd>
      </dl>
    </>
  );
}

/* ------------------------------------------------------------------ legend */

export function PlanLegend({ plan, layers }: { plan: Plan; layers: Record<PlanLayer, boolean> }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {layers.occupancy && (
        <>
          <span className="flex items-center gap-1.5">
            <span className="flex gap-0.5" aria-hidden>
              {Array.from({ length: HEAT_STEPS }, (_, i) => (
                <span
                  key={i}
                  className="h-2.5 w-4 rounded-[2px]"
                  style={{ background: `var(--plan-heat-${i})` }}
                />
              ))}
            </span>
            Zone capacity used 0 → 100%
          </span>
          <span className="flex items-center gap-1">
            <span className="border-status-warning size-2.5 rounded-[2px] border border-dashed" aria-hidden />
            ≥85%
          </span>
          <span className="flex items-center gap-1">
            <span className="border-status-critical size-2.5 rounded-[2px] border" aria-hidden />
            Full
          </span>
        </>
      )}
      {layers.people && (
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-[var(--plan-person)]" aria-hidden /> Person
        </span>
      )}
      {layers.sensors && (
        <span className="flex items-center gap-1">
          <span className="bg-status-good size-2 rounded-full" aria-hidden /> Sensor · dashed circle = range
        </span>
      )}
      {layers.flows && (
        <span className="flex items-center gap-1">
          <span className="bg-highlight h-0.5 w-4 rounded-full" aria-hidden /> Flow, last hour · thicker =
          more people
        </span>
      )}
      {plan.staffAreas.length > 0 && (
        <span className="flex items-center gap-1">
          <span
            className="h-2.5 w-4 rounded-[2px] opacity-60"
            style={{
              background:
                "repeating-linear-gradient(45deg, var(--muted-foreground) 0 1px, transparent 1px 4px)",
            }}
            aria-hidden
          />
          Not public · not tracked
        </span>
      )}
    </div>
  );
}
