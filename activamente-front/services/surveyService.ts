import { apiFetch } from "./apiClient";

export interface SurveyCreatePre {
    session_id: string;
    pain_level: number;
    fatigue_level: number;
    comments?: string;
}

export interface SurveyCreatePost {
    session_id: string;
    mood_level: number;
    comments?: string;
}

export const submitPreSurvey = (data: SurveyCreatePre) =>
    apiFetch("/surveys/pre", {
        method: "POST",
        auth: true,
        body: data,
    });

export const submitPostSurvey = (data: SurveyCreatePost) =>
    apiFetch("/surveys/post", {
        method: "POST",
        auth: true,
        body: data,
    });
