import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import { fieldClass, labelClass } from "@/ui/primitives/field";

export type SubscribeDialogProps = {
  open: boolean;
  authorName: string;
  // Set for a signed-in reader: this address is used and the field is hidden.
  signedInEmail: string | null;
  email: string;
  // Honeypot value (real people never see this field).
  website: string;
  pending?: boolean;
  result: "subscribed" | "check_inbox" | null;
  error?: string | null;
  onEmailChange: (value: string) => void;
  onWebsiteChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function SubscribeDialog({
  open,
  authorName,
  signedInEmail,
  email,
  website,
  pending = false,
  result,
  error,
  onEmailChange,
  onWebsiteChange,
  onSubmit,
  onClose,
}: SubscribeDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        {result ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {result === "subscribed" ? "You are subscribed" : "Check your inbox"}
              </DialogTitle>
              <DialogDescription>
                {result === "subscribed"
                  ? `You will get new stories from ${authorName} by email.`
                  : "If the address is valid, we sent a message with a button to confirm your subscription."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending) onSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle>Get new stories by email</DialogTitle>
              <DialogDescription>
                {signedInEmail
                  ? `New stories from ${authorName} will go to ${signedInEmail}.`
                  : `Enter your email to follow ${authorName} by email.`}
              </DialogDescription>
            </DialogHeader>

            {signedInEmail ? null : (
              <div className="grid gap-1.5">
                <label htmlFor="newsletter-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  disabled={pending}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="you@example.com"
                  className={fieldClass}
                />
              </div>
            )}

            {/* Honeypot: hidden from people, tempting for bots. */}
            <div
              aria-hidden="true"
              className="absolute -left-2499.75 h-0 w-0 overflow-hidden"
            >
              <label>
                Website
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => onWebsiteChange(event.target.value)}
                />
              </label>
            </div>

            <p className="text-sm text-muted-foreground">
              One email per new story. Unsubscribe anytime.
            </p>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Subscribing..." : "Subscribe"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}