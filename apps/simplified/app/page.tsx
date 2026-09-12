import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home">
      <div className="home__inner">
        <h1 className="brand">
          Simplified
          <span className="brand__hanzi" lang="zh-Hans">
            汉字入门
          </span>
        </h1>
        <p className="headline">Learn Chinese from the parts that matter.</p>
        <p className="lede">
          Start with radicals and common components — the building blocks of simplified characters.
        </p>
        <div className="cta">
          <Link className="cta__primary" href="/learn/radicals">
            Start with radicals
          </Link>
          <Link className="cta__secondary" href="/learn/radicals/practice">
            Practice recognition
          </Link>
        </div>
      </div>
    </main>
  );
}
