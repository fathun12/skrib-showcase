"use client";

import { useState, useTransition } from "react";

export type ExportResult =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

// The server action comes in as a prop (the page passes it), so this file
// stays free of data access.
export function ExportButton({
  exportAction,
}: {
  exportAction: () => Promise<ExportResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await exportAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.markdown], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `skrib-highlights-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {pending ? "Preparing…" : "Export"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}