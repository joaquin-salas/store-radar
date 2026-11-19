/**
 * How the assistant asks for a query result to be shown. The model only picks
 * a chart kind and a title; the numbers always come from the domain query, and
 * the client draws them with the dashboard's own chart components.
 */
import { z } from "zod";

export const DISPLAY_KINDS = ["bar", "line", "table", "number"] as const;
export type DisplayKind = (typeof DISPLAY_KINDS)[number];

export const displaySchema = z
  .object({
    kind: z
      .enum(DISPLAY_KINDS)
      .describe(
        '"line" for trends over date or hour, "bar" to compare stores, zones, weekdays or hours, ' +
          '"table" for rankings or several metrics, "number" for a single total (no groupBy)',
      ),
    title: z
      .string()
      .max(80)
      .describe(
        "Short title naming metric, store and period, e.g. 'Visitors per hour · Madrid · last 7 days'",
      ),
  })
  .describe("How to show the result in the chat");

export type Display = z.infer<typeof displaySchema>;
