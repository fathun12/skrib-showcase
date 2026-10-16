import { ProfileLink } from "@/ui/profile/ProfileLink";

export type EditedByPerson = {
  displayName: string;
  username: string;
};

type Props = {
  // Accepted editors whose credit the author chose to show. Nothing is drawn
  // when empty.
  editors: EditedByPerson[];
};

// "Edited by X" or "Edited by X and Y", at the end of a story.
export function EditedBy({ editors }: Props) {
  if (editors.length === 0) return null;

  return (
    <p className="mt-6 text-sm text-muted-foreground">
      Edited by{" "}
      {editors.map((editor, index) => (
        <span key={editor.username}>
          {index === 0 ? "" : index === editors.length - 1 ? " and " : ", "}
          <ProfileLink
            username={editor.username}
            className="font-medium text-foreground hover:underline"
          >
            {editor.displayName}
          </ProfileLink>
        </span>
      ))}
    </p>
  );
}