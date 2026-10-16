// Pure Markdown builder for the highlights export. No data access here.

export type ExportHighlight = {
  quote: string;
  note: string | null;
  createdAt: string;
};

export type ExportGroup = {
  title: string;
  author: string | null;
  date: string | null;
  url: string | null;
  highlights: ExportHighlight[];
};

function escapeTitle(text: string): string {
  return text.replace(/[[\]]/g, "\\$&").replace(/\s+/g, " ").trim();
}

// Every line of a multi-line quote needs its own "> " prefix.
function quoteBlock(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");
}

export function buildHighlightsMarkdown(
  groups: ExportGroup[],
  exportedAt: Date,
): string {
  const total = groups.reduce((sum, group) => sum + group.highlights.length, 0);
  const lines: string[] = [
    "# Highlights",
    "",
    `_Exported from Skrib on ${exportedAt.toISOString().slice(0, 10)}: ${total} ${total === 1 ? "highlight" : "highlights"} in ${groups.length} ${groups.length === 1 ? "story" : "stories"}._`,
    "",
  ];

  for (const group of groups) {
    const title = escapeTitle(group.title);
    lines.push(group.url ? `## [${title}](${group.url})` : `## ${title}`);
    const meta = [group.author, group.date].filter(Boolean).join(", ");
    if (meta) lines.push("", meta);
    for (const item of group.highlights) {
      lines.push("", quoteBlock(item.quote));
      if (item.note) {
        const note = item.note.trim().split(/\r?\n/);
        lines.push("", `**Note:** ${note[0]}`, ...note.slice(1));
      }
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}