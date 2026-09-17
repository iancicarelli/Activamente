/**
 * Calidad por repetición (EX-35): por cada rep guarda si la mayoría de los
 * frames fueron `ok` y cuál fue el feedback de forma más frecuente. Al final,
 * `summary()` da el accuracy_score (% de reps buenas) y el feedback más común
 * para el PUT de progreso (EP-15).
 */

import { ValidatorResult } from "./types";

export type RepQuality = { ok: boolean; worstFeedback: string | null };

const GOOD_RATIO = 0.7;

export class RepQualityTracker {
  private okFrames = 0;
  private badFrames = 0;
  private badFeedback: Record<string, number> = {};
  private reps: RepQuality[] = [];

  frame(result: ValidatorResult): void {
    if (result.repCompleted) {
      this.closeRep();
      return;
    }
    if (result.ok) this.okFrames += 1;
    else {
      this.badFrames += 1;
      if (result.feedback) this.badFeedback[result.feedback] = (this.badFeedback[result.feedback] ?? 0) + 1;
    }
  }

  private mostFrequent(): string | null {
    let best: string | null = null;
    let bestCount = 0;
    for (const [k, v] of Object.entries(this.badFeedback)) {
      if (v > bestCount) {
        best = k;
        bestCount = v;
      }
    }
    return best;
  }

  private closeRep(): void {
    const total = this.okFrames + this.badFrames;
    const ok = total === 0 ? true : this.okFrames / total >= GOOD_RATIO;
    this.reps.push({ ok, worstFeedback: ok ? null : this.mostFrequent() });
    this.okFrames = 0;
    this.badFrames = 0;
    this.badFeedback = {};
  }

  get repCount(): number {
    return this.reps.length;
  }

  summary(): { accuracy: number | null; feedback: string | null } {
    if (this.reps.length === 0) return { accuracy: null, feedback: null };
    const good = this.reps.filter((r) => r.ok).length;
    const counts: Record<string, number> = {};
    for (const r of this.reps) if (r.worstFeedback) counts[r.worstFeedback] = (counts[r.worstFeedback] ?? 0) + 1;
    let feedback: string | null = null;
    let max = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > max) {
        feedback = k;
        max = v;
      }
    }
    return { accuracy: Math.round((good / this.reps.length) * 100), feedback };
  }

  reset(): void {
    this.okFrames = 0;
    this.badFrames = 0;
    this.badFeedback = {};
    this.reps = [];
  }
}
