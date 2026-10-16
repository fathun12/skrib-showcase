"use client";

import { createPortal } from "react-dom";
import {
  ListenBarView,
  ListenButtonView,
} from "@/ui/post/ListenControlsView";
import { useListen } from "./useListen";

type Props = { lang: string };

// The Listen button in the info row. The control bar goes to document.body so
// that nothing inside the article can break its fixed position.
export function ListenConnected({ lang }: Props) {
  const listen = useListen(lang);
  // No voice for this language (or no speech support): nothing is shown.
  if (!listen.available) return null;

  const active = listen.status !== "idle";
  return (
    <>
      <ListenButtonView
        active={active}
        onClick={active ? listen.stop : listen.toggle}
      />
      {active
        ? createPortal(
            <ListenBarView
              playing={listen.status === "playing"}
              index={listen.index}
              total={listen.total}
              rate={listen.rate}
              onToggle={listen.toggle}
              onPrev={listen.prev}
              onNext={listen.next}
              onRate={listen.cycleRate}
              onClose={listen.stop}
            />,
            document.body,
          )
        : null}
    </>
  );
}