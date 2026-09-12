import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bienenstock",
  description: "Outdoor hive scene with an orbit camera — portfolio demo.",
};

export default function HomePage() {
  return (
    <main className="home">
      <div className="homeAtmosphere" aria-hidden="true" />
      <article className="hiveCard">
        <p className="hiveKicker">Portfolio demo · 3D scene</p>
        <h1 className="hiveBrand">Bienenstock</h1>
        <p className="hiveLead">
          A woven skep in a meadow — ground, vegetation, sky, and a camera you can move with pointer
          and wheel. Bee agents and visitor interactions are later issues in this epic.
        </p>
        <p>
          <Link className="hiveCta" href="/bienen">
            Enter the meadow
          </Link>
        </p>
        <p className="hiveFoot">
          Health: <a href="/api/health">GET /api/health</a>
        </p>
      </article>
    </main>
  );
}
