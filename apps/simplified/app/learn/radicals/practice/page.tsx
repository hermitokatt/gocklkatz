import type { Metadata } from "next";
import Link from "next/link";

import { buildPracticeSession } from "@/lib/practice";
import { listRadicals } from "@/lib/radicals";

import { PracticeQuiz } from "./practice-quiz";

export const metadata: Metadata = {
  title: "Practice — Radicals · Simplified",
  description:
    "Short recognition practice for meaning components: glyph to gloss and gloss to glyph.",
};

type PracticePageProps = {
  searchParams: Promise<{ start?: string | string[] }>;
};

export default async function RadicalPracticePage({ searchParams }: PracticePageProps) {
  const params = await searchParams;
  const startRaw = params.start;
  const startValue = Array.isArray(startRaw) ? startRaw[0] : startRaw;
  const started = startValue === "1";

  const { radicals } = listRadicals();
  const initialSession = started ? buildPracticeSession(radicals) : null;

  return (
    <main className="study study--practice">
      <div className="study__inner study__inner--practice">
        <header className="study__header study__header--compact">
          <p className="study__brand">
            <Link href="/">Simplified</Link>
            <span className="study__brand-hanzi" lang="zh-Hans">
              汉字入门
            </span>
          </p>
          <p className="study__crumb">
            <Link href="/learn/radicals">Radicals</Link>
            <span aria-hidden="true"> / </span>
            <span>Practice</span>
          </p>
        </header>

        {/* Remount when entering/leaving ?start=1 so lobby ↔ session state resets. */}
        <PracticeQuiz
          key={started ? "session" : "lobby"}
          radicals={radicals}
          initialSession={initialSession}
        />

        <p className="study__nav">
          <Link href="/learn/radicals">← All radicals</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/">Home</Link>
        </p>
      </div>
    </main>
  );
}
