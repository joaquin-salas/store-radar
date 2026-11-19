"use client";

import { useState } from "react";
import { heatStyle } from "@/components/dashboard/heat";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { MatrixEnd } from "@/lib/domain/flow-stats";
import { formatInt, formatPercent } from "@/lib/format";
import type { Flows } from "@/lib/queries";
import { ChordDiagram } from "./chord-diagram";
import { END_LABELS, zoneColor } from "./flow-colors";

type Mode = "chord" | "matrix";

/** Moves between zones, as a chord diagram or a from × to matrix (the table view). */
export function ZoneMoves({ flows }: { flows: Flows | undefined }) {
  const [mode, setMode] = useState<Mode>("chord");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Zone to zone</CardTitle>
        <CardDescription>
          {mode === "chord"
            ? "Moves between zones inside the store; arrows point where people went next."
            : "Every move, from the row zone to the column zone, entering and leaving included."}
        </CardDescription>
        <CardAction>
          <SegmentedControl
            label="View as"
            value={mode}
            options={[
              { value: "chord", label: "Chord" },
              { value: "matrix", label: "Matrix" },
            ]}
            onChange={setMode}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {!flows ? (
          <Skeleton className="mx-auto aspect-square w-full max-w-[420px] rounded-full" />
        ) : mode === "chord" ? (
          <ZoneChord matrix={flows.matrix} />
        ) : (
          <ZoneMatrixTable matrix={flows.matrix} />
        )}
      </CardContent>
    </Card>
  );
}

function ZoneChord({ matrix }: { matrix: Flows["matrix"] }) {
  // Only moves between zones: entering and leaving are in the journey and the matrix.
  const idx = matrix.ends.map((e, i) => ({ e, i })).filter(({ e }) => e !== "entrance" && e !== "left");
  const counts = idx.map(({ i }) => idx.map(({ i: j }) => matrix.counts[i][j]));
  const zones = idx.map(({ e }) => e as Exclude<MatrixEnd, "left">);
  if (counts.flat().every((v) => v === 0)) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">No moves between zones in this range.</p>
    );
  }
  return (
    <>
      <ChordDiagram
        labels={zones.map((z) => END_LABELS[z])}
        colors={zones.map(zoneColor)}
        matrix={counts}
        unit="moves"
        label="Chord diagram of moves between zones. The Matrix view lists every count."
      />
      <ul className="text-muted-foreground mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {zones.map((z) => (
          <li key={z} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: zoneColor(z) }} aria-hidden />
            {END_LABELS[z]}
          </li>
        ))}
      </ul>
    </>
  );
}

function ZoneMatrixTable({ matrix }: { matrix: Flows["matrix"] }) {
  const rows = matrix.ends.slice(0, -1); // nobody moves on from "left"
  const cols = matrix.ends.slice(1); // nobody moves into the entrance
  const total = matrix.counts[0].reduce((a, b) => a + b, 0);
  const max = Math.max(...matrix.counts.flat());
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs tabular-nums">
        <caption className="sr-only">Moves from each zone (rows) to the next (columns)</caption>
        <thead>
          <tr>
            <th scope="col" className="text-muted-foreground p-1 text-left font-normal">
              From ↓ To →
            </th>
            {cols.map((c) => (
              <th key={c} scope="col" className="text-muted-foreground p-1 text-right font-medium">
                {END_LABELS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th scope="row" className="p-1 text-left font-medium whitespace-nowrap">
                {END_LABELS[r]}
              </th>
              {cols.map((c, ci) => {
                const v = matrix.counts[ri][ci + 1];
                return (
                  <td
                    key={c}
                    title={`${END_LABELS[r]} → ${END_LABELS[c]}: ${formatInt(v)} moves (${formatPercent(total ? v / total : 0)} of visits)`}
                    className="rounded-[4px] px-1.5 py-1 text-right"
                    style={heatStyle(v, max)}
                  >
                    {v === 0 ? <span className="text-muted-foreground">–</span> : formatInt(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
