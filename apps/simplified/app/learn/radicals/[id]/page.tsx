import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getRadicalDetail, listRadicals } from "@/lib/radicals";

type PageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return listRadicals().radicals.map((radical) => ({ id: radical.id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = getRadicalDetail(id);
  if (!detail) {
    return { title: "Radical not found — Simplified" };
  }

  const { radical } = detail;
  const forms = radical.forms.join(" · ");
  return {
    title: `${forms} — ${radical.gloss} · Simplified`,
    description: `Study the radical ${forms}: ${radical.gloss}.`,
  };
}

export default async function RadicalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = getRadicalDetail(id);
  if (!detail) {
    notFound();
  }

  const { radical } = detail;
  const [primary, ...variants] = radical.forms;

  return (
    <main className="study study--detail">
      <div className="study__inner study__inner--detail">
        <header className="study__header">
          <p className="study__brand">
            <Link href="/">Simplified</Link>
            <span className="study__brand-hanzi" lang="zh-Hans">
              汉字入门
            </span>
          </p>
          <p className="study__crumb">
            <Link href="/learn/radicals">Radicals</Link>
            <span aria-hidden="true"> / </span>
            <span lang="zh-Hans">{primary}</span>
          </p>
        </header>

        <article className="radical-detail">
          <h1 className="radical-detail__forms" lang="zh-Hans">
            <span className="radical-detail__primary">{primary}</span>
            {variants.map((form) => (
              <span key={form} className="radical-detail__variant">
                {form}
              </span>
            ))}
          </h1>

          <p className="radical-detail__gloss">
            {radical.gloss}
            {radical.pinyin ? (
              <span className="radical-detail__pinyin">{radical.pinyin}</span>
            ) : null}
          </p>

          {radical.variantsNote ? (
            <p className="radical-detail__note">{radical.variantsNote}</p>
          ) : null}

          <section className="radical-detail__examples" aria-labelledby="examples-heading">
            <h2 id="examples-heading" className="radical-detail__examples-title">
              Appears in
            </h2>
            <ul className="example-list">
              {radical.examples.map((example) => (
                <li key={`${example.char}-${example.gloss}`} className="example-list__item">
                  <span className="example-list__char" lang="zh-Hans">
                    {example.char}
                  </span>
                  <span className="example-list__meta">
                    {example.pinyin ? (
                      <span className="example-list__pinyin">{example.pinyin}</span>
                    ) : null}
                    <span className="example-list__gloss">{example.gloss}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </article>

        <p className="study__nav">
          <Link href="/learn/radicals">← All radicals</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/learn/radicals/practice">Practice</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/">Home</Link>
        </p>
      </div>
    </main>
  );
}
