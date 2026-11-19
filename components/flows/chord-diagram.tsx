"use client";

import { type Chord, type ChordGroup, chordDirected, ribbonArrow } from "d3-chord";
import { type MouseEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { formatInt, formatPercent } from "@/lib/format";

const SIZE = 480;
const OUTER = 140;
const INNER = 128;
const PAD = 0.04;

/** A point on a circle, angle 0 at 12 o'clock going clockwise (d3's convention). */
const point = (r: number, a: number) => [r * Math.sin(a), -r * Math.cos(a)] as const;

function arcPath(a0: number, a1: number, r0: number, r1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = point(r1, a0);
  const [x1, y1] = point(r1, a1);
  const [x2, y2] = point(r0, a1);
  const [x3, y3] = point(r0, a0);
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

const ribbon = ribbonArrow<Chord, ChordGroup>()
  .radius(INNER - 1)
  .padAngle(1 / INNER)
  .headRadius(10);

interface Hover {
  x: number;
  y: number;
  /** Show the tooltip on the left of the pointer (pointer in the right half). */
  flip: boolean;
  content: ReactNode;
}

/**
 * Directed chord diagram: each group's arc is its moves out plus moves in;
 * a ribbon i → j is as wide as the moves from i to j, with an arrowhead at j.
 * Hovering a group highlights its ribbons; every ribbon and arc has a tooltip.
 */
export function ChordDiagram({
  labels,
  colors,
  matrix,
  unit,
  label,
}: {
  labels: string[];
  colors: string[];
  /** `matrix[i][j]`: flow from i to j. */
  matrix: number[][];
  /** Noun for the tooltip counts, e.g. "moves". */
  unit: string;
  /** Accessible summary of the chart. */
  label: string;
}) {
  const chords = useMemo(
    () =>
      chordDirected()
        .padAngle(PAD)
        .sortSubgroups((a, b) => b - a)(matrix),
    [matrix],
  );
  const total = useMemo(() => matrix.flat().reduce((a, b) => a + b, 0), [matrix]);
  const [focus, setFocus] = useState<number | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const show = (e: MouseEvent, content: ReactNode) => {
    const r = box.current?.getBoundingClientRect();
    if (r)
      setHover({
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        flip: e.clientX - r.left > r.width / 2,
        content,
      });
  };
  const clear = () => {
    setHover(null);
    setFocus(null);
  };

  const groupTooltip = (i: number) => {
    const out = matrix[i].reduce((a, b) => a + b, 0);
    const into = matrix.reduce((s, row) => s + row[i], 0);
    return (
      <>
        <p className="font-medium">{labels[i]}</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
          <dt className="text-muted-foreground">Moves out</dt>
          <dd className="text-right font-medium">{formatInt(out)}</dd>
          <dt className="text-muted-foreground">Moves in</dt>
          <dd className="text-right font-medium">{formatInt(into)}</dd>
        </dl>
      </>
    );
  };

  const ribbonTooltip = (c: Chord) => {
    const back = matrix[c.target.index][c.source.index];
    return (
      <>
        <p className="font-medium">
          {labels[c.source.index]} → {labels[c.target.index]}
        </p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
          <dt className="text-muted-foreground">{unit[0].toUpperCase() + unit.slice(1)}</dt>
          <dd className="text-right font-medium">{formatInt(c.source.value)}</dd>
          <dt className="text-muted-foreground">Share</dt>
          <dd className="text-right">{formatPercent(total ? c.source.value / total : 0)}</dd>
          <dt className="text-muted-foreground">The other way</dt>
          <dd className="text-right">{formatInt(back)}</dd>
        </dl>
      </>
    );
  };

  return (
    <div ref={box} className="relative" onMouseLeave={clear}>
      <svg
        viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
        className="mx-auto block w-full max-w-[460px]"
        role="img"
        aria-label={label}
      >
        <g fillOpacity={0.55}>
          {chords.map((c) => {
            const dim = focus !== null && c.source.index !== focus && c.target.index !== focus;
            return (
              <path
                key={`${c.source.index}>${c.target.index}`}
                d={ribbon(c) as unknown as string}
                fill={colors[c.source.index]}
                stroke="var(--card)"
                strokeWidth={1}
                opacity={dim ? 0.12 : 1}
                className="hover:fill-opacity-90 transition-opacity"
                onMouseMove={(e) => show(e, ribbonTooltip(c))}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </g>
        {chords.groups.map((g) => {
          const mid = (g.startAngle + g.endAngle) / 2;
          const [lx, ly] = point(OUTER + 10, mid);
          const right = mid < Math.PI;
          const big = g.endAngle - g.startAngle > 0.12;
          return (
            <g
              key={g.index}
              onMouseEnter={() => setFocus(g.index)}
              onMouseMove={(e) => show(e, groupTooltip(g.index))}
            >
              {/* Wider transparent hit area than the arc itself. */}
              <path d={arcPath(g.startAngle, g.endAngle, INNER - 4, OUTER + 26)} fill="transparent" />
              <path d={arcPath(g.startAngle, g.endAngle, INNER, OUTER)} fill={colors[g.index]} />
              {big && (
                <text
                  x={lx}
                  y={ly}
                  dy="0.35em"
                  textAnchor={right ? "start" : "end"}
                  className="fill-foreground text-[12px] font-medium"
                >
                  {labels[g.index]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          className="bg-background pointer-events-none absolute z-10 grid min-w-40 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
          style={{
            left: hover.x,
            top: hover.y,
            transform: `translate(${hover.flip ? "calc(-100% - 12px)" : "12px"}, 12px)`,
          }}
        >
          {hover.content}
        </div>
      )}
    </div>
  );
}
