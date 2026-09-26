// services/privacyService.ts — términos de uso, solicitudes de eliminación de cuenta (Ley 21.719).
import { apiFetch } from "./apiClient";
import { setTermsPending } from "./termsStore";

export interface TermsStatus {
  version: string;
  accepted: boolean;
  accepted_at: string | null;
  sections: { title: string; body: string }[];
}

export type DeletionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface DeletionRequest {
  id: string;
  status: DeletionStatus;
  requested_at: string;
  resolved_at: string | null;
}

export interface DeletionRequestAdminItem extends DeletionRequest {
  user_id: string;
  reason: string | null;
  full_name: string | null;
  email: string | null;
  rut: string | null;
}

export const getMyTerms = () => apiFetch<TermsStatus>("/api/me/terms");

/** Consulta si el usuario ya aceptó los términos vigentes y actualiza el termsStore. */
export async function refreshTermsStatus(): Promise<boolean> {
  const terms = await getMyTerms();
  setTermsPending(!terms.accepted);
  return terms.accepted;
}

export async function acceptTerms(version: string): Promise<void> {
  await apiFetch<void>("/api/me/terms", { method: "POST", body: { version } });
  setTermsPending(false);
}

export const getMyDeletionRequest = () => apiFetch<DeletionRequest | null>("/api/me/deletion-request");

export const requestAccountDeletion = (reason?: string) =>
  apiFetch<DeletionRequest>("/api/me/deletion-request", { method: "POST", body: { reason: reason || null } });

export const listDeletionRequests = (status?: DeletionStatus) =>
  apiFetch<DeletionRequestAdminItem[]>(`/api/admins/deletion-requests${status ? `?status=${status}` : ""}`);

export const approveDeletionRequest = (id: string) =>
  apiFetch<DeletionRequest>(`/api/admins/deletion-requests/${id}/approve`, { method: "POST" });

export const rejectDeletionRequest = (id: string) =>
  apiFetch<DeletionRequest>(`/api/admins/deletion-requests/${id}/reject`, { method: "POST" });
