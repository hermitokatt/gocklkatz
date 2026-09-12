"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Radical } from "@/lib/radicals";
import {
  PRACTICE_SESSION_SIZE,
  buildPracticeSession,
  emptyPracticeProgress,
  loadPracticeProgress,
  recordSession,
  savePracticeProgress,
  scoreAnswer,
  summarizeSession,
  type PracticeItem,
  type PracticeProgress,
} from "@/lib/practice";

type Phase = "ready" | "question" | "feedback" | "summary";

type AnswerRow = {
  item: PracticeItem;
  selectedOptionId: string;
  correct: boolean;
};

type PracticeQuizProps = {
  radicals: Radical[];
  /** Server-built session when landing on `?start=1` (SSR-safe start). */
  initialSession?: PracticeItem[] | null;
};

/**
 * Recognition quiz. Progress is plain useState + a mount read of localStorage.
 *
 * Do not wire progress through useSyncExternalStore here: an unstable
 * getSnapshot previously infinite-looped React and left the SSR "Start practice"
 * control non-interactive on some browsers (Chrome on macOS beta included).
 *
 * Starting a session is a navigation to `?start=1` so the first question is
 * rendered on the server even when client hydration fails.
 */
export function PracticeQuiz({
  radicals,
  initialSession = null,
}: PracticeQuizProps) {
  const hasInitialSession =
    Array.isArray(initialSession) && initialSession.length > 0;

  const [progress, setProgress] = useState<PracticeProgress>(() =>
    emptyPracticeProgress(),
  );
  const [phase, setPhase] = useState<Phase>(
    hasInitialSession ? "question" : "ready",
  );
  const [items, setItems] = useState<PracticeItem[]>(
    hasInitialSession ? initialSession! : [],
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [lastResult, setLastResult] = useState<AnswerRow | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    // localStorage is unavailable during SSR; sync once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount-only client read
    setProgress(loadPracticeProgress());
  }, []);

  useEffect(() => {
    if (phase !== "feedback") {
      return;
    }
    document.getElementById("practice-feedback")?.focus();
  }, [phase, feedbackKey]);

  const current = items[index];
  const radicalForCurrent =
    current != null
      ? radicals.find((r) => r.id === current.radicalId)
      : undefined;

  function restartInPlace() {
    setStartError(null);
    try {
      const session = buildPracticeSession(radicals);
      if (session.length === 0) {
        setStartError("Could not build a practice session. Try refreshing the page.");
        return;
      }
      setItems(session);
      setIndex(0);
      setAnswers([]);
      setLastResult(null);
      setPhase("question");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start practice.";
      setStartError(message);
    }
  }

  function onSelectOption(optionId: string) {
    if (!current || phase !== "question") {
      return;
    }

    const scored = scoreAnswer(current, optionId);
    const row: AnswerRow = {
      item: current,
      selectedOptionId: optionId,
      correct: scored.correct,
    };
    setLastResult(row);
    setAnswers((prev) => [...prev, row]);
    setFeedbackKey((k) => k + 1);
    setPhase("feedback");
  }

  function onContinue() {
    if (index + 1 >= items.length) {
      const summaryAnswers = [...answers];
      const completedAt = new Date().toISOString();
      const next = recordSession(progress, {
        completedAt,
        answers: summaryAnswers.map((row) => ({
          radicalId: row.item.radicalId,
          mode: row.item.mode,
          correct: row.correct,
        })),
      });
      savePracticeProgress(next);
      setProgress(next);
      setPhase("summary");
      return;
    }

    setLastResult(null);
    setIndex((i) => i + 1);
    setPhase("question");
  }

  const summary = summarizeSession(answers);

  return (
    <div className="practice">
      {phase === "ready" ? (
        <section className="practice-panel" aria-labelledby="practice-ready-title">
          <h1 id="practice-ready-title" className="practice__title">
            Recognition
          </h1>
          <p className="practice__lede">
            A short quiz — glyph to meaning, and meaning to glyph. Study aids stay
            hidden until you answer.
          </p>
          <p className="practice__meta">
            Up to {PRACTICE_SESSION_SIZE} items · progress stays in this browser
          </p>
          {progress.sessionsCompleted > 0 ? (
            <p className="practice__stats">
              {progress.sessionsCompleted} session
              {progress.sessionsCompleted === 1 ? "" : "s"} completed
              {progress.totalAnswered > 0
                ? ` · ${progress.totalCorrect}/${progress.totalAnswered} correct overall`
                : null}
            </p>
          ) : null}
          {startError ? (
            <p className="practice__error" role="alert">
              {startError}
            </p>
          ) : null}
          {/* Real navigation so start works even if client handlers never attach. */}
          <Link href="/learn/radicals/practice?start=1" className="practice__cta">
            Start practice
          </Link>
        </section>
      ) : null}

      {phase === "question" && current ? (
        <section
          className="practice-panel practice-panel--quiz"
          aria-labelledby="practice-prompt"
        >
          <p className="practice__progress" aria-live="polite">
            {index + 1} / {items.length}
          </p>
          <p className="practice__mode">
            {current.mode === "glyph-to-gloss"
              ? "What does this mean?"
              : "Which form matches this meaning?"}
          </p>
          <p
            id="practice-prompt"
            className={
              current.promptLang === "zh-Hans"
                ? "practice__prompt practice__prompt--glyph"
                : "practice__prompt practice__prompt--gloss"
            }
            lang={current.promptLang}
          >
            {current.prompt}
          </p>
          <ul className="practice-choices">
            {current.options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="practice-choices__btn"
                  onClick={() => onSelectOption(option.id)}
                  lang={option.lang}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {phase === "question" && !current ? (
        <section className="practice-panel" aria-labelledby="practice-empty-title">
          <h2 id="practice-empty-title" className="practice__title">
            Could not load items
          </h2>
          <p className="practice__lede">
            The session had no questions. Go back and try starting again.
          </p>
          <Link href="/learn/radicals/practice" className="practice__cta">
            Back to start
          </Link>
        </section>
      ) : null}

      {phase === "feedback" && current && lastResult && radicalForCurrent ? (
        <section
          className="practice-panel practice-panel--quiz"
          aria-labelledby="practice-feedback"
        >
          <p className="practice__progress">
            {index + 1} / {items.length}
          </p>
          <p
            id="practice-feedback"
            key={feedbackKey}
            className={
              lastResult.correct
                ? "practice__result practice__result--ok"
                : "practice__result practice__result--miss"
            }
            role="status"
            tabIndex={-1}
          >
            {lastResult.correct ? "Correct" : "Not quite"}
          </p>
          <p
            className={
              current.promptLang === "zh-Hans"
                ? "practice__prompt practice__prompt--glyph practice__prompt--settled"
                : "practice__prompt practice__prompt--gloss practice__prompt--settled"
            }
            lang={current.promptLang}
          >
            {current.prompt}
          </p>
          <p className="practice__answer-line">
            <span lang="zh-Hans">{radicalForCurrent.forms[0]}</span>
            <span aria-hidden="true"> — </span>
            <span>{radicalForCurrent.gloss}</span>
          </p>

          {/* Progressive disclosure: aids only after the answer */}
          <div className="practice-aids">
            {radicalForCurrent.variantsNote ? (
              <p className="practice-aids__note">{radicalForCurrent.variantsNote}</p>
            ) : null}
            <ul className="practice-aids__examples">
              {radicalForCurrent.examples.slice(0, 2).map((example) => (
                <li key={`${example.char}-${example.gloss}`}>
                  <span lang="zh-Hans">{example.char}</span>
                  <span className="practice-aids__example-gloss">
                    {example.gloss}
                  </span>
                </li>
              ))}
            </ul>
            <p className="practice-aids__study">
              <Link href={`/learn/radicals/${radicalForCurrent.id}`}>
                Study {radicalForCurrent.forms[0]}
              </Link>
            </p>
          </div>

          <button type="button" className="practice__cta" onClick={onContinue}>
            {index + 1 >= items.length ? "See summary" : "Next"}
          </button>
        </section>
      ) : null}

      {phase === "summary" ? (
        <section className="practice-panel" aria-labelledby="practice-summary-title">
          <h2 id="practice-summary-title" className="practice__title">
            Session done
          </h2>
          <p className="practice__summary-score">
            {summary.correct} of {summary.total} correct
          </p>
          <p className="practice__lede">
            Progress is saved in this browser. Study any radical you missed, then
            try another round when ready.
          </p>
          <ul className="practice-review">
            {answers.map((row) => {
              const radical = radicals.find((r) => r.id === row.item.radicalId);
              if (!radical) {
                return null;
              }
              return (
                <li key={row.item.id} className="practice-review__item">
                  <span
                    className={
                      row.correct
                        ? "practice-review__mark practice-review__mark--ok"
                        : "practice-review__mark practice-review__mark--miss"
                    }
                  >
                    {row.correct ? "Ok" : "Miss"}
                  </span>
                  <Link
                    href={`/learn/radicals/${radical.id}`}
                    className="practice-review__link"
                  >
                    <span lang="zh-Hans">{radical.forms[0]}</span>
                    <span>{radical.gloss}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="practice__actions">
            <button type="button" className="practice__cta" onClick={restartInPlace}>
              Practice again
            </button>
            <Link className="practice__secondary" href="/learn/radicals">
              Back to radicals
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
