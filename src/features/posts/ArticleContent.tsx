import type { ReactNode } from "react";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { baseExtensions } from "@/features/editor/extensions";
import { isOwnCloudinaryImageUrl } from "@/features/uploads/validate";
import { ArticleBody } from "@/ui/post/ArticleBody";
import { toImageAlign } from "@/ui/image-align";
import { ArticleImage } from "@/ui/post/ArticleImage";
import { listHeadings } from "./headings";
import type { TiptapNode } from "./schemas";

// Defence in depth: the save schema already blocks other protocols, but the
// reader should never emit a javascript: link even if bad data got in.
const SAFE_HREF = /^(https?:|mailto:)/i;

// Stored sizes are not validated on save, so check them here. Anything that
// is not a sane positive number is treated as "no size".
function positiveSize(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 10_000
    ? Math.round(value)
    : undefined;
}

type ArticleContentProps = {
  content: TiptapNode;
  // Current username of each mentioned account, by user id. Without it (the
  // preview, moderation) a mention uses the name it was written with.
  mentionNames?: Record<string, string>;
};

// Turns the stored Tiptap JSON into React elements on the server. No editor
// and no Tiptap code is sent to the browser (spec section 7.3).
function renderDoc(
  content: TiptapNode,
  mentionNames: Record<string, string> | undefined,
): ReactNode {
  // The n-th heading drawn gets the anchor of the n-th entry (the same list
  // feeds the "On this page" menu).
  const headings = listHeadings(content);
  let headingIndex = 0;

  return renderToReactElement({
    extensions: baseExtensions,
    content,
    options: {
      markMapping: {
        link: ({ mark, children }) => {
          const href: unknown = mark.attrs.href;
          if (typeof href !== "string" || !SAFE_HREF.test(href)) {
            return <>{children}</>;
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          );
        },
      },
      nodeMapping: {
        heading: ({ node, children }) => {
          const entry = headings[headingIndex];
          headingIndex += 1;
          const raw: unknown = node.attrs.level;
          const level = typeof raw === "number" && raw >= 1 && raw <= 6 ? raw : 2;
          const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
          const id = entry?.id ?? undefined;
          return (
            <Tag id={id}>
              {children}
              {id && (level === 2 || level === 3) ? (
                // The "#" glyph comes from CSS (.heading-anchor::before), so it
                // is never part of the selected or copied text.
                <a
                  href={`#${id}`}
                  className="heading-anchor"
                  aria-label="Link to this section"
                />
              ) : null}
            </Tag>
          );
        },
        // A person named in the story. The label is checked again here
        // (defence in depth). The link follows the CURRENT username (found by
        // user id); an id that no longer exists is shown as plain text.
        mention: ({ node }) => {
          const label: unknown = node.attrs.label;
          const id: unknown = node.attrs.id;
          if (typeof label !== "string" || !/^[a-z0-9_-]{3,30}$/.test(label)) {
            return null;
          }
          let username = label;
          if (mentionNames && typeof id === "string") {
            const current: string | undefined = mentionNames[id];
            if (current === undefined) return <>@{label}</>;
            username = current;
          }
          return (
            <a
              href={`/${username}`}
              className="rounded-md bg-primary/10 px-1 font-medium text-primary no-underline hover:underline"
            >
              @{username}
            </a>
          );
        },
        image: ({ node }) => {
          const attrs: Record<string, unknown> = node.attrs;
          const src = attrs.src;
          // Defence in depth, same idea as the link mapping: the save schema
          // already limits images to our Cloudinary account.
          if (
            typeof src !== "string" ||
            !isOwnCloudinaryImageUrl(
              src,
              process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            )
          ) {
            return null;
          }
          return (
            <ArticleImage
              src={src}
              alt={typeof attrs.alt === "string" ? attrs.alt : ""}
              caption={
                typeof attrs.caption === "string" ? attrs.caption : undefined
              }
              align={toImageAlign(attrs.align)}
              width={positiveSize(attrs.width)}
              height={positiveSize(attrs.height)}
            />
          );
        },
      },
      // An unknown node or mark must not crash the page.
      unhandledNode: () => null,
      unhandledMark: ({ children }) => <>{children}</>,
    },
  });
}

export function ArticleContent({
  content,
  mentionNames,
}: ArticleContentProps) {
  let rendered: ReactNode = null;
  try {
    rendered = renderDoc(content, mentionNames);
  } catch (error) {
    // Content that does not match the schema throws while the document is
    // built; show a calm message instead of a 500 page.
    console.error("ArticleContent render failed:", error);
  }

  return (
    <ArticleBody>
      {rendered ?? <p>This article could not be displayed.</p>}
    </ArticleBody>
  );
}