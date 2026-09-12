import type { Metadata } from "next";
import { ColonyStage } from "./colony-stage";
import styles from "./ameisen.module.css";

export const metadata: Metadata = {
  title: "Ameisenfabrik — Werkstatt",
  description:
    "The Werkstatt: a live ant colony on a fixed TSP — 3D walk graph, chaos injection, and an allowlisted tool façade. No LLM.",
};

export default function AmeisenPage() {
  return (
    <main className={styles.shell}>
      <ColonyStage />
    </main>
  );
}
