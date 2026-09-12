import type { Metadata } from "next";
import Link from "next/link";
import { getDataset, SYNTHETIC_STATEMENT } from "@/lib/dataset";
import { getProfile, runPipeline, SCORE_COMPONENT_IDS } from "@/lib/pipeline";
import type { ScoreComponentId } from "@/lib/pipeline";
import styles from "../arbeitsmarkt.module.css";

export const metadata: Metadata = {
  title: "Digest",
  description:
    "Relevance-ranked digest over the synthetic Arbeitsmarkt dataset. Demonstration ranking only.",
};

const COMPONENT_LABELS: Record<ScoreComponentId, string> = {
  role_match: "Role match",
  focus_match: "Focus match",
  location_match: "Location match",
  recency: "Recency",
};

/**
 * Server-rendered digest. Content is computed in-process from the committed dataset and profile.
 * No client-side fetch for listings.
 */
export default function DigestPage() {
  const dataset = getDataset();
  const profile = getProfile();
  const pipeline = runPipeline(dataset, profile);

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" />

      <header className={styles.hero}>
        <p className={styles.kicker}>Arbeitsmarkt · ranked digest</p>
        <h1 className={styles.brand}>Digest</h1>
        <p className={styles.lead}>
          Collect, filter, rank, then digest — ranking is a late stage over a filtered set, not a
          search. Scores come from a committed demonstration profile against synthetic listings.
        </p>
      </header>

      <section className={styles.notice} aria-labelledby="synthetic-heading">
        <h2 id="synthetic-heading" className={styles.noticeTitle}>
          Synthetic data only
        </h2>
        <p className={styles.noticeBody} data-synthetic-statement>
          {SYNTHETIC_STATEMENT}
        </p>
        <p className={styles.noticeMeta}>
          Profile <code>{profile.id}</code> · {profile.label} · digest size {profile.digestSize}
        </p>
        <p className={styles.noticeBody}>{profile.statement}</p>
      </section>

      <section className={styles.panel} aria-labelledby="stages-heading">
        <div className={styles.panelHead}>
          <h2 id="stages-heading">Pipeline stages</h2>
          <p>
            Funnel counts for this run. Filter rejects carry reasons below; rank scores the
            survivors; digest keeps the top {profile.digestSize}.
          </p>
        </div>
        <ol className={styles.stageList}>
          {pipeline.stages.map((stage) => (
            <li
              key={stage.id}
              className={styles.stageItem}
              data-pipeline-stage={stage.id}
              data-stage-count={stage.count}
            >
              <span className={styles.stageLabel}>{stage.label}</span>
              <span className={styles.stageCount}>{stage.count}</span>
            </li>
          ))}
        </ol>
        <p className={styles.demoNote}>
          Demonstration ranking model — not a validated ranking of real vacancies. See{" "}
          <code>docs/RANKING.md</code>.
        </p>
      </section>

      <section className={styles.panel} aria-labelledby="digest-heading">
        <div className={styles.panelHead}>
          <h2 id="digest-heading">Ranked digest</h2>
          <p>
            Each entry shows its rank, listing fields, total score, and the weighted components that
            produced it.
          </p>
        </div>
        <ol className={styles.digestList}>
          {pipeline.digest.map((entry) => (
            <li
              key={entry.record.id}
              className={styles.digestItem}
              data-digest-entry
              data-rank={entry.rank}
              data-score={String(entry.score.total)}
            >
              <div className={styles.itemTop}>
                <span className={styles.rankBadge} data-rank-label>
                  Rank {entry.rank}
                </span>
                <span className={styles.badge}>synthetic</span>
                <span className={styles.id}>{entry.record.id}</span>
                <span className={styles.scoreTotal}>score {entry.score.total.toFixed(4)}</span>
              </div>
              <h3 className={styles.title}>{entry.record.title}</h3>
              <p className={styles.company}>{entry.record.companyName}</p>
              <p className={styles.meta}>
                {entry.record.location} · posted {entry.record.postedOn}
              </p>
              <div className={styles.reasonBlock} data-reason>
                <p className={styles.reasonLead}>
                  Reason: weighted components sum to {entry.score.total.toFixed(4)}.
                </p>
                <ul className={styles.componentList}>
                  {SCORE_COMPONENT_IDS.map((id) => (
                    <li
                      key={id}
                      data-score-component={id}
                      data-component-raw={String(entry.score.components[id])}
                      data-component-weighted={String(entry.score.weighted[id])}
                    >
                      <strong>{COMPONENT_LABELS[id]}</strong>
                      <span>
                        raw {formatComponent(entry.score.components[id])} · weighted{" "}
                        {entry.score.weighted[id].toFixed(4)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.panel} aria-labelledby="rejected-heading">
        <div className={styles.panelHead}>
          <h2 id="rejected-heading">Filter rejections</h2>
          <p>
            {pipeline.rejected.length} listing
            {pipeline.rejected.length === 1 ? "" : "s"} removed before ranking, each with a stated
            reason.
          </p>
        </div>
        <ul className={styles.list}>
          {pipeline.rejected.map((item) => (
            <li
              key={item.record.id}
              className={styles.item}
              data-rejected-entry
              data-reject-reason={item.reasonCode}
            >
              <div className={styles.itemTop}>
                <span className={styles.rejectBadge}>{item.reasonCode}</span>
                <span className={styles.id}>{item.record.id}</span>
              </div>
              <h3 className={styles.title}>{item.record.title}</h3>
              <p className={styles.company}>{item.record.companyName}</p>
              <p className={styles.meta}>
                {item.record.location} · posted {item.record.postedOn}
              </p>
              <p className={styles.rejectReason}>{item.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.back}>
        <Link href="/arbeitsmarkt">Back to exhibit</Link>
        {" · "}
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}

function formatComponent(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(4);
}
