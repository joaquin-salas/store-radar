/**
 * Downloads for assistant charts: the data as CSV, the chart as a standalone
 * SVG. The SVG is a copy of the rendered chart with every computed colour and
 * font written inline (theme variables don't exist outside the page), plus the
 * title, period and legend, which live in HTML on screen. It keeps the current
 * theme's colours.
 */

export function downloadFile(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** "Visitors per hour · Madrid" → "visitors-per-hour-madrid". */
export const fileSlug = (title: string) =>
  title
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "chart";

/** Presentation properties copied from computed styles onto the exported elements. */
const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "opacity",
  "font-size",
  "font-weight",
] as const;

/** next/font gives hashed family names; map them back to names other apps know. */
function fontFor(computed: string): string {
  return /jetbrains|mono/i.test(computed)
    ? "'JetBrains Mono', ui-monospace, monospace"
    : "Archivo, system-ui, sans-serif";
}

const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

/** Resolves any CSS colour (including `var(--chart-1)`) to a concrete value in `scope`. */
function resolveColor(color: string, scope: Element): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  scope.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

export interface SvgExportOptions {
  /** Element holding the rendered chart (its first `svg.recharts-surface`). */
  chart: HTMLElement;
  /** Element whose background and text colours the export uses (the card). */
  surface: HTMLElement;
  title: string;
  subtitle: string;
  /** Series for the legend; empty for a single series. */
  legend: { label: string; color: string }[];
}

export function chartToSvg({ chart, surface, title, subtitle, legend }: SvgExportOptions): string | null {
  const source = chart.querySelector<SVGSVGElement>("svg.recharts-surface");
  if (!source) return null;

  const { width, height } = source.getBoundingClientRect();
  const copy = source.cloneNode(true) as SVGSVGElement;
  const originals = [source, ...source.querySelectorAll("*")];
  const copies = [copy, ...copy.querySelectorAll("*")];
  originals.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const target = copies[i] as SVGElement;
    const style = STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`);
    if (el.tagName === "text" || el.tagName === "tspan") style.push(`font-family:${fontFor(cs.fontFamily)}`);
    target.setAttribute("style", style.join(";"));
    target.removeAttribute("class");
    // Attributes that point at theme variables are already resolved in `style`.
    for (const attr of [...target.attributes]) {
      if (attr.value.includes("var(--")) target.removeAttribute(attr.name);
    }
  });

  const surfaceStyle = getComputedStyle(surface);
  const background = surfaceStyle.backgroundColor;
  const ink = surfaceStyle.color;
  const muted = resolveColor("var(--muted-foreground)", surface);
  const pad = 16;
  const headerH = 52;

  // Legend rows below the chart, wrapping at the chart's width.
  const items: string[] = [];
  let x = pad;
  let y = 0;
  for (const item of legend) {
    const w = 18 + item.label.length * 6.6 + 16;
    if (x + w > width + pad && x > pad) {
      x = pad;
      y += 20;
    }
    items.push(
      `<rect x="${x}" y="${y}" width="10" height="10" rx="2" fill="${resolveColor(item.color, surface)}"/>` +
        `<text x="${x + 16}" y="${y + 9}" font-size="12" fill="${ink}">${escapeXml(item.label)}</text>`,
    );
    x += w;
  }
  const legendH = legend.length ? y + 28 : 0;

  copy.setAttribute("x", String(pad));
  copy.setAttribute("y", String(headerH));
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  copy.removeAttribute("style");

  const totalW = Math.ceil(width + pad * 2);
  const totalH = Math.ceil(headerH + height + legendH + pad);
  const font = "Archivo, system-ui, sans-serif";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" font-family="${font}">`,
    `<rect width="100%" height="100%" fill="${background}"/>`,
    `<text x="${pad}" y="26" font-size="15" font-weight="600" fill="${ink}">${escapeXml(title)}</text>`,
    `<text x="${pad}" y="44" font-size="12" fill="${muted}">${escapeXml(subtitle)}</text>`,
    new XMLSerializer().serializeToString(copy),
    legend.length ? `<g transform="translate(0 ${headerH + height + 12})">${items.join("")}</g>` : "",
    `</svg>`,
  ].join("");
}
