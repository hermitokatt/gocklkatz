import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Arbeitsmarkt",
  description:
    "A job-listing pipeline demo — synthetic data only; no live listings are acquired or published.",
};

export default function HomePage() {
  return (
    <main className="home">
      <div className="homeAtmosphere" aria-hidden="true" />
      <article className="homeCard">
        <p className="homeKicker">Portfolio demo · pipeline exhibit</p>
        <h1 className="homeBrand">Arbeitsmarkt</h1>
        <p className="homeLead">
          A relevance-ranked job digest pipeline shown with synthetic listings. The interesting
          engineering is the compliance surface — budgets, retention, and alarms — not harvested
          third-party data.
        </p>
        <p>
          <Link className="homeCta" href="/arbeitsmarkt">
            Open the exhibit
          </Link>{" "}
          <Link className="homeCta" href="/arbeitsmarkt/digest">
            Open the digest
          </Link>{" "}
          <Link className="homeCta" href="/arbeitsmarkt/operations">
            Open operations
          </Link>
        </p>
        <p className="homeFoot">
          Health: <a href="/api/health">GET /api/health</a>
        </p>
      </article>
    </main>
  );
}
