"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { buttonVariants } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import { DeleteSeriesDialog } from "./DeleteSeriesDialog";

type Props = {
  seriesId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  viewHref: string;
  // The details form (a connected component from features/).
  editForm: ReactNode;
  onDelete: (input: { id: string }) => Promise<{ ok: false; error: string }>;
};

function firstLetter(title: string) {
  return Array.from(title.trim())[0]?.toUpperCase() ?? "S";
}

export function SeriesHeader({
  seriesId,
  title,
  description,
  coverUrl,
  viewHref,
  editForm,
  onDelete,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <header className="flex flex-col gap-5 sm:flex-row">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-accent sm:w-56">
        {coverUrl ? (
          <Image
            src={cloudinaryImageUrl(coverUrl, {
              width: 640,
              height: 360,
              crop: "fill",
            })}
            alt=""
            fill
            sizes="(min-width: 640px) 224px, 100vw"
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-full items-center justify-center font-serif text-5xl font-bold text-muted-foreground"
          >
            {firstLetter(title)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-muted-foreground">{description}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Edit details
          </button>
          <Link
            href={viewHref}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            View series
          </Link>
          <Menu.Root>
            <Menu.Trigger
              aria-label="More actions"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={6} className="z-50">
                <Menu.Popup className="min-w-40 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none">
                  <Menu.Item
                    onClick={() => setDeleteOpen(true)}
                    className="flex cursor-default items-center rounded-md px-3 py-2 text-destructive outline-none select-none data-highlighted:bg-destructive/10"
                  >
                    Delete series
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit details</DialogTitle>
            <DialogDescription>
              The title, description and cover of this series.
            </DialogDescription>
          </DialogHeader>
          {editForm}
        </DialogContent>
      </Dialog>

      <DeleteSeriesDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        seriesId={seriesId}
        title={title}
        onDelete={onDelete}
      />
    </header>
  );
}