"use client";

import { usePathname } from "next/navigation";
import { isEditorPath } from "@/ui/layout/mobile-nav-paths";

// Empty space at the very end of the page, as tall as the bottom bar, so the
// footer is not hidden under it. Same rule as the bar: none in the editor,
// none from sm up.
export function MobileNavSpacer() {
  const pathname = usePathname();
  if (isEditorPath(pathname)) return null;
  return <div aria-hidden="true" className="h-24 sm:hidden" />;
}