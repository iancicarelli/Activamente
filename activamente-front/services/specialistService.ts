// services/specialistService.ts
//
// Cliente de los endpoints del especialista:
//   GET /api/specialists/dashboard   (métricas de la pantalla de inicio)
//
// Sigue el patrón de los demás servicios: usa apiFetch (auth: true por
// defecto), que adjunta el Bearer token desde authStore. El backend toma el
// specialist_id del token, por eso no se envía nada en la query.

import { apiFetch } from "./apiClient";

export interface DashboardSpecialist {
  full_name: string;
  specialty: string | null;
}

export interface DashboardStats {
  total_patients: number;
  active_today: number;
  alerts: number;
  avg_adherence: number;
}

export interface DashboardProgress {
  sessions_completed_today: number;
  sessions_total_today: number;
  daily_compliance: number;
}

// Forma exacta de GET /api/specialists/dashboard (SpecialistDashboardResponse).
export interface DashboardResponse {
  specialist: DashboardSpecialist;
  stats: DashboardStats;
  progress: DashboardProgress;
}

// GET /api/specialists/dashboard → métricas del especialista logueado.
export const getDashboard = (): Promise<DashboardResponse> =>
  apiFetch<DashboardResponse>("/api/specialists/dashboard", {
    method: "GET",
    auth: true,
  });
