import type { Radical } from "@/lib/radicals";

import {
  PRACTICE_OPTION_COUNT,
  PRACTICE_SESSION_SIZE,
} from "./constants";

export type PracticeMode = "glyph-to-gloss" | "gloss-to-glyph";

export type PracticeOption = {
  id: string;
  label: string;
  /** Set when the option is a Chinese glyph. */
  lang?: "zh-Hans";
};

export type PracticeItem = {
  /** Stable within a session: `${radicalId}:${mode}:${index}` */
  id: string;
  radicalId: string;
  mode: PracticeMode;
  /** Shown while the question is open (glyph or English gloss). */
  prompt: string;
  promptLang?: "zh-Hans";
  correctOptionId: string;
  options: PracticeOption[];
};

export type AnswerResult = {
  correct: boolean;
  selectedOptionId: string;
  correctOptionId: string;
};

export type SessionSummary = {
  correct: number;
  total: number;
  /** 0–1 ratio; 0 when total is 0. */
  accuracy: number;
};

/** Deterministic RNG for tests; defaults to Math.random in the browser. */
export type RandomFn = () => number;

function defaultRandom(): number {
  return Math.random();
}

/** Fisher–Yates shuffle using the provided RNG. */
export function shuffleInPlace<T>(items: T[], random: RandomFn = defaultRandom): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

export function pickRandom<T>(items: readonly T[], random: RandomFn = defaultRandom): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }
  return items[Math.floor(random() * items.length)]!;
}

/**
 * Build up to `PRACTICE_OPTION_COUNT` choices: one correct + distractors
 * from other radicals. Labels depend on mode.
 */
export function buildOptions(
  target: Radical,
  pool: readonly Radical[],
  mode: PracticeMode,
  random: RandomFn = defaultRandom,
): { options: PracticeOption[]; correctOptionId: string } {
  const distractors = pool.filter((r) => r.id !== target.id);
  const shuffled = shuffleInPlace([...distractors], random);
  const chosen = shuffled.slice(0, PRACTICE_OPTION_COUNT - 1);

  const toOption = (radical: Radical): PracticeOption => {
    if (mode === "glyph-to-gloss") {
      return { id: radical.id, label: radical.gloss };
    }
    return {
      id: radical.id,
      label: radical.forms[0]!,
      lang: "zh-Hans",
    };
  };

  const correct = toOption(target);
  const options = shuffleInPlace([correct, ...chosen.map(toOption)], random);

  return { options, correctOptionId: correct.id };
}

export type BuildSessionOptions = {
  /** Soft cap; defaults to PRACTICE_SESSION_SIZE. Clamped to pool size. */
  size?: number;
  random?: RandomFn;
};

/**
 * Build a recognition session from the seed pool.
 * Alternates glyph→gloss and gloss→glyph when length ≥ 2.
 * Session length is capped by PRACTICE_SESSION_SIZE (soft MVP cap).
 */
export function buildPracticeSession(
  radicals: readonly Radical[],
  options: BuildSessionOptions = {},
): PracticeItem[] {
  const random = options.random ?? defaultRandom;
  const requested = options.size ?? PRACTICE_SESSION_SIZE;
  const size = Math.min(Math.max(1, requested), PRACTICE_SESSION_SIZE, radicals.length);

  if (radicals.length < PRACTICE_OPTION_COUNT) {
    throw new Error(
      `Need at least ${PRACTICE_OPTION_COUNT} radicals to build multiple-choice practice`,
    );
  }

  const selected = shuffleInPlace([...radicals], random).slice(0, size);

  return selected.map((radical, index) => {
    const mode: PracticeMode =
      index % 2 === 0 ? "glyph-to-gloss" : "gloss-to-glyph";
    const { options: choices, correctOptionId } = buildOptions(
      radical,
      radicals,
      mode,
      random,
    );

    if (mode === "glyph-to-gloss") {
      return {
        id: `${radical.id}:${mode}:${index}`,
        radicalId: radical.id,
        mode,
        prompt: radical.forms[0]!,
        promptLang: "zh-Hans",
        correctOptionId,
        options: choices,
      };
    }

    return {
      id: `${radical.id}:${mode}:${index}`,
      radicalId: radical.id,
      mode,
      prompt: radical.gloss,
      correctOptionId,
      options: choices,
    };
  });
}

/** Score a single multiple-choice answer against the item. */
export function scoreAnswer(
  item: PracticeItem,
  selectedOptionId: string,
): AnswerResult {
  return {
    correct: selectedOptionId === item.correctOptionId,
    selectedOptionId,
    correctOptionId: item.correctOptionId,
  };
}

/** Aggregate correct/total/accuracy for a finished session. */
export function summarizeSession(
  results: ReadonlyArray<{ correct: boolean }>,
): SessionSummary {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  return {
    correct,
    total,
    accuracy: total === 0 ? 0 : correct / total,
  };
}
