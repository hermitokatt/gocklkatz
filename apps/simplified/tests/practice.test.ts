import { describe, expect, it } from "vitest";

import { RADICALS } from "@/lib/radicals";
import {
  PRACTICE_OPTION_COUNT,
  PRACTICE_SESSION_SIZE,
  PRACTICE_STORAGE_KEY,
  buildOptions,
  buildPracticeSession,
  emptyPracticeProgress,
  parsePracticeProgress,
  recordSession,
  scoreAnswer,
  serializePracticeProgress,
  summarizeSession,
} from "@/lib/practice";

/** Deterministic sequence for shuffle / pick. */
function sequenceRandom(values: number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i % values.length] ?? 0;
    i += 1;
    return value;
  };
}

describe("practice constants", () => {
  it("keeps the soft session cap in the documented 8–12 range", () => {
    expect(PRACTICE_SESSION_SIZE).toBeGreaterThanOrEqual(8);
    expect(PRACTICE_SESSION_SIZE).toBeLessThanOrEqual(12);
  });

  it("uses a namespaced localStorage key", () => {
    expect(PRACTICE_STORAGE_KEY).toBe("simplified:radicals-practice");
  });
});

describe("buildOptions / buildPracticeSession", () => {
  it("builds four options including the correct radical", () => {
    const target = RADICALS[0]!;
    const { options, correctOptionId } = buildOptions(
      target,
      RADICALS,
      "glyph-to-gloss",
      sequenceRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
    );

    expect(options).toHaveLength(PRACTICE_OPTION_COUNT);
    expect(correctOptionId).toBe(target.id);
    expect(options.map((o) => o.id)).toContain(target.id);
    expect(new Set(options.map((o) => o.id)).size).toBe(PRACTICE_OPTION_COUNT);
  });

  it("caps session length and alternates modes", () => {
    const session = buildPracticeSession(RADICALS, {
      size: 100,
      random: sequenceRandom(Array.from({ length: 200 }, (_, i) => (i % 10) / 10)),
    });

    expect(session.length).toBe(PRACTICE_SESSION_SIZE);
    expect(session[0]?.mode).toBe("glyph-to-gloss");
    expect(session[1]?.mode).toBe("gloss-to-glyph");
    expect(session.every((item) => item.options.length === PRACTICE_OPTION_COUNT)).toBe(
      true,
    );
  });

  it("uses primary glyph for glyph prompts and gloss prompts for the reverse mode", () => {
    const session = buildPracticeSession(RADICALS, {
      size: 2,
      random: sequenceRandom([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
    });

    const glyphItem = session.find((i) => i.mode === "glyph-to-gloss");
    const glossItem = session.find((i) => i.mode === "gloss-to-glyph");

    expect(glyphItem?.promptLang).toBe("zh-Hans");
    expect(glossItem?.promptLang).toBeUndefined();
    expect(glossItem?.options.every((o) => o.lang === "zh-Hans")).toBe(true);
  });
});

describe("scoreAnswer / summarizeSession", () => {
  it("marks matching option ids as correct", () => {
    const [item] = buildPracticeSession(RADICALS, {
      size: 1,
      random: sequenceRandom([0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5, 0.7]),
    });
    expect(item).toBeDefined();

    const hit = scoreAnswer(item!, item!.correctOptionId);
    expect(hit.correct).toBe(true);

    const missId = item!.options.find((o) => o.id !== item!.correctOptionId)?.id;
    expect(missId).toBeDefined();
    expect(scoreAnswer(item!, missId!).correct).toBe(false);
  });

  it("summarizes accuracy for a session", () => {
    expect(summarizeSession([{ correct: true }, { correct: false }, { correct: true }])).toEqual({
      correct: 2,
      total: 3,
      accuracy: 2 / 3,
    });
    expect(summarizeSession([])).toEqual({ correct: 0, total: 0, accuracy: 0 });
  });
});

describe("practice progress storage helpers", () => {
  it("emptyPracticeProgress allocates a new object each call", () => {
    // Guardrail: never pass emptyPracticeProgress / loadPracticeProgress
    // directly to useSyncExternalStore getSnapshot — fresh refs infinite-loop
    // React and leave Start practice non-interactive.
    const a = emptyPracticeProgress();
    const b = emptyPracticeProgress();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("round-trips progress JSON and merges sessions", () => {
    const base = emptyPracticeProgress();
    const next = recordSession(base, {
      completedAt: "2026-09-08T12:00:00.000Z",
      answers: [
        {
          radicalId: "water",
          mode: "glyph-to-gloss",
          correct: true,
        },
        {
          radicalId: "person",
          mode: "gloss-to-glyph",
          correct: false,
        },
      ],
    });

    expect(next.sessionsCompleted).toBe(1);
    expect(next.totalAnswered).toBe(2);
    expect(next.totalCorrect).toBe(1);
    expect(next.recent).toHaveLength(2);

    const parsed = parsePracticeProgress(serializePracticeProgress(next));
    expect(parsed).toEqual(next);
  });

  it("returns empty progress for invalid stored JSON", () => {
    expect(parsePracticeProgress(null)).toEqual(emptyPracticeProgress());
    expect(parsePracticeProgress("{")).toEqual(emptyPracticeProgress());
    expect(parsePracticeProgress('{"version":2}')).toEqual(emptyPracticeProgress());
  });
});
