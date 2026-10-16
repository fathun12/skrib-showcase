import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/primitives/Avatar";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import {
  fieldBoxClass,
  fieldClass,
  labelClass,
} from "@/ui/primitives/field";

export type CreditItem = {
  id: string;
  // Ready-made text: the fixed label, or the short custom text.
  roleText: string;
  status: "pending" | "accepted";
  // A person with an account has username and displayName; a person without
  // one has only `name`.
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  name: string | null;
};

export type CreditRoleOption = { value: string; label: string };

export type CreditsMode = "user" | "name";

type Props = {
  open: boolean;
  // null = not loaded yet (or the load failed, see loadError).
  credits: CreditItem[] | null;
  loading?: boolean;
  loadError?: string | null;
  // Limits live in features/, so they come in as props.
  maxCredits: number;
  roleOptions: CreditRoleOption[];
  roleOtherMax: number;
  nameMax: number;
  mode: CreditsMode;
  username: string;
  name: string;
  link: string;
  role: string;
  roleOther: string;
  adding?: boolean;
  removingId?: string | null;
  // Error of the last add or remove.
  error?: string | null;
  onModeChange: (mode: CreditsMode) => void;
  onUsernameChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onLinkChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onRoleOtherChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

// The bare input inside a `fieldBoxClass` wrapper.
const innerClass =
  "min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-muted-foreground/70 disabled:opacity-60";

function segmentClass(active: boolean) {
  return cn(
    "rounded-full px-3.5 py-1.5 text-sm transition-colors disabled:opacity-60",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  );
}

export function CreditsDialog({
  open,
  credits,
  loading = false,
  loadError,
  maxCredits,
  roleOptions,
  roleOtherMax,
  nameMax,
  mode,
  username,
  name,
  link,
  role,
  roleOther,
  adding = false,
  removingId = null,
  error,
  onModeChange,
  onUsernameChange,
  onNameChange,
  onLinkChange,
  onRoleChange,
  onRoleOtherChange,
  onAdd,
  onRemove,
  onClose,
}: Props) {
  const count = credits?.length ?? 0;
  const full = count >= maxCredits;
  const busy = adding || removingId !== null;

  const targetFilled =
    mode === "user" ? username.trim() !== "" : name.trim() !== "";
  const roleReady = role !== "" && (role !== "other" || roleOther.trim() !== "");
  const canAdd = !busy && !full && targetFilled && roleReady;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-action.
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Credits</DialogTitle>
            <DialogDescription>
              Thank the people who helped with this post but did not write it
              (editing, research, photos, translation). Up to {maxCredits}{" "}
              people. Someone with an account appears only after accepting;
              someone without an account appears right away, by name.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}

            {loadError && (
              <p role="alert" className="text-sm text-destructive">
                {loadError}
              </p>
            )}

            {credits && credits.length === 0 && (
              <p className="rounded-xl bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground">
                No one credited yet.
              </p>
            )}

            {credits && credits.length > 0 && (
              <ul className="grid max-h-60 gap-2 overflow-y-auto">
                {credits.map((person) => {
                  const pending = person.status === "pending";
                  const label = pending ? "Cancel" : "Remove";
                  const shownName =
                    person.displayName ?? person.name ?? "Someone";
                  return (
                    <li
                      key={person.id}
                      className="flex items-center gap-3 rounded-xl border border-border/70 px-3.5 py-3"
                    >
                      <Avatar
                        name={shownName}
                        src={person.avatarUrl}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {shownName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {person.roleText}
                          {person.username ? ` · @${person.username}` : ""}
                        </p>
                      </div>
                      {pending && (
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                          Pending
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        disabled={busy}
                        aria-label={`${label} ${shownName}`}
                        onClick={() => onRemove(person.id)}
                      >
                        {removingId === person.id ? "..." : label}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <form
            className="grid gap-3.5 border-t border-border/70 pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (canAdd) onAdd();
            }}
          >
            <p className={labelClass}>
              Add someone{" "}
              <span className="font-normal text-muted-foreground">
                ({count} of {maxCredits} used)
              </span>
            </p>

            <div
              role="group"
              aria-label="Who to credit"
              className="flex w-fit gap-1 rounded-full bg-muted p-1"
            >
              <button
                type="button"
                aria-pressed={mode === "user"}
                disabled={busy}
                onClick={() => onModeChange("user")}
                className={segmentClass(mode === "user")}
              >
                Has an account
              </button>
              <button
                type="button"
                aria-pressed={mode === "name"}
                disabled={busy}
                onClick={() => onModeChange("name")}
                className={segmentClass(mode === "name")}
              >
                No account
              </button>
            </div>

            {mode === "user" ? (
              <div>
                <label htmlFor="credit-username" className="sr-only">
                  Username
                </label>
                <div className={fieldBoxClass}>
                  <span className="shrink-0 text-muted-foreground">@</span>
                  <input
                    id="credit-username"
                    type="text"
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    disabled={busy || full}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={31}
                    placeholder={full ? "Limit reached" : "username"}
                    className={innerClass}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <label htmlFor="credit-name" className="sr-only">
                  Name
                </label>
                <div className={fieldBoxClass}>
                  <input
                    id="credit-name"
                    type="text"
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    disabled={busy || full}
                    autoComplete="off"
                    maxLength={nameMax}
                    placeholder={full ? "Limit reached" : "Full name"}
                    className={innerClass}
                  />
                </div>
                <label htmlFor="credit-link" className="sr-only">
                  Link (optional)
                </label>
                <div className={fieldBoxClass}>
                  <input
                    id="credit-link"
                    type="url"
                    value={link}
                    onChange={(event) => onLinkChange(event.target.value)}
                    disabled={busy || full}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={300}
                    placeholder="Link (optional), https://..."
                    className={innerClass}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="credit-role" className={labelClass}>
                Role
              </label>
              <select
                id="credit-role"
                value={role}
                onChange={(event) => onRoleChange(event.target.value)}
                disabled={busy || full}
                className={fieldClass}
              >
                <option value="" disabled>
                  Choose a role
                </option>
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {role === "other" && (
                <>
                  <label htmlFor="credit-role-other" className="sr-only">
                    Role (short text)
                  </label>
                  <div className={fieldBoxClass}>
                    <input
                      id="credit-role-other"
                      type="text"
                      value={roleOther}
                      onChange={(event) => onRoleOtherChange(event.target.value)}
                      disabled={busy || full}
                      autoComplete="off"
                      maxLength={roleOtherMax}
                      placeholder="For example: Fact-checking"
                      className={innerClass}
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <Button
                type="submit"
                className="h-9 rounded-full px-5"
                disabled={!canAdd}
              >
                {adding ? "Adding..." : "Add credit"}
              </Button>
            </div>
          </form>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" disabled={busy} onClick={onClose}>
              Done
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}