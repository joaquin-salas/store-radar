"use client";

import { useMemo, useState } from "react";
import { ZONE_LABELS } from "@/lib/domain/catalog";
import { type FloorPlan as Plan, SENSOR_LABELS, type ZoneShape } from "@/lib/domain/layout";
import { createRng } from "@/lib/domain/random";
import type { InStoreZone } from "@/lib/domain/types";
import { formatDuration, formatInt } from "@/lib/format";
import type { LiveSnapshot } from "@/lib/queries";
import { cn } from "@/lib/utils";

const HEAT_STEPS = 6; // --heat-0 … --heat-5
const MAX_DOTS_PER_ZONE = 40;

/** Headcount bucketed relative to the busiest zone (0 = empty, 5 = busiest). */
function heatStep(people: number, maxPeople: number): number {
  if (people <= 0 || maxPeople <= 0) return 0;
  return Math.max(1, Math.min(HEAT_STEPS - 1, Math.ceil((people / maxPeople) * (HEAT_STEPS - 1))));
}

type Hover = { kind: "zone"; zone: ZoneShape } | { kind: "sensor"; id: string } | null;

interface FloorPlanProps {
  plan: Plan;
  live: LiveSnapshot | undefined;
}

export function FloorPlan({ plan, live }: FloorPlanProps) {
  const [hover, setHover] = useState<Hover>(null);

  const zoneLive = useMemo(() => new Map(live?.zones.map((z) => [z.zone, z])), [live]);
  const sensorLive = useMemo(() => new Map(live?.sensors.map((s) => [s.id, s])), [live]);

  const people = plan.zones.map(({ zone }) =>
    zone === "street" ? 0 : (zoneLive.get(zone as InStoreZone)?.occupancy ?? 0),
  );
  const maxPeople = Math.max(0, ...people);

  // People dots: positions are re-seeded on every snapshot so the plan visibly moves.
  const tick = live ? `${live.asOf.hour}:${live.asOf.minute}:${live.asOf.second}` : "init";
  const dots = useMemo(() => {
    const out: { key: string; x: number; y: number }[] = [];
    for (const { zone, rect } of plan.zones) {
      if (zone === "street") continue;
      const count = Math.min(MAX_DOTS_PER_ZONE, zoneLive.get(zone as InStoreZone)?.occupancy ?? 0);
      for (let i = 0; i < count; i++) {
        const rng = createRng(`${plan.storeId}|${zone}|${i}|${tick}`);
        out.push({
          key: `${zone}-${i}`,
          x: rect.x + 3 + rng.next() * (rect.w - 6),
          y: rect.y + 10 + rng.next() * (rect.h - 13),
        });
      }
    }
    return out;
  }, [plan, zoneLive, tick]);

  const hoveredSensor = hover?.kind === "sensor" ? plan.sensors.find((s) => s.id === hover.id) : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={`-1 -1 ${plan.width + 2} ${plan.height + 2}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label="Store floor plan with live occupancy per zone and sensor positions"
        onMouseLeave={() => setHover(null)}
      >
        {/* Zones */}
        {plan.zones.map((shape, i) => {
          const { zone, rect } = shape;
          const isStreet = zone === "street";
          const live = isStreet ? undefined : zoneLive.get(zone as InStoreZone);
          const step = isStreet ? 0 : heatStep(people[i], maxPeople);
          const active = hover?.kind === "zone" && hover.zone.zone === zone;
          return (
            <g
              key={zone}
              tabIndex={0}
              role="button"
              aria-label={isStreet ? "Street" : `${ZONE_LABELS[zone]}: ${live?.occupancy ?? 0} people now`}
              className="cursor-default outline-none"
              onMouseEnter={() => setHover({ kind: "zone", zone: shape })}
              onFocus={() => setHover({ kind: "zone", zone: shape })}
              onBlur={() => setHover(null)}
            >
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                className={cn(
                  "transition-[fill] duration-700",
                  isStreet ? "fill-muted" : "stroke-background",
                  active && "stroke-foreground",
                )}
                style={isStreet ? undefined : { fill: `var(--heat-${step})` }}
                strokeWidth={active ? 0.5 : 0.6}
              />
              <text
                x={rect.x + 2}
                y={rect.y + (isStreet ? rect.h - 2.2 : 3.4)}
                className={cn("text-[1.9px] font-medium", step >= 4 ? "fill-white" : "fill-foreground")}
              >
                {ZONE_LABELS[zone]}
              </text>
              {!isStreet && (
                <text
                  x={rect.x + rect.w - 2}
                  y={rect.y + 3.4}
                  textAnchor="end"
                  className={cn("text-[1.9px] tabular-nums", step >= 4 ? "fill-white" : "fill-foreground")}
                >
                  {live?.occupancy ?? "–"}
                </text>
              )}
            </g>
          );
        })}

        {/* Walls with a door gap */}
        <path
          d={[
            `M ${plan.door.x} ${plan.interior.h}`,
            `H ${plan.interior.x}`,
            `V ${plan.interior.y}`,
            `H ${plan.interior.x + plan.interior.w}`,
            `V ${plan.interior.h}`,
            `H ${plan.door.x + plan.door.w}`,
          ].join(" ")}
          className="stroke-foreground/70 fill-none"
          strokeWidth={0.8}
          strokeLinejoin="round"
          pointerEvents="none"
        />

        {/* People */}
        <g pointerEvents="none">
          {dots.map((d) => (
            <circle
              key={d.key}
              r={0.5}
              className="fill-foreground/60 transition-transform duration-[1200ms] ease-in-out motion-reduce:transition-none"
              style={{ transform: `translate(${d.x}px, ${d.y}px)` }}
            />
          ))}
        </g>

        {/* Sensors */}
        {plan.sensors.map((s) => (
          <g
            key={s.id}
            tabIndex={0}
            role="button"
            aria-label={`${SENSOR_LABELS[s.type]} ${s.id}`}
            className="cursor-default outline-none"
            onMouseEnter={() => setHover({ kind: "sensor", id: s.id })}
            onFocus={() => setHover({ kind: "sensor", id: s.id })}
            onBlur={() => setHover(null)}
          >
            {/* Larger invisible hit target */}
            <circle cx={s.x} cy={s.y} r={2.5} fill="transparent" />
            <circle
              cx={s.x}
              cy={s.y}
              r={1.15}
              className="fill-status-good/40 origin-center [transform-box:fill-box] motion-safe:animate-ping"
            />
            <circle
              cx={s.x}
              cy={s.y}
              r={0.7}
              className="fill-status-good stroke-background"
              strokeWidth={0.25}
            />
          </g>
        ))}
      </svg>

      {/* Hover card */}
      {hover && (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute z-10 w-52 rounded-lg border p-3 text-xs shadow-md"
          style={tooltipPosition(plan, hover, hoveredSensor)}
        >
          {hover.kind === "zone" ? (
            <ZoneCard shape={hover.zone} live={live} />
          ) : hoveredSensor ? (
            <SensorCard reading={sensorLive.get(hoveredSensor.id)} fallback={hoveredSensor} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function tooltipPosition(plan: Plan, hover: NonNullable<Hover>, sensor?: { x: number; y: number }) {
  const p =
    hover.kind === "zone"
      ? { x: hover.zone.rect.x + hover.zone.rect.w / 2, y: hover.zone.rect.y + hover.zone.rect.h / 2 }
      : (sensor ?? { x: 0, y: 0 });
  const left = (p.x / plan.width) * 100;
  const top = (p.y / plan.height) * 100;
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(${left > 60 ? "-100%" : "0"}, ${top > 60 ? "-100%" : "0"})`,
  };
}

function ZoneCard({ shape, live }: { shape: ZoneShape; live: LiveSnapshot | undefined }) {
  if (shape.zone === "street") {
    return (
      <>
        <p className="font-medium">Street</p>
        <p className="text-muted-foreground">
          {formatInt(live?.recent.street ?? 0)} passers-by in the last 15 min
        </p>
      </>
    );
  }
  const z = live?.zones.find((x) => x.zone === shape.zone);
  return (
    <>
      <p className="mb-1.5 font-medium">{ZONE_LABELS[shape.zone]}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums">
        <dt className="text-muted-foreground">People now</dt>
        <dd className="text-right font-medium">{z?.occupancy ?? "–"}</dd>
        <dt className="text-muted-foreground">Visitors today</dt>
        <dd className="text-right">{z ? formatInt(z.visitorsToday) : "–"}</dd>
        <dt className="text-muted-foreground">Avg dwell</dt>
        <dd className="text-right">{z ? formatDuration(z.avgDwellSec) : "–"}</dd>
      </dl>
    </>
  );
}

function SensorCard({
  reading,
  fallback,
}: {
  reading: LiveSnapshot["sensors"][number] | undefined;
  fallback: Plan["sensors"][number];
}) {
  const s = reading ?? fallback;
  return (
    <>
      <p className="font-medium">{SENSOR_LABELS[s.type]}</p>
      <p className="text-muted-foreground mb-1.5 font-mono text-[11px]">{s.id}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums">
        <dt className="text-muted-foreground">Status</dt>
        <dd className="flex items-center justify-end gap-1">
          <span className="bg-status-good size-1.5 rounded-full" aria-hidden /> Online
        </dd>
        <dt className="text-muted-foreground">Zone</dt>
        <dd className="text-right">{ZONE_LABELS[s.zone]}</dd>
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

export function HeatLegend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span>Fewer people</span>
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: HEAT_STEPS }, (_, i) => (
          <span key={i} className="h-2.5 w-5 rounded-[2px]" style={{ background: `var(--heat-${i})` }} />
        ))}
      </div>
      <span>More</span>
      <span className="flex items-center gap-1 sm:ml-3">
        <span className="bg-status-good size-2 rounded-full" aria-hidden /> Sensor online
      </span>
      <span className="flex items-center gap-1 sm:ml-3">
        <span className="bg-foreground/60 size-1.5 rounded-full" aria-hidden /> Person
      </span>
    </div>
  );
}
