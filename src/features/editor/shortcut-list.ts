import type { ShortcutGroup } from "@/ui/editor/ShortcutsDialog";

// The shortcuts that really exist in the editor. Only add a line here after
// checking it in the code or in the official Tiptap docs.
// Sources: Ctrl+Alt+F, the dash rule and the capital rule are in
// editor-extensions.ts; the rest are Tiptap defaults (docs: keyboard
// shortcuts, Heading, Bold and Typography). Headings are levels 2 and 3 only
// (StarterKit config in extensions.ts), so there is no shortcut for level 1.
export function buildShortcutGroups(mac: boolean): ShortcutGroup[] {
  const mod = mac ? "⌘" : "Ctrl";
  const alt = mac ? "⌥" : "Alt";
  const shift = mac ? "⇧" : "Shift";

  return [
    {
      title: "Formatting",
      items: [
        { label: "Bold", keys: [mod, "B"] },
        { label: "Highlight", keys: [mod, shift, "H"] },
        { label: "Heading 2", keys: [mod, alt, "2"] },
        { label: "Heading 3", keys: [mod, alt, "3"] },
        { label: "Numbered list", keys: [mod, shift, "7"] },
        { label: "Bullet list", keys: [mod, shift, "8"] },
        { label: "Quote", keys: [mod, shift, "B"] },
      ],
    },
    {
      title: "Find and replace",
      items: [
        { label: "Open it (cursor in the text)", keys: [mod, "F"] },
        { label: "Next result (in the search box)", keys: ["Enter"] },
        { label: "Previous result (in the search box)", keys: [shift, "Enter"] },
        { label: "Close", keys: ["Esc"] },
      ],
    },
    {
      title: "Notes",
      items: [{ label: "Add a footnote at the cursor", keys: [mod, alt, "F"] }],
    },
    {
      title: "Type it instead",
      items: [
        { label: "Heading 2 (then a space)", typed: "##" },
        { label: "Heading 3 (then a space)", typed: "###" },
        { label: "Bold", typed: "**text**" },
        { label: "Em dash", typed: "--" },
        { label: "Ellipsis", typed: "..." },
        { label: "En dash between two words", typed: "word - word" },
      ],
    },
    {
      title: "Automatic",
      items: [
        { label: "Capital letter after . ! ? and at the start of a paragraph" },
      ],
    },
  ];
}