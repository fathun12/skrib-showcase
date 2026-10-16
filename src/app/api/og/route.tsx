import { ImageResponse } from "next/og";

// Loads the serif face of the "Skrib" wordmark (same family as the site and
// the iPhone start-up screen). Only the letters of the word are downloaded.
// If the download fails, null is returned and the image uses the default font.
async function loadTitleFont(): Promise<ArrayBuffer | null> {
  try {
    const cssResponse = await fetch(
      "https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@700&text=Skrib",
    );
    const css = await cssResponse.text();
    const url = css.match(
      /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
    )?.[1];
    if (!url) return null;
    const fontResponse = await fetch(url);
    return fontResponse.ok ? await fontResponse.arrayBuffer() : null;
  } catch {
    return null;
  }
}

// The default link preview (WhatsApp, X, Telegram...) for every page that has
// no image of its own. It copies the iPhone start-up screen: "Skrib" with an
// indigo dot, and the tagline below. Colours are the light tokens of
// globals.css written out, because an image is drawn outside the page and
// cannot read CSS variables.
export async function GET() {
  const font = await loadTitleFont();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          paddingLeft: 96,
          background: "#FAFAF8",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div
            style={{
              fontFamily: font ? "Source Serif 4" : undefined,
              fontSize: 190,
              fontWeight: 700,
              color: "#1A1A1A",
              letterSpacing: -6,
              lineHeight: 1,
            }}
          >
            Skrib
          </div>
          <div
            style={{
              width: 30,
              height: 30,
              marginLeft: 8,
              marginBottom: 22,
              borderRadius: 15,
              background: "#4F46E5",
            }}
          />
        </div>
        <div style={{ fontSize: 40, color: "#6B6B66", marginTop: 28 }}>
          A calm place to read and write.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font
        ? [
            {
              name: "Source Serif 4",
              data: font,
              weight: 700,
              style: "normal",
            },
          ]
        : undefined,
      // The picture never changes, so let browsers and the CDN keep it a day.
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}