// services/surveyService.ts — POST /api/surveys/pre | /post. Escala 1-5 (R-02).
import { apiFetch } from "./apiClient";

export interface SurveyCreatePre {
  session_id: string;
  pain_level: number;      // 1 nada – 5 mucho
  fatigue_level: number;   // 1-5
  stress_level?: number;   // 1-5
  comments?: string;
}

export interface SurveyCreatePost {
  session_id: string;
  mood_level: number;      // 1 muy mal – 5 muy bien
  pain_level?: number;
  comments?: string;
}

export interface SurveyResponse {
  id: string;
  session_id: string;
  type: "PRE_SESSION" | "POST_SESSION";
  pain_level: number | null;
  fatigue_level: number | null;
  stress_level: number | null;
  mood_level: number | null;
  comments: string | null;
}

export const submitPreSurvey = (data: SurveyCreatePre) =>
  apiFetch<SurveyResponse>("/api/surveys/pre", { method: "POST", body: data });

export const submitPostSurvey = (data: SurveyCreatePost) =>
  apiFetch<SurveyResponse>("/api/surveys/post", { method: "POST", body: data });
