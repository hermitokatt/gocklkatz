import type { Metadata } from "next";
import Link from "next/link";

import { listRadicals } from "@/lib/radicals";

export const metadata: Metadata = {
  title: "Radicals — Simplified",
  description:
    "Browse meaning components and radicals that build simplified Chinese characters.",
};

export default function LearnRadicalsPage() {
  const { radicals } = listRadicals();

  return (
    <main className="study">
      <div className="study__inner">
        <header className="study__header">
          <p className="study__brand">
            <Link href="/">Simplified</Link>
            <span className="study__brand-hanzi" lang="zh-Hans">
              汉字入门
            </span>
          </p>
          <h1 className="study__title">Radicals</h1>
          <p className="study__lede">
            Meaning components that recur across simplified characters — start
            here before full words.
          </p>
          <p className="study__practice-link">
            <Link href="/learn/radicals/practice">Practice recognition</Link>
          </p>
        </header>

        <ol className="radical-index" aria-label="Radicals">
          {radicals.map((radical, index) => (
            <li
              key={radical.id}
              className="radical-index__item"
              style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
            >
              <Link
                className="radical-index__link"
                href={`/learn/radicals/${radical.id}`}
              >
                <span className="radical-index__primary" lang="zh-Hans">
                  {radical.forms[0]}
                </span>
                <span className="radical-index__gloss">{radical.gloss}</span>
              </Link>
            </li>
          ))}
        </ol>

        <p className="study__nav">
          <Link href="/">← Home</Link>
        </p>
      </div>
    </main>
  );
}
