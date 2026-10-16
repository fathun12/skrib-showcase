// One margin panel at a time: a panel announces when it opens, and every
// other panel closes itself when it hears an announcement that is not its own.

const EVENT = "skrib:margin-panel-open";

export function announceMarginPanelOpen(id: string): void {
  document.dispatchEvent(new CustomEvent<string>(EVENT, { detail: id }));
}

// Returns the function that removes the listener.
export function onOtherMarginPanelOpen(
  ownId: string,
  onOther: () => void,
): () => void {
  function handle(event: Event) {
    if (event instanceof CustomEvent && event.detail !== ownId) onOther();
  }
  document.addEventListener(EVENT, handle);
  return () => document.removeEventListener(EVENT, handle);
}