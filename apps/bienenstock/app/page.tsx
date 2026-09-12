import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bienenstock",
  description:
    "Outdoor hive scene with a foraging bee colony and an orbit camera — portfolio demo.",
};

export default function HomePage() {
  return (
    <main className="home">
      <div className="homeAtmosphere" aria-hidden="true" />
      <article className="hiveCard">
        <p className="hiveKicker">Portfolio demo · 3D colony</p>
        <h1 className="hiveBrand">Bienenstock</h1>
        <p className="hiveLead">
          A woven skep in a meadow — bees leave, forage the flower patches, and recruit toward
          richer nectar. Boost or empty a patch, or disturb the hive. Move the camera with pointer
          and wheel.
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
