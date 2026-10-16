"use client";

import { useEffect } from "react";

// Phones cannot show all six tabs. After the page loads (and when the active
// tab changes), this puts the active tab in the middle of the scroll area.
// Renders nothing.
export function ScrollActiveTab({ activeId }: { activeId: string }) {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(
      'nav[aria-label="Home feed"]',
    );
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !tab) return;
    const navLeft = nav.getBoundingClientRect().left;
    const tabLeft = tab.getBoundingClientRect().left;
    nav.scrollLeft +=
      tabLeft - navLeft - (nav.clientWidth - tab.offsetWidth) / 2;
  }, [activeId]);

  return null;
}