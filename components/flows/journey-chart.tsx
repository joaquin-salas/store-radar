"use client";

import { Sankey, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { JOURNEY_STEPS, type JourneyNode } from "@/lib/domain/flow-stats";
import { formatInt, formatPercent } from "@/lib/format";
import type { Flows } from "@/lib/queries";
import { zoneColor } from "./flow-colors";

const NODE_WIDTH = 10;
const MARGIN = { top: 8, right: 8, bottom: 8, left: 8 };
const ORDINALS = ["1st", "2nd"];

/** Column headings by step; the last column is the outcome. */
function columnLabel(step: number, last: number): string {
  if (step === 0) return "Walked in";
  if (step === last) return "Outcome";
  if (step <= JOURNEY_STEPS) return `${ORDINALS[step - 1]} stop`;
  return `${JOURNEY_STEPS + 1}+ stops`;
}

type SankeyNode = JourneyNode & { name: string };

/**
 * The journey as a Sankey: where visitors go first and second, and how
 * the visit ends. Zones are coloured by identity (product zones and fitting
 * rooms); start, more stops and both outcomes stay neutral.
 */
export function JourneyChart({ flows }: { flows: Flows | undefined }) {
  const total = flows?.kpis.visits ?? 0;
  const steps = flows ? [...new Set(flows.journey.nodes.map((n) => n.step))] : [];
  // Recharts places sinks in the last column, so columns are the steps present, in order.
  const last = steps.at(-1) ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journey through the store</CardTitle>
        <CardDescription>
          Finished visits, stop by stop: the first and second zone after the entrance, then how the visit
          ended. Hover a band for its count.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!flows ? (
          <Skeleton className="h-[380px] w-full rounded-lg" />
        ) : total === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No finished visits in this range.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <div className="min-w-[640px]">
              <div className="text-muted-foreground relative mb-1 h-4 text-xs">
                {steps.map((step, i) => {
                  const at = steps.length > 1 ? i / (steps.length - 1) : 0;
                  return (
                    <span
                      key={step}
                      className="absolute whitespace-nowrap"
                      style={{
                        left: `calc(${MARGIN.left}px + ${at} * (100% - ${MARGIN.left + MARGIN.right + NODE_WIDTH}px))`,
                        transform: i === steps.length - 1 ? "translateX(calc(-100% + 10px))" : undefined,
                      }}
                    >
                      {columnLabel(step, last)}
                    </span>
                  );
                })}
              </div>
              <ChartContainer config={{}} className="aspect-auto h-[380px] w-full">
                <Sankey
                  data={{
                    nodes: flows.journey.nodes.map((n) => ({ ...n, name: n.label })),
                    links: flows.journey.links,
                  }}
                  nodeWidth={NODE_WIDTH}
                  nodePadding={14}
                  margin={MARGIN}
                  sort={false}
                  linkCurvature={0.5}
                  // Recharts types nodes generically; ours carry the JourneyNode fields.
                  node={(props) => (
                    <JourneyNodeShape {...(props as unknown as NodeShapeProps)} last={last} total={total} />
                  )}
                  link={(props) => <JourneyLinkShape {...(props as unknown as LinkShapeProps)} />}
                >
                  <Tooltip content={<JourneyTooltip total={total} />} />
                </Sankey>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface NodeShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: SankeyNode & { depth: number };
}

function JourneyNodeShape({
  x,
  y,
  width,
  height,
  payload,
  last,
  total,
}: NodeShapeProps & {
  last: number;
  total: number;
}) {
  const atEnd = payload.step === last;
  const showLabel = height >= 12;
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 1)} rx={2} fill={zoneColor(payload.zone)} />
      {showLabel && (
        <text
          x={atEnd ? x - 6 : x + width + 6}
          y={y + height / 2}
          dy="0.35em"
          textAnchor={atEnd ? "end" : "start"}
          className="fill-foreground text-[11px]"
          // A halo in the card colour keeps labels readable over the bands.
          style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 3, strokeLinejoin: "round" }}
        >
          <tspan className="font-medium">{payload.label}</tspan>
          {height >= 26 && (
            <tspan className="fill-muted-foreground" dx={4}>
              {formatPercent(payload.value / total)}
            </tspan>
          )}
        </text>
      )}
    </g>
  );
}

interface LinkShapeProps {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  payload: { source: SankeyNode; target: SankeyNode; value: number };
}

function JourneyLinkShape({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
}: LinkShapeProps) {
  // A band takes the colour of the zone it comes from, or the zone it enters
  // when it starts at the entrance; bands into the outcome stay neutral so the
  // walk between zones stands out.
  const outcome = payload.target.kind === "checkout" || payload.target.kind === "left";
  const zone = outcome ? null : payload.source.kind === "start" ? payload.target.zone : payload.source.zone;
  return (
    <path
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={zoneColor(zone)}
      strokeWidth={Math.max(linkWidth, 1)}
      strokeOpacity={outcome ? 0.22 : 0.35}
      className="transition-[stroke-opacity] hover:[stroke-opacity:0.65]"
    />
  );
}

function JourneyTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload: { payload?: unknown } & Record<string, unknown> }[];
  total: number;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  // Recharts wraps the hovered link or node; links carry source and target nodes.
  const data = (item.payload ?? item) as Partial<LinkShapeProps["payload"]> & Partial<SankeyNode>;
  const isLink = typeof data.source === "object" && typeof data.target === "object";
  const value = data.value ?? 0;
  return (
    <div className="bg-background grid min-w-40 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{isLink ? `${data.source!.label} → ${data.target!.label}` : data.label}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground">Visits</dt>
        <dd className="text-right font-medium">{formatInt(value)}</dd>
        <dt className="text-muted-foreground">Share of visits</dt>
        <dd className="text-right">{formatPercent(total ? value / total : 0)}</dd>
      </dl>
    </div>
  );
}
