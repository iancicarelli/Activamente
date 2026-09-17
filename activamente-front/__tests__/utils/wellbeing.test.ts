import { metricTone, metricWord, painChange, sessionHasRedMetric } from "../../utils/wellbeing";

const survey = (over: object) => ({ pain_level: null, fatigue_level: null, stress_level: null, mood_level: null, comments: null, ...over });

describe("wellbeing", () => {
  test("semáforo: dolor/cansancio/estrés altos son rojo; ánimo bajo es rojo", () => {
    expect(metricTone("pain", 2)).toBe("good");
    expect(metricTone("pain", 3)).toBe("warn");
    expect(metricTone("stress", 4)).toBe("bad");
    expect(metricTone("mood", 2)).toBe("bad");
    expect(metricTone("mood", 3)).toBe("warn");
    expect(metricTone("mood", 5)).toBe("good");
    expect(metricTone("pain", null)).toBeNull();
    expect(metricTone("pain", 9)).toBeNull();
  });

  test("palabras", () => {
    expect(metricWord("fatigue", 4)).toBe("Bastante");
    expect(metricWord("mood", 1)).toBe("Muy mal");
    expect(metricWord("mood", undefined)).toBe("—");
  });

  test("cambio de dolor antes → después", () => {
    expect(painChange(survey({ pain_level: 4 }), survey({ pain_level: 2 }))).toBe("better");
    expect(painChange(survey({ pain_level: 2 }), survey({ pain_level: 2 }))).toBe("same");
    expect(painChange(survey({ pain_level: 1 }), survey({ pain_level: 3 }))).toBe("worse");
    expect(painChange(survey({ pain_level: 1 }), null)).toBeNull();
  });

  test("sessionHasRedMetric", () => {
    expect(sessionHasRedMetric({ preSurvey: survey({ pain_level: 2, fatigue_level: 2 }), postSurvey: survey({ mood_level: 4 }) })).toBe(false);
    expect(sessionHasRedMetric({ preSurvey: null, postSurvey: survey({ mood_level: 1 }) })).toBe(true);
    expect(sessionHasRedMetric({ preSurvey: survey({ stress_level: 5 }), postSurvey: null })).toBe(true);
  });
});
