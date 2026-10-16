"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/primitives/dialog";
import { createSeries } from "./actions";
import { SeriesFormConnected } from "./SeriesFormConnected";

// The "New series" button and its dialog. On success createSeries redirects
// to the page of the new series, so the dialog never has to close itself.
export function NewSeriesButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={buttonVariants({ className: "h-9 shrink-0 rounded-full px-4" })}
      >
        <Plus aria-hidden="true" />
        New series
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New series</DialogTitle>
          <DialogDescription>
            A series groups your stories in an order you choose. You add the
            stories on the next page.
          </DialogDescription>
        </DialogHeader>
        <SeriesFormConnected
          submitLabel="Create series"
          onSubmit={createSeries}
        />
      </DialogContent>
    </Dialog>
  );
}