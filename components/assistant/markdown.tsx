"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * The little markdown the assistant writes: paragraphs, bullet and numbered
 * lists, **bold**, `code` and links. Only links to pages of this app
 * ("/mad-granvia/analytics?preset=7d") become links; anything else stays text,
 * so a model can never put an outside link in front of the user.
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {parseBlocks(text).map((block, i) => {
        if (block.kind === "p") {
          return (
            <p key={i}>
              {block.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = block.kind;
        return (
          <List key={i} className={List === "ol" ? "list-decimal pl-5" : "list-disc pl-5"}>
            {block.lines.map((l, j) => (
              <li key={j}>{inline(l)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

type Block = { kind: "p" | "ul" | "ol"; lines: string[] };

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
/** Lines that only point at or re-title the chart ("(Chart above)", "(Bar) Visitors per hour"): it's right there. */
const CHART_POINTER =
  /^(\(?\s*(see\s+)?(the\s+)?(chart|table|graph)(\s+(above|below|shown))?\s*\)?[.:]?|\((bar|line|table|chart|number)\).*)$/i;

/** Splits text into paragraphs and lists; a list can follow a line of text without a blank line. */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current = null as Block | null;
  for (const raw of text.trim().split("\n")) {
    const line = raw.trim();
    if (!line || CHART_POINTER.test(line)) {
      current = null;
      continue;
    }
    const kind = BULLET.test(line) ? "ul" : NUMBER.test(line) ? "ol" : "p";
    const content = line
      .replace(BULLET, "")
      .replace(NUMBER, "")
      .replace(/^#+\s+/, "");
    if (current?.kind !== kind) {
      current = { kind, lines: [] };
      blocks.push(current);
    }
    current.lines.push(content);
  }
  return blocks;
}

/** A bare app path written without link syntax, e.g. /mad-granvia/flows?preset=7d. */
const APP_PATH =
  /\/(?:all|[a-z]+-[a-z]+)\/(?:live|analytics|visits|customers|flows)(?:\?[^\s)]*[^\s).,;:!?])?/;
const TOKEN = new RegExp(
  String.raw`(\*\*[^*]+\*\*|` + "`[^`]+`" + String.raw`|\[[^\]]+\]\([^)\s]+\)|${APP_PATH.source})`,
  "g",
);
const BARE_PATH = new RegExp(`^${APP_PATH.source}$`);
const LINK_CLASS =
  "decoration-line-control hover:decoration-foreground font-medium underline underline-offset-2";

function inline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-muted rounded-sm px-1 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (BARE_PATH.test(part)) {
      const view = part.split("/")[2].split("?")[0];
      return (
        <Link key={i} href={part} className={LINK_CLASS}>
          Open {view.charAt(0).toUpperCase() + view.slice(1)}
        </Link>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith("/") && !href.startsWith("//")) {
        return (
          <Link key={i} href={href} className={LINK_CLASS}>
            {label}
          </Link>
        );
      }
      return <Fragment key={i}>{label}</Fragment>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
