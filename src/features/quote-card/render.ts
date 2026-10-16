export type QuoteCardInput = {
  quote: string;
  title: string;
  authors: string;
  site: string;
  // CSS font-family of the article, so the card matches what the reader sees.
  fontFamily: string;
};

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 96;
// The same values as the light theme in globals.css, so a shared card looks
// like Skrib. The card is always light, whatever theme the reader uses.
const BG = "#FAFAF8";
const INK = "#1A1A1A";
const MUTED = "#6B6B66";
const ACCENT = "#4F46E5";

// Right-to-left when most letters are Arabic or Hebrew script.
function isRtl(text: string): boolean {
  const rtl = (
    text.match(/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g) ?? []
  ).length;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  return letters > 0 && rtl / letters > 0.5;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

export async function renderQuoteCard(
  input: QuoteCardInput,
): Promise<HTMLCanvasElement> {
  const { quote, title, authors, site, fontFamily } = input;
  const rtl = isRtl(quote);

  try {
    await document.fonts.load(`400 48px ${fontFamily}`, quote);
    await document.fonts.load(`700 36px ${fontFamily}`, title);
    await document.fonts.ready;
  } catch {
    // The card is still drawn with a fallback font.
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas is not available");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, WIDTH, 12);

  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.textBaseline = "alphabetic";
  const x = rtl ? WIDTH - PAD : PAD;
  const maxWidth = WIDTH - PAD * 2;

  // Footer, from the bottom up.
  const siteY = HEIGHT - PAD;
  const authorY = siteY - 52;
  const titleY = authorY - 52;
  const ruleY = titleY - 64;

  ctx.fillStyle = MUTED;
  ctx.font = `400 28px ${fontFamily}`;
  ctx.fillText(ellipsize(ctx, site, maxWidth), x, siteY);

  ctx.fillStyle = INK;
  ctx.font = `400 32px ${fontFamily}`;
  ctx.fillText(ellipsize(ctx, authors, maxWidth), x, authorY);

  ctx.font = `700 36px ${fontFamily}`;
  ctx.fillText(ellipsize(ctx, title, maxWidth), x, titleY);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(rtl ? x - 96 : x, ruleY, 96, 4);

  // Decorative opening quote mark.
  ctx.font = `700 200px ${fontFamily}`;
  ctx.fillText("\u201C", x, PAD + 170);

  // The quote: the largest size that fits between the mark and the rule.
  const regionTop = PAD + 150;
  const regionHeight = ruleY - 56 - regionTop;
  let size = 88;
  let lineHeight = 0;
  let lines: string[] = [];
  for (let s = 88; s >= 32; s -= 4) {
    size = s;
    ctx.font = `400 ${s}px ${fontFamily}`;
    lineHeight = Math.round(s * 1.35);
    lines = wrapLines(ctx, quote, maxWidth);
    const fits =
      lines.length * lineHeight <= regionHeight &&
      lines.every((line) => ctx.measureText(line).width <= maxWidth);
    if (fits) break;
  }

  ctx.fillStyle = INK;
  const blockHeight = lines.length * lineHeight;
  let y =
    regionTop +
    Math.max(0, Math.round((regionHeight - blockHeight) / 2)) +
    Math.round(size * 0.95);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("could not encode the card")),
      "image/png",
    );
  });
}