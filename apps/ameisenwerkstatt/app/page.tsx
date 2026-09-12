import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ameisenwerkstatt",
  description:
    "Ant colony optimisation on a fixed travelling-salesman problem, in a live 3D Werkstatt you can disturb.",
};

export default function HomePage() {
  return (
    <main className="home">
      <div className="homeAtmosphere" aria-hidden="true" />
      <article className="factoryCard">
        <p className="factoryKicker">Ant colony optimisation · live simulation</p>
        <h1 className="factoryBrand">Ameisenfabrik</h1>
        <p className="factoryLead">
          A living ant colony optimises a fixed travelling-salesman problem in the browser, with a
          real backend behind it: one shared colony, a typed HTTP façade, and a Werkstatt view whose
          chaos controls you can use to watch it recover.
        </p>
        <ul className="factoryBeats">
          <li>live ACO · chaos inject · no LLM</li>
          <li>Typed, allowlisted tool façade</li>
          <li>One shared colony behind every view</li>
        </ul>
        <p className="factoryCtaRow">
          <Link className="factoryCta" href="/ameisen">
            Enter the Werkstatt
          </Link>
        </p>
        <p className="factoryNext">
          One of four demos ·{" "}
          <a className="factoryNextBrand" href="https://gocklkatz.vercel.app">
            gocklkatz.vercel.app
          </a>
        </p>
        <p className="factoryFoot">
          Health: <a href="/api/health">GET /api/health</a>
          {" · "}
          <a href="https://github.com/hermitokatt/gocklkatz">Source</a>
        </p>
      </article>
    </main>
  );
}
