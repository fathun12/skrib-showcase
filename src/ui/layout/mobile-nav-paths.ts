// The editor pages have no bottom bar: the keyboard and the writing space
// matter more there, and "Write" is where the person already is.
export function isEditorPath(pathname: string): boolean {
  return pathname === "/write" || pathname.startsWith("/write/");
}