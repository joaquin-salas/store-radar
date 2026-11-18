/**
 * Helpers for the route handlers: parse/validate query strings with the shared
 * Zod schemas and return consistent JSON responses.
 */
import { z } from "zod";
import { rangeSchema, storeScopeSchema } from "./domain/schemas";

export const scopedQuerySchema = z.object({
  store: storeScopeSchema.default("all"),
  range: rangeSchema,
});

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: Response };

function searchParamsObject(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

function badRequest(error: z.ZodError): Response {
  return Response.json({ error: "Invalid query", issues: z.flattenError(error) }, { status: 400 });
}

/** Parses a flat query string with any schema. */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): ParseResult<z.infer<S>> {
  const result = schema.safeParse(searchParamsObject(request));
  return result.success ? { ok: true, data: result.data } : { ok: false, response: badRequest(result.error) };
}

/**
 * Parses `?store=…&preset=…` or `?store=…&from=…&to=…` into `{ store, range }`.
 * Extra fields can be validated with `extra`.
 */
export function parseScopedQuery<E extends z.ZodRawShape = Record<never, never>>(
  request: Request,
  extra?: E,
): ParseResult<z.infer<typeof scopedQuerySchema> & z.infer<z.ZodObject<E>>> {
  const { store, preset, from, to, ...rest } = searchParamsObject(request);
  const schema = scopedQuerySchema.extend(extra ?? ({} as E));
  const result = schema.safeParse({ store, range: { preset, from, to }, ...rest });
  return result.success
    ? { ok: true, data: result.data as z.infer<typeof scopedQuerySchema> & z.infer<z.ZodObject<E>> }
    : { ok: false, response: badRequest(result.error) };
}

/** JSON response for live data — never cached by browsers or the CDN. */
export function json(data: unknown): Response {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
