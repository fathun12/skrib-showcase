"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReportButton } from "@/ui/post/ReportButton";
import { ReportDialog } from "@/ui/post/ReportDialog";
import type { ReportReason } from "@/ui/post/report-reasons";
import { reportSeries } from "./report-actions";

type Props = {
  seriesId: string;
  // Where a signed-out visitor returns to after signing in.
  returnPath: string;
  signedIn: boolean;
};

export function ReportSeriesButtonConnected({
  seriesId,
  returnPath,
  signedIn,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    // Logged-out visitors sign in first and come back to this series.
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    setOpen(true);
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setReason(null);
    setDetails("");
    setError(null);
    setSent(false);
  }

  function handleSubmit() {
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await reportSeries({ seriesId, reason, details });
        if (result.ok) setSent(true);
        else setError(result.error);
      } catch {
        // A network failure must not crash the page.
        setError("Could not send the report. Please try again.");
      }
    });
  }

  return (
    <>
      <ReportButton ariaLabel="Report this series" onClick={handleOpen} />
      <ReportDialog
        open={open}
        title="Report this series"
        description="Tell us what is wrong with this series. The author will not see who reported it."
        reason={reason}
        details={details}
        pending={pending}
        sent={sent}
        error={error}
        onReasonChange={setReason}
        onDetailsChange={setDetails}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    </>
  );
}