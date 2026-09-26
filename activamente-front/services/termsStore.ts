// services/termsStore.ts — "este usuario todavía no acepta los términos vigentes" (Ley 21.719).
// Lo marcan el login, la restauración de sesión y apiClient (403 con X-Terms-Required); el root
// layout lo escucha y manda a /terms. Sin dependencias, para que apiClient pueda importarlo sin
// ciclos.

let pending = false;
const listeners = new Set<(pending: boolean) => void>();

export const isTermsPending = () => pending;

export function setTermsPending(next: boolean) {
  if (pending === next) return;
  pending = next;
  listeners.forEach((cb) => cb(pending));
}

export function subscribeTerms(cb: (pending: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
