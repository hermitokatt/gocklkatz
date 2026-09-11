import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Software Factory Demo #1",
  description:
    "Ameisenfabrik — live ACO colony, DualAB-A façade, Origin→Vercel. Demo #1 proof: full-stack in ~2 days.",
};

export default function HomePage() {
  return (
    <main className="home">
      <div className="homeAtmosphere" aria-hidden="true" />
      <article className="factoryCard">
        <p className="factoryKicker">Software Factory · Demo #1</p>
        <h1 className="factoryBrand">Ameisenfabrik</h1>
        <p className="factoryLead">
          Living ant-colony optimization on a fixed TSP. Meaningful backend, Werkstatt UI, public URL —
          proof we can create and deploy full-stack in ~2 days.
        </p>
        <ul className="factoryBeats">
          <li>live ACO · chaos inject · no LLM</li>
          <li>DualAB-A typed tools façade</li>
          <li>Origin → Vercel production</li>
        </ul>
        <p className="factoryCtaRow">
          <Link className="factoryCta" href="/ameisen">
            Enter the Werkstatt
          </Link>
        </p>
        <p className="factoryNext">
          Next · Demo #2 · <span className="factoryNextBrand">Bienenfabrik</span> ·{" "}
          <code>/bienen</code> · due Wed evening Vienna
        </p>
        <p className="factoryFoot">
          Health: <a href="/api/health">GET /api/health</a>
          {" · "}
          <a href="https://cursor.com/codebase/gocklkatz/gocklkatz">Source</a>
        </p>
      </article>
    </main>
  );
}
