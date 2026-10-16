// Only allow in-app relative paths like "/me", never "//evil.com" or "https://...".
export function safeNext(value: unknown): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  ) {
    return value;
  }
  return "/";
}