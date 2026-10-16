"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaptionReportButton } from "@/ui/post/CaptionReportButton";
import { ReportDialog } from "@/ui/post/ReportDialog";
import type { ReportReason } from "@/ui/post/report-reasons";
import { reportRepostCaption } from "./actions";

type Props = {
  // The person who reposted, and the story: together they identify the caption.
  reposterId: string;
  postId: string;
  // Where a signed-out visitor returns to after signing in.
  returnPath: string;
  signedIn: boolean;
};

export function RepostCaptionReportConnected({
  reposterId,
  postId,
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
        const result = await reportRepostCaption({
          reposterId,
          postId,
          reason,
          details,
        });
        if (result.ok) setSent(true);
        else setError(result.error);
      } catch {
        setError("Could not send the report. Please try again.");
      }
    });
  }

  return (
    <>
      <CaptionReportButton onClick={handleOpen} />
      <ReportDialog
        open={open}
        title="Report this caption"
        description="Tell us what is wrong with this note. The person who wrote it will not see who reported it."
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