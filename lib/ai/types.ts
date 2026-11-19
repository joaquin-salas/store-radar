import type { UIDataTypes, UIMessage } from "ai";
import type { AssistantTools } from "./tools";

/** A chat message with typed tool parts (`tool-queryMetrics`, …), shared by the route and the panel. */
export type AssistantMessage = UIMessage<never, UIDataTypes, AssistantTools>;

/** Shown when the route can't answer, keyed by `error` in its JSON response. */
export type ChatErrorCode = "not-configured" | "rate-limited" | "too-long" | "bad-request";
