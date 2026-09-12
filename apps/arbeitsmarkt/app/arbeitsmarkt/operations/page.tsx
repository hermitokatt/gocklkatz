import type { Metadata } from "next";
import Link from "next/link";
import { SYNTHETIC_STATEMENT } from "@/lib/dataset";
import { ALARM_IDS, getOperationalSnapshot } from "@/lib/pipeline";
import styles from "../arbeitsmarkt.module.css";

export const metadata: Metadata = {
  title: "Operations",
  description:
    "Source health, budgets, and alarms over the synthetic Arbeitsmarkt registry. Demonstration policy only.",
};

/**
 * Server-rendered operational view. Content is computed in-process from the committed registry
 * and dataset. No client-side fetch for operational content.
 */
export default function OperationsPage() {
  const snapshot = getOperationalSnapshot();
  const firing = snapshot.alarms.filter((a) => a.state === "firing");
  const clear = snapshot.alarms.filter((a) => a.state === "clear");
  const quarantined = snapshot.sources.filter((s) => s.operationalStatus === "quarantined");
  const backedOff = snapshot.sources.filter((s) => s.operationalStatus === "backed_off");
  const permitted = snapshot.sources.filter((s) => s.complianceStatus === "permitted");
  const disabled = snapshot.sources.filter((s) => s.complianceStatus === "disabled");

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" />

      <header className={styles.hero}>
        <p className={styles.kicker}>Arbeitsmarkt · operations</p>
        <h1 className={styles.brand}>Operations</h1>
        <p className={styles.lead}>
          Source health, request budgets, and alarms over a synthetic registry. Failure is the
          interesting part: back-off and quarantine are derived from attempt records, not hidden.
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
          Dataset seed <code>{snapshot.datasetSeed}</code> · {snapshot.datasetRecordCount} listings
          · anchor <code>{snapshot.anchorAt}</code> · budget window{" "}
          <code>{snapshot.budgetWindow}</code>
        </p>
      </section>

      <section className={styles.panel} aria-labelledby="alarms-heading">
        <div className={styles.panelHead}>
          <h2 id="alarms-heading">Alarms</h2>
          <p>
            {firing.length} firing · {clear.length} clear. Every alarm id from the model is named
            below.
          </p>
        </div>
        <ul className={styles.list}>
          {snapshot.alarms.map((alarm) => (
            <li
              key={alarm.id}
              className={styles.item}
              data-alarm-id={alarm.id}
              data-alarm-state={alarm.state}
              data-alarm-severity={alarm.severity}
            >
              <div className={styles.itemTop}>
                <span
                  className={alarm.state === "firing" ? styles.rejectBadge : styles.badge}
                  data-alarm-state-label
                >
                  {alarm.state}
                </span>
                <span className={styles.id}>{alarm.id}</span>
                <span className={styles.meta}>{alarm.severity}</span>
              </div>
              <h3 className={styles.title}>{alarm.description}</h3>
              {alarm.state === "firing" && alarm.about ? (
                <p className={styles.rejectReason} data-alarm-about>
                  Firing about: {alarm.about}
                </p>
              ) : (
                <p className={styles.meta}>Clear — condition not met on this snapshot.</p>
              )}
            </li>
          ))}
        </ul>
        <p className={styles.demoNote} data-alarm-id-count={ALARM_IDS.length}>
          Model alarm ids: {ALARM_IDS.join(", ")}.
        </p>
      </section>

      <section className={styles.panel} aria-labelledby="sources-heading">
        <div className={styles.panelHead}>
          <h2 id="sources-heading">Sources</h2>
          <p>
            Names follow <code>displayName = &apos;SRC-&apos; + Prefix + Middle + Suffix</code>.
            Status, health, and budget are derived for each source.
          </p>
        </div>
        <ul className={styles.list}>
          {snapshot.sources.map((source) => (
            <li
              key={source.id}
              className={styles.item}
              data-source-id={source.id}
              data-source-name={source.displayName}
              data-source-status={source.status}
              data-operational-status={source.operationalStatus}
              data-health-state={source.health.state}
            >
              <div className={styles.itemTop}>
                <span className={styles.badge}>{source.status}</span>
                <span className={styles.id}>{source.id}</span>
                <span className={styles.meta}>{source.operationalStatus}</span>
              </div>
              <h3 className={styles.title} data-source-display-name>
                {source.displayName}
              </h3>
              <p className={styles.meta}>
                Health: {source.health.state}
                {source.health.lastAttemptAt
                  ? ` · last attempt ${source.health.lastAttemptAt}`
                  : " · no attempts"}
                {source.health.lastSuccessAt
                  ? ` · last success ${source.health.lastSuccessAt}`
                  : ""}
                {source.health.lastFailureAt
                  ? ` · last failure ${source.health.lastFailureAt} (${source.health.lastFailureOutcome})`
                  : ""}
                {source.health.consecutiveFailures > 0
                  ? ` · consecutive failures ${source.health.consecutiveFailures}`
                  : ""}
              </p>
              <p className={styles.meta} data-budget-window={source.budget.window}>
                Budget ({source.budget.window}): {source.budget.consumed} consumed of{" "}
                {source.budget.limit}, {source.budget.remaining} remaining · window{" "}
                {source.budget.windowStartsAt} … {source.budget.windowEndsAt}
              </p>
              {source.backoffUntil ? (
                <p className={styles.rejectReason} data-backoff-until={source.backoffUntil}>
                  Backed off until {source.backoffUntil} (demonstration interval{" "}
                  {snapshot.policy.backoffIntervalMinutes} minutes).
                </p>
              ) : null}
              {source.quarantineReason ? (
                <p className={styles.rejectReason} data-quarantine-reason>
                  {source.quarantineReason}
                </p>
              ) : null}
              <p className={styles.meta}>{source.complianceRule}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="policy-heading">
        <div className={styles.panelHead}>
          <h2 id="policy-heading">Failure policy</h2>
          <p>
            Demonstration policy only — not a production incident process. Full table in{" "}
            <code>docs/OPERATIONS.md</code>.
          </p>
        </div>
        <ul className={styles.list}>
          <li className={styles.item} data-policy-rule="backoff">
            <h3 className={styles.title}>Back-off</h3>
            <p className={styles.meta}>
              After {snapshot.policy.consecutiveFailuresBeforeBackoff} consecutive failures, defer
              attempts for {snapshot.policy.backoffIntervalMinutes} minutes from the last failure.
            </p>
            <p className={styles.meta}>
              In that state now:{" "}
              {backedOff.length === 0
                ? "none"
                : backedOff.map((s) => `${s.id} (${s.displayName})`).join(", ")}
            </p>
          </li>
          <li className={styles.item} data-policy-rule="quarantine">
            <h3 className={styles.title}>Quarantine</h3>
            <p className={styles.meta}>
              After {snapshot.policy.consecutiveFailuresBeforeQuarantine} consecutive failures,
              quarantine the source. A refused response (403) is recorded as{" "}
              <code>refused_403</code>, distinct from <code>transport_failure</code>.
            </p>
            <p className={styles.meta} data-quarantined-count={quarantined.length}>
              In that state now:{" "}
              {quarantined.length === 0
                ? "none"
                : quarantined.map((s) => `${s.id} (${s.displayName})`).join(", ")}
            </p>
          </li>
        </ul>
        <p className={styles.demoNote}>{snapshot.policy.note}</p>
      </section>

      <section className={styles.panel} aria-labelledby="compliance-heading">
        <div className={styles.panelHead}>
          <h2 id="compliance-heading">Compliance position</h2>
          <p>
            Design, not a disclaimer: which sources may be collected is decided by the registry and
            enforced by <code>isCollectionAllowed</code> in <code>lib/pipeline/operations.ts</code>.
          </p>
        </div>
        <ul className={styles.list}>
          <li className={styles.item} data-compliance="permitted">
            <h3 className={styles.title}>Permitted</h3>
            <p className={styles.meta}>
              {permitted.map((s) => `${s.id} (${s.displayName})`).join(", ")}
            </p>
          </li>
          <li className={styles.item} data-compliance="disabled">
            <h3 className={styles.title}>Disabled</h3>
            <p className={styles.meta}>
              {disabled.map((s) => `${s.id} (${s.displayName})`).join(", ")}
            </p>
          </li>
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="legend-heading">
        <div className={styles.panelHead}>
          <h2 id="legend-heading">Source-name legend</h2>
          <p>
            Sibling to the employer legend: invented stems only, so artificiality is visible in the
            data.
          </p>
        </div>
        <p className={styles.demoNote}>
          Construction: <code>displayName = &apos;SRC-&apos; + Prefix + Middle + Suffix</code>. See
          <code>data/sources.json</code> legend and <code>docs/SYNTHETIC_DATA.md</code>.
        </p>
      </section>

      <p className={styles.back}>
        <Link href="/arbeitsmarkt">Back to exhibit</Link>
        {" · "}
        <Link href="/arbeitsmarkt/digest">Digest</Link>
        {" · "}
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
