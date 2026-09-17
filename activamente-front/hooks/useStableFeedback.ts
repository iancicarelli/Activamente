/**
 * hooks/useStableFeedback.ts — feedback que no parpadea (EX-33 / UX-12c):
 * un mensaje se mantiene al menos MIN_HOLD_MS antes de ser reemplazado, salvo
 * que llegue una rep completada o un cambio de "ok" (error de forma), que
 * entran de inmediato.
 */

import { useCallback, useRef, useState } from "react";

export const MIN_HOLD_MS = 1500;

export type Feedback = { text: string | null; ok: boolean };

export function useStableFeedback() {
  const [feedback, setFeedback] = useState<Feedback>({ text: null, ok: true });
  const shownAt = useRef(0);
  const current = useRef<Feedback>({ text: null, ok: true });

  const push = useCallback((next: Feedback, urgent = false) => {
    const now = Date.now();
    const prev = current.current;
    const sameText = prev.text === next.text && prev.ok === next.ok;
    if (sameText) return;
    const elapsed = now - shownAt.current;
    const priority = urgent || prev.ok !== next.ok;
    if (!priority && elapsed < MIN_HOLD_MS && prev.text) return;
    current.current = next;
    shownAt.current = now;
    setFeedback(next);
  }, []);

  const reset = useCallback(() => {
    current.current = { text: null, ok: true };
    shownAt.current = 0;
    setFeedback({ text: null, ok: true });
  }, []);

  return { feedback, push, reset };
}
