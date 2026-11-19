import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { buildInstructions, pageContextSchema } from "@/lib/ai/instructions";
import { allowRequest } from "@/lib/ai/rate-limit";
import { tools } from "@/lib/ai/tools";
import type { AssistantMessage, ChatErrorCode } from "@/lib/ai/types";
import { localNow } from "@/lib/domain/time";

/** Small, fast model that handles tools well; the fallback takes over if it's rate-limited or down. */
const MODEL = "openai/gpt-5-mini";
const FALLBACK_MODEL = "google/gemini-2.5-flash-lite";

/** Cost guards. */
const MAX_STEPS = 6;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 1500;
const RATE_LIMIT = { requests: 20, windowMs: 10 * 60 * 1000 };

export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.unknown()).min(1).max(200),
  page: pageContextSchema,
});

function fail(error: ChatErrorCode, status: number) {
  return Response.json({ error }, { status });
}

/** A plain-language message for the chat instead of a stack trace. */
function friendlyError(error: unknown): string {
  const e = error as { statusCode?: number; name?: string; message?: string };
  const text = `${e?.name ?? ""} ${e?.message ?? ""}`.toLowerCase();
  if (e?.statusCode === 429 || text.includes("rate limit")) {
    return "The assistant is busy right now (rate limit). Try again in a minute.";
  }
  if (e?.statusCode === 402 || text.includes("credit") || text.includes("budget")) {
    return "The assistant has used up its AI credit for this month.";
  }
  if (text.includes("authentication")) return "The assistant isn't connected to the AI Gateway.";
  return "Something went wrong while answering. Try again or rephrase the question.";
}

/**
 * Whether the AI Gateway can authenticate: an API key, the OIDC token from
 * `vercel env pull` (local), or, on Vercel, the token Vercel puts on each
 * request's `x-vercel-oidc-token` header (it isn't an env var at runtime).
 */
const hasGatewayAuth = (request: Request) =>
  Boolean(
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    request.headers.get("x-vercel-oidc-token"),
  );

export async function POST(request: Request) {
  if (!hasGatewayAuth(request)) return fail("not-configured", 503);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(ip, RATE_LIMIT.requests, RATE_LIMIT.windowMs, Date.now()))
    return fail("rate-limited", 429);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("bad-request", 400);

  const validated = await safeValidateUIMessages<AssistantMessage>({ messages: body.data.messages, tools });
  if (!validated.success) return fail("bad-request", 400);
  const messages = validated.data.slice(-MAX_HISTORY);

  const last = messages.at(-1);
  const lastText = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
  if (last?.role !== "user" || lastText.length > MAX_MESSAGE_CHARS) return fail("too-long", 400);

  const result = streamText({
    model: MODEL,
    instructions: buildInstructions(localNow(), body.data.page),
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    providerOptions: {
      gateway: { models: [FALLBACK_MODEL] },
      openai: { reasoningEffort: "low" },
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<typeof tools, AssistantMessage>({
      stream: result.stream,
      tools,
      originalMessages: messages,
      // The panel doesn't show reasoning; don't send the model's working notes to the browser.
      sendReasoning: false,
      onError: friendlyError,
      redactToolErrors: false,
    }),
  });
}
