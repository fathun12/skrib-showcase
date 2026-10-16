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
import { fieldBoxClass, labelClass } from "@/ui/primitives/field";

type Role = "coauthor" | "editor";

export type CollaboratorItem = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: "pending" | "accepted";
  role: Role;
  showCredit: boolean;
  canPublish: boolean;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "coauthor", label: "Co-author" },
  { value: "editor", label: "Editor" },
];

type Props = {
  open: boolean;
  // null = not loaded yet (or the load failed, see loadError).
  collaborators: CollaboratorItem[] | null;
  loading?: boolean;
  loadError?: string | null;
  // The limits live in features/, so they come in as props.
  maxCollaborators: number;
  maxEditors: number;
  username: string;
  role: Role;
  showCredit: boolean;
  inviting?: boolean;
  removingUserId?: string | null;
  // Error of the last invite or remove.
  error?: string | null;
  onUsernameChange: (value: string) => void;
  onRoleChange: (role: Role) => void;
  onShowCreditChange: (value: boolean) => void;
  onInvite: () => void;
  onRemove: (userId: string) => void;
  // The "Edited by" switch on an editor row.
  creditSavingUserId?: string | null;
  onToggleCredit: (userId: string, value: boolean) => void;
  // The "May publish" switch on an editor row.
  publishSavingUserId?: string | null;
  onTogglePublish: (userId: string, value: boolean) => void;
  onClose: () => void;
};

export function CollaboratorsDialog({
  open,
  collaborators,
  loading = false,
  loadError,
  maxCollaborators,
  maxEditors,
  username,
  role,
  showCredit,
  inviting = false,
  removingUserId = null,
  creditSavingUserId = null,
  publishSavingUserId = null,
  error,
  onUsernameChange,
  onRoleChange,
  onShowCreditChange,
  onInvite,
  onRemove,
  onToggleCredit,
  onTogglePublish,
  onClose,
}: Props) {
  const count = collaborators?.length ?? 0;
  const editorCount =
    collaborators?.filter((person) => person.role === "editor").length ?? 0;
  const full = count >= maxCollaborators;
  const editorsFull = editorCount >= maxEditors;
  // Blocked = the chosen role cannot be invited any more.
  const blocked = full || (role === "editor" && editorsFull);
  const busy =
    inviting ||
    removingUserId !== null ||
    creditSavingUserId !== null ||
    publishSavingUserId !== null;

  let placeholder = "username";
  if (full) placeholder = "Limit reached";
  else if (blocked) placeholder = "Editor limit reached";

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
            <DialogTitle>Collaborators</DialogTitle>
            <DialogDescription>
              Invite up to {maxCollaborators} people to this post. A co-author
              writes with you and appears on the post after accepting. An
              editor (up to {maxEditors}) edits your draft and is not shown as
              an author. Only one person can edit at a time.
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

            {collaborators && collaborators.length === 0 && (
              <p className="rounded-xl bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground">
                No one invited yet.
              </p>
            )}

            {collaborators && collaborators.length > 0 && (
              <ul className="grid max-h-64 gap-2 overflow-y-auto">
                {collaborators.map((person) => {
                  const pending = person.status === "pending";
                  const label = pending ? "Cancel" : "Remove";
                  return (
                    <li
                      key={person.userId}
                      className="flex items-center gap-3 rounded-xl border border-border/70 px-3.5 py-3"
                    >
                      <Avatar
                        name={person.displayName}
                        src={person.avatarUrl}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {person.displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{person.username}
                        </p>
                        {person.role === "editor" ? (
                          <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={person.showCredit}
                              disabled={busy}
                              onChange={(event) =>
                                onToggleCredit(
                                  person.userId,
                                  event.target.checked,
                                )
                              }
                              className="size-3.5 shrink-0 accent-primary"
                            />
                            {creditSavingUserId === person.userId
                              ? "Saving..."
                              : "Show “Edited by”"}
                          </label>
                        ) : null}
                        {person.role === "editor" ? (
                          <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={person.canPublish}
                              disabled={busy}
                              onChange={(event) =>
                                onTogglePublish(
                                  person.userId,
                                  event.target.checked,
                                )
                              }
                              className="size-3.5 shrink-0 accent-primary"
                            />
                            {publishSavingUserId === person.userId
                              ? "Saving..."
                              : "May publish"}
                          </label>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={
                            pending
                              ? "rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                              : "rounded-full bg-accent px-2.5 py-0.5 text-xs text-primary"
                          }
                        >
                          {pending ? "Pending" : "Accepted"}
                        </span>
                        <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-xs text-muted-foreground">
                          {person.role === "editor" ? "Editor" : "Co-author"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        disabled={busy}
                        aria-label={`${label} ${person.displayName}`}
                        onClick={() => onRemove(person.userId)}
                      >
                        {removingUserId === person.userId ? "..." : label}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && !blocked && username.trim() !== "") onInvite();
            }}
          >
            <div
              role="radiogroup"
              aria-label="Role"
              className="grid grid-cols-2 rounded-full bg-muted p-1"
            >
              {ROLE_OPTIONS.map((option) => {
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busy}
                    onClick={() => onRoleChange(option.value)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                      selected
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {role === "editor" && (
              <div className="grid gap-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 px-3.5 py-3 has-checked:border-primary/60 has-checked:bg-accent">
                  <input
                    type="checkbox"
                    checked={showCredit}
                    onChange={(event) =>
                      onShowCreditChange(event.target.checked)
                    }
                    disabled={busy}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm">
                    Show “Edited by” at the end of the story
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  An editor can edit this draft while holding the pen. They
                  cannot delete the story or change it once it is published,
                  and they can publish it only if you allow that later. They
                  are not shown as an author. You stay the owner, and either
                  side can end this at any time.
                </p>
              </div>
            )}

            <div className="grid gap-1.5">
              <label htmlFor="collab-username" className={labelClass}>
                Invite by username{" "}
                <span className="font-normal text-muted-foreground">
                  ({count} of {maxCollaborators} used
                  {role === "editor"
                    ? `, ${editorCount} of ${maxEditors} editors`
                    : ""}
                  )
                </span>
              </label>
              <div className="flex items-center gap-2">
                <div className={fieldBoxClass}>
                  <span className="shrink-0 text-muted-foreground">@</span>
                  <input
                    id="collab-username"
                    type="text"
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    disabled={busy || blocked}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={31}
                    placeholder={placeholder}
                    className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-10 rounded-full px-5"
                  disabled={busy || blocked || username.trim() === ""}
                >
                  {inviting ? "Inviting..." : "Invite"}
                </Button>
              </div>
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