import type { Metadata } from "next";
import Link from "next/link";
import { getDataset, SYNTHETIC_STATEMENT } from "@/lib/dataset";
import styles from "./arbeitsmarkt.module.css";

export const metadata: Metadata = {
  title: "Exhibit",
  description:
    "Synthetic job-listing dataset for the Arbeitsmarkt pipeline demo. No live listings.",
};

/**
 * First of several views. Later issues add the ranked digest and the operational surface;
 * this page establishes the synthetic-data statement and a readable sample of the committed set.
 */
export default function ArbeitsmarktPage() {
  const dataset = getDataset();
  const sample = dataset.records.slice(0, 6);

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" />

      <header className={styles.hero}>
        <p className={styles.kicker}>Arbeitsmarkt · pipeline exhibit</p>
        <h1 className={styles.brand}>Arbeitsmarkt</h1>
        <p className={styles.lead}>
          This demo presents the job-listing pipeline using a committed synthetic dataset. The
          acquisition path that would collect third-party listings is absent from the shipped app.
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
          Seed <code>{dataset.meta.seed}</code> · schema v{dataset.meta.schemaVersion} ·{" "}
          {dataset.meta.recordCount} records · posting dates inside{" "}
          {dataset.meta.dateWindow.startInclusive} … {dataset.meta.dateWindow.endInclusive}
        </p>
      </section>

      <section className={styles.panel} aria-labelledby="sample-heading">
        <div className={styles.panelHead}>
          <h2 id="sample-heading">Sample listings</h2>
          <p>
            Company names follow <code>{dataset.legend.construction.split(";")[0]}</code>. Every
            record carries <code>synthetic: true</code> in the dataset itself.
          </p>
        </div>
        <ul className={styles.list}>
          {sample.map((record) => (
            <li
              key={record.id}
              className={styles.item}
              data-synthetic={String(record.synthetic)}
              data-sample-record={record.id}
            >
              <div className={styles.itemTop}>
                <span className={styles.badge}>synthetic</span>
                <span className={styles.id}>{record.id}</span>
              </div>
              <h3 className={styles.title}>{record.title}</h3>
              <p className={styles.company}>{record.companyName}</p>
              <p className={styles.meta}>
                {record.location} · posted {record.postedOn}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="legend-heading">
        <div className={styles.panelHead}>
          <h2 id="legend-heading">Name-part legend</h2>
          <p>Invented stems only — mapped here so artificiality is visible in the data.</p>
        </div>
        <div className={styles.legendGrid}>
          <LegendColumn label="Prefixes" parts={dataset.legend.prefixes} />
          <LegendColumn label="Middles" parts={dataset.legend.middles} />
          <LegendColumn label="Suffixes" parts={dataset.legend.suffixes} />
          <LegendColumn label="Districts" parts={dataset.legend.locationDistricts} />
          <LegendColumn label="Zones" parts={dataset.legend.locationZones} />
        </div>
      </section>

      <section className={styles.roadmap} aria-labelledby="next-heading">
        <h2 id="next-heading">Pipeline views</h2>
        <ul>
          <li>
            <Link href="/arbeitsmarkt/digest">Ranked digest</Link> — filter, then rank against the
            committed demonstration profile
          </li>
          <li>
            <Link href="/arbeitsmarkt/operations">Operations</Link> — source health, budgets, and
            alarms (no live collection)
          </li>
        </ul>
      </section>

      <p className={styles.back}>
        <Link href="/arbeitsmarkt/digest">Open the digest</Link>
        {" · "}
        <Link href="/arbeitsmarkt/operations">Open operations</Link>
        {" · "}
        <Link href="/">Back to Arbeitsmarkt</Link>
      </p>
    </main>
  );
}

function LegendColumn({
  label,
  parts,
}: {
  label: string;
  parts: readonly { token: string; meaning: string }[];
}) {
  return (
    <div>
      <h3 className={styles.legendLabel}>{label}</h3>
      <ul className={styles.legendList}>
        {parts.map((part) => (
          <li key={part.token}>
            <strong>{part.token}</strong>
            <span>{part.meaning}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
