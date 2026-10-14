let fallbackSequence = 0;

/**
 * Generate a UI-only key without requiring crypto.randomUUID(), which is
 * missing in older Safari versions and some Android in-app browsers.
 */
export function clientKey() {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  fallbackSequence += 1;
  return `ui-${Date.now().toString(36)}-${fallbackSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
