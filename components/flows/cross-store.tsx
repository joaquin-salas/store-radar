"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt, formatPercent } from "@/lib/format";
import type { Flows } from "@/lib/queries";
import { ChordDiagram } from "./chord-diagram";
import { STORE_COLORS } from "./flow-colors";

/**
 * Loyalty members shopping away from their home store (whole chain only).
 * The chord shows visits to other stores; the table adds visits at home.
 */
export function CrossStore({ data }: { data: NonNullable<Flows["crossStore"]> }) {
  const names = data.stores.map((s) => s.name);
  const away = data.visits.map((row, i) => row.map((v, j) => (i === j ? 0 : v)));
  const anyAway = away.flat().some((v) => v > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members across stores</CardTitle>
        <CardDescription className="tabular-nums">
          Loyalty member visits by home store and store visited · {formatPercent(data.awayShare)} were away
          from home · all members, whatever the visitor filter
        </CardDescription>
      </CardHeader>
      <CardContent className="grid items-center gap-6 @3xl:grid-cols-2">
        {anyAway ? (
          <ChordDiagram
            labels={names}
            colors={STORE_COLORS}
            matrix={away}
            unit="visits"
            label="Chord diagram of member visits to stores other than their home store. The table lists every count."
          />
        ) : (
          <p className="text-muted-foreground py-16 text-center text-sm">
            No visits away from home in this range.
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Members of</TableHead>
              {names.map((n) => (
                <TableHead key={n} className="text-right whitespace-normal">
                  {n}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.stores.map((s, i) => {
              const total = data.visits[i].reduce((a, b) => a + b, 0);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-[3px]"
                        style={{ background: STORE_COLORS[i] }}
                        aria-hidden
                      />
                      {s.name}
                    </span>
                  </TableCell>
                  {data.visits[i].map((v, j) => (
                    <TableCell key={j} className="text-right tabular-nums">
                      <span className={i === j ? "text-muted-foreground" : "font-medium"}>
                        {formatInt(v)}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {i === j ? "home" : formatPercent(total ? v / total : 0)}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
