import { DemoCard } from "@/components/demo-card";
import { demos } from "@/lib/demos";
import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead__eyebrow">{site.company}</p>
        <h1 className="masthead__headline">{site.headline}</h1>
        <p className="masthead__lede" data-intro>
          {site.intro}
        </p>
      </header>

      <section className="demos" aria-labelledby="demos-heading">
        <h2 className="demos__heading" id="demos-heading">
          The work
        </h2>
        <div className="demos__grid">
          {demos.map((demo) => (
            <DemoCard demo={demo} key={demo.slug} />
          ))}
        </div>
      </section>

      <footer className="footer">
        <p className="footer__line">
          © {site.copyrightYear} {site.company}. Released under the {site.license} license.
        </p>
        <p className="footer__line">
          Source:{" "}
          <a className="footer__link" href={site.repositoryUrl}>
            {site.repositoryLabel}
          </a>
        </p>
      </footer>
    </main>
  );
}
