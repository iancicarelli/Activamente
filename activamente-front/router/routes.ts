// router/routes.ts — rutas de expo-router (BT-15). Grupos por rol con Tabs:
//   /patient/(tabs)/…   /specialist/(tabs)/…   /admin/(tabs)/…
// Las pantallas de flujo (sin tabs) cuelgan del Stack raíz bajo /patient, /specialist, /admin.

import type { UserRole } from "../services/authStore";

export const routes = {
  login: "/",
  terms: "/terms",

  // Paciente
  patientHome: "/patient/(tabs)/home",
  patientHistory: "/patient/(tabs)/history",
  patientProfile: "/patient/(tabs)/profile",
  surveyPre: "/patient/survey-pre",
  instruction: "/patient/instruction",
  activeExercise: "/patient/active-exercise",
  surveyPost: "/patient/survey-post",
  sessionCompleted: "/patient/session-completed",

  // Especialista
  specialistHome: "/specialist/(tabs)/home",
  specialistCalendar: "/specialist/(tabs)/calendar",
  patientList: "/specialist/(tabs)/patients",
  specialistProfile: "/specialist/(tabs)/profile",
  assignPatient: "/specialist/assign-patient",
  medicalRecord: "/specialist/medical-record",
  routineList: "/specialist/routines",
  createRoutine: "/specialist/create-routine",
  scheduleAppointment: "/specialist/schedule-appointment",

  // Admin
  adminHome: "/admin/(tabs)/home",
  adminUsers: "/admin/(tabs)/users",
  adminProfile: "/admin/(tabs)/profile",
  createUser: "/admin/create-user",
} as const;

export type RoutePath = (typeof routes)[keyof typeof routes];

export const HOME_BY_ROLE: Record<UserRole, RoutePath> = {
  ADMIN: routes.adminHome,
  SPECIALIST: routes.specialistHome,
  PATIENT: routes.patientHome,
};

// Primer segmento de URL que "pertenece" a cada rol (para el guard del root layout).
export const SEGMENT_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "admin",
  SPECIALIST: "specialist",
  PATIENT: "patient",
};
