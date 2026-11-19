"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { AssistantMessage, ChatErrorCode } from "@/lib/ai/types";

/**
 * One conversation for the whole tab, kept outside React so closing the panel
 * (or the mobile sheet) doesn't lose it. It resets on reload.
 */
export const assistantChat = new Chat<AssistantMessage>({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});

const ERROR_TEXT: Record<ChatErrorCode, string> = {
  "not-configured": "The assistant isn't connected to an AI model on this deployment.",
  "rate-limited": "You've asked a lot of questions in a short time. Try again in a few minutes.",
  "too-long": "That message is too long. Try a shorter question.",
  "bad-request": "Something was wrong with the request. Start a new chat and try again.",
};

/** A readable message for a failed request (the route answers with `{ error: code }`). */
export function chatErrorText(error: Error): string {
  try {
    const code = (JSON.parse(error.message) as { error?: ChatErrorCode }).error;
    if (code && code in ERROR_TEXT) return ERROR_TEXT[code];
  } catch {
    // Not JSON: a network error or a stream error, already readable.
  }
  return error.message || "Something went wrong. Try again.";
}
