import { deploymentLabels, hasDeployment, statusLabels, type Demo } from "@/lib/demos";
import { site } from "@/lib/site";

/**
 * One card per demo. The anchor is rendered only for a `live` demo: a card pointing at a
 * deployment that does not exist is a dead link on the front page of the portfolio, which is
 * worse than no card at all.
 *
 * `data-demo` and `data-status` are part of the contract with scripts/verify.sh, which reads
 * the served markup to assert that rule in both directions.
 *
 * Each card also carries its measured claim, the file it came from, and the command that
 * reproduces it, because `AGENTS.md` §4 forbids publishing a number without provenance.
 * `data-claim`, `data-claim-source` and `data-claim-command` are what scripts/verify.sh reads.
 */
export function DemoCard({ demo }: { demo: Demo }) {
  const live = hasDeployment(demo);
  const sourceUrl = `${site.sourceBaseUrl}/${demo.claim.source}`;

  return (
    <article className="card" data-demo={demo.slug} data-status={demo.status}>
      <header className="card__head">
        <h3 className="card__name">{demo.name}</h3>
        <span className="card__badge" data-badge={demo.status}>
          {statusLabels[demo.status]}
        </span>
      </header>
      <p className="card__description">{demo.description}</p>
      <p className="card__claim" data-claim={demo.claim.text}>
        {demo.claim.text}
      </p>
      <p className="card__provenance">
        <a className="card__source" href={sourceUrl} data-claim-source={demo.claim.source}>
          {demo.claim.source}
        </a>
        <span className="card__command">
          reproduce: <code data-claim-command={demo.claim.command}>{demo.claim.command}</code>
        </span>
      </p>
      <p className="card__action">
        {live ? (
          <a className="card__link" href={demo.url}>
            {deploymentLabels[demo.status]}
            <span aria-hidden="true"> →</span>
          </a>
        ) : (
          <span className="card__pending">{deploymentLabels[demo.status]}</span>
        )}
      </p>
    </article>
  );
}
