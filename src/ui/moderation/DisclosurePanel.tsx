"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/ui/primitives/button";

type Result = { ok: true } | { ok: false; error: string };

export type DisclosureRow = {
  id: string;
  receivedOn: string;
  requester: string;
  reference: string | null;
  kind: string;
  summary: string;
  noteId: string | null;
  userId: string | null;
};

type Props = {
  items: DisclosureRow[];
  onAdd: (input: {
    receivedOn: string;
    requester: string;
    reference: string;
    kind: string;
    summary: string;
    noteId: string;
    userId: string;
  }) => Promise<Result>;
};

const KINDS = [
  { value: "subscriber_info", label: "Subscriber information" },
  { value: "traffic_data", label: "Traffic data" },
  { value: "content", label: "Content" },
  { value: "other", label: "Other" },
];

const INPUT =
  "mt-1 w-full rounded-md border border-border bg-background p-2 text-sm";

function kindLabel(kind: string) {
  return KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function formatDay(day: string) {
  // A plain date (no time): print it in UTC so it never shifts a day.
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function DisclosurePanel({ items, onAdd }: Props) {
  const router = useRouter();
  const [receivedOn, setReceivedOn] = useState("");
  const [requester, setRequester] = useState("");
  const [reference, setReference] = useState("");
  const [kind, setKind] = useState("subscriber_info");
  const [summary, setSummary] = useState("");
  const [noteId, setNoteId] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onAdd({
          receivedOn,
          requester,
          reference,
          kind,
          summary,
          noteId: noteId.trim(),
          userId: userId.trim(),
        });
        if (result.ok) {
          setReceivedOn("");
          setRequester("");
          setReference("");
          setKind("subscriber_info");
          setSummary("");
          setNoteId("");
          setUserId("");
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border p-4">
        <h2 className="font-serif text-xl font-bold">Record a request</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every request from an authority, and what you handed over. A row
          cannot be edited or deleted afterwards. Put a legal hold on the
          related reports first.
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending) submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Date received
              <input
                type="date"
                required
                value={receivedOn}
                onChange={(event) => setReceivedOn(event.target.value)}
                disabled={pending}
                className={INPUT}
              />
            </label>
            <label className="block text-sm font-medium">
              Kind
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                disabled={pending}
                className={INPUT}
              >
                {KINDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium">
            Who asked
            <input
              type="text"
              required
              maxLength={200}
              value={requester}
              onChange={(event) => setRequester(event.target.value)}
              disabled={pending}
              className={INPUT}
            />
          </label>

          <label className="block text-sm font-medium">
            Reference number (optional)
            <input
              type="text"
              maxLength={100}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              disabled={pending}
              className={INPUT}
            />
          </label>

          <label className="block text-sm font-medium">
            What was handed over
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              disabled={pending}
              className={INPUT}
            />
          </label>
          <p className="-mt-2 text-xs text-muted-foreground">
            {summary.length}/1000
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Note id (optional)
              <input
                type="text"
                value={noteId}
                onChange={(event) => setNoteId(event.target.value)}
                disabled={pending}
                className={INPUT}
              />
            </label>
            <label className="block text-sm font-medium">
              Account id (optional)
              <input
                type="text"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                disabled={pending}
                className={INPUT}
              />
            </label>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="rounded-full px-5" disabled={pending}>
            {pending ? "Saving..." : "Add to the log"}
          </Button>
        </form>
      </section>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-serif text-lg font-bold">
                  {item.requester}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {formatDay(item.receivedOn)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {kindLabel(item.kind)}
                {item.reference ? ` · Ref. ${item.reference}` : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm">
                {item.summary}
              </p>
              {item.noteId || item.userId ? (
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  {item.noteId ? `Note ${item.noteId}` : ""}
                  {item.noteId && item.userId ? " · " : ""}
                  {item.userId ? `Account ${item.userId}` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}