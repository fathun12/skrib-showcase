import type { Ref } from "react";
import { X } from "lucide-react";

export type LightboxViewProps = {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
  closeRef?: Ref<HTMLButtonElement>;
};

// Full-screen viewer for one article image. Props only: the open state, the
// keys and the focus live in features/lightbox. The dark backdrop is the same
// in light, dark and sepia on purpose (photo viewers are always dark).
export function LightboxView({
  src,
  alt,
  caption,
  onClose,
  closeRef,
}: LightboxViewProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || caption || "Image"}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Close image"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="size-5" aria-hidden />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
      {caption ? (
        <p className="mt-3 max-w-2xl text-center text-sm text-white/80">
          {caption}
        </p>
      ) : null}
    </div>
  );
}