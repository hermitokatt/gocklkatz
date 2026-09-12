import { PRACTICE_RECENT_LIMIT, PRACTICE_STORAGE_KEY } from "./constants";
import type { PracticeMode } from "./session";

export type PracticeRecentEntry = {
  radicalId: string;
  mode: PracticeMode;
  correct: boolean;
  at: string;
};

export type PracticeProgress = {
  version: 1;
  sessionsCompleted: number;
  lastCompletedAt: string | null;
  totalAnswered: number;
  totalCorrect: number;
  recent: PracticeRecentEntry[];
};

export const emptyPracticeProgress = (): PracticeProgress => ({
  version: 1,
  sessionsCompleted: 0,
  lastCompletedAt: null,
  totalAnswered: 0,
  totalCorrect: 0,
  recent: [],
});

export type SessionRecordInput = {
  completedAt: string;
  answers: ReadonlyArray<{
    radicalId: string;
    mode: PracticeMode;
    correct: boolean;
  }>;
};

/** Pure merge of a finished session into stored progress. */
export function recordSession(
  previous: PracticeProgress,
  input: SessionRecordInput,
): PracticeProgress {
  const answered = input.answers.length;
  const correct = input.answers.filter((a) => a.correct).length;
  const newRecent: PracticeRecentEntry[] = [
    ...input.answers.map((a) => ({
      radicalId: a.radicalId,
      mode: a.mode,
      correct: a.correct,
      at: input.completedAt,
    })),
    ...previous.recent,
  ].slice(0, PRACTICE_RECENT_LIMIT);

  return {
    version: 1,
    sessionsCompleted: previous.sessionsCompleted + 1,
    lastCompletedAt: input.completedAt,
    totalAnswered: previous.totalAnswered + answered,
    totalCorrect: previous.totalCorrect + correct,
    recent: newRecent,
  };
}

/** Parse stored JSON; returns empty progress on missing/invalid data. */
export function parsePracticeProgress(raw: string | null): PracticeProgress {
  if (!raw) {
    return emptyPracticeProgress();
  }

  try {
    const data = JSON.parse(raw) as Partial<PracticeProgress>;
    if (data.version !== 1 || typeof data.sessionsCompleted !== "number") {
      return emptyPracticeProgress();
    }

    return {
      version: 1,
      sessionsCompleted: Math.max(0, data.sessionsCompleted),
      lastCompletedAt: typeof data.lastCompletedAt === "string" ? data.lastCompletedAt : null,
      totalAnswered: typeof data.totalAnswered === "number" ? Math.max(0, data.totalAnswered) : 0,
      totalCorrect: typeof data.totalCorrect === "number" ? Math.max(0, data.totalCorrect) : 0,
      recent: Array.isArray(data.recent)
        ? data.recent
            .filter(
              (entry): entry is PracticeRecentEntry =>
                entry != null &&
                typeof entry === "object" &&
                typeof (entry as PracticeRecentEntry).radicalId === "string" &&
                typeof (entry as PracticeRecentEntry).correct === "boolean" &&
                typeof (entry as PracticeRecentEntry).at === "string" &&
                ((entry as PracticeRecentEntry).mode === "glyph-to-gloss" ||
                  (entry as PracticeRecentEntry).mode === "gloss-to-glyph"),
            )
            .slice(0, PRACTICE_RECENT_LIMIT)
        : [],
    };
  } catch {
    return emptyPracticeProgress();
  }
}

export function serializePracticeProgress(progress: PracticeProgress): string {
  return JSON.stringify(progress);
}

/** Browser-only load; safe to call after mount. */
export function loadPracticeProgress(): PracticeProgress {
  if (typeof window === "undefined") {
    return emptyPracticeProgress();
  }
  try {
    return parsePracticeProgress(window.localStorage.getItem(PRACTICE_STORAGE_KEY));
  } catch {
    return emptyPracticeProgress();
  }
}

/** Browser-only save. */
export function savePracticeProgress(progress: PracticeProgress): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PRACTICE_STORAGE_KEY, serializePracticeProgress(progress));
  } catch {
    // Quota / private mode — practice still works for the session.
  }
}

export { PRACTICE_STORAGE_KEY };
