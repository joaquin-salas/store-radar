"use client";

import { DoorSwing, wallPath } from "@/components/live/floor-plan";
import type { Point } from "@/lib/domain/geometry";
import { toSvgPoints } from "@/lib/domain/geometry";
import type { FloorPlan } from "@/lib/domain/layout";
import type { InStoreZone } from "@/lib/domain/types";

/**
 * A visitor's route drawn on the store plan: the zones they went through are
 * highlighted and joined from the street in order, with numbered stops that
 * match the timeline next to it.
 */
export function VisitPlan({ plan, stops }: { plan: FloorPlan; stops: readonly InStoreZone[] }) {
  const vb = plan.viewBox;
  const visited = new Set(stops);
  const anchorOf = (zone: InStoreZone): Point => plan.zones.find((z) => z.zone === zone)?.anchor ?? [0, 0];
  const points: Point[] = [plan.streetAnchor, ...stops.map(anchorOf)];
  // Markers scale a little with the building so small stores stay readable.
  const r = Math.min(1.6, Math.max(1.1, plan.width / 38));

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="block h-auto w-full select-none"
      role="img"
      aria-label={`Route: street, ${stops.map((s) => plan.zones.find((z) => z.zone === s)?.shortLabel ?? s).join(", ")}`}
    >
      <rect
        x={plan.street.x}
        y={plan.street.y}
        width={plan.street.w}
        height={plan.street.h}
        rx={1}
        fill="var(--plan-street)"
      />
      {plan.zones.map((z) => (
        <polygon
          key={z.zone}
          points={toSvgPoints(z.polygon)}
          fill={visited.has(z.zone) ? "var(--plan-heat-1)" : "var(--plan-zone-neutral)"}
          stroke="var(--background)"
          strokeWidth={0.18}
        />
      ))}
      {plan.staffAreas.map((a) => (
        <polygon key={a.label} points={toSvgPoints(a.polygon)} fill="var(--plan-staff)" />
      ))}
      <path
        d={wallPath(plan)}
        fill="none"
        stroke="var(--plan-wall)"
        strokeWidth={0.55}
        strokeLinejoin="round"
      />
      <DoorSwing plan={plan} />

      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="var(--highlight)"
        strokeWidth={0.45}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1.2 0.7"
      />
      {stops.map((zone, i) => {
        const [x, y] = anchorOf(zone);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="var(--primary)" stroke="var(--background)" strokeWidth={0.25} />
            <text
              x={x}
              y={y}
              fontSize={r * 1.15}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--primary-foreground)"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
