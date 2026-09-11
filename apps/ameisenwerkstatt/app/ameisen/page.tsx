import type { Metadata } from "next";
import { ColonyStage } from "./colony-stage";
import styles from "./ameisen.module.css";

export const metadata: Metadata = {
  title: "Ameisenfabrik — Demo #1",
  description:
    "Demo #1: living ACO Werkstatt — chaos inject, DualAB-A tools façade, no LLM. Software Factory on Origin→Vercel.",
};

export default function AmeisenPage() {
  return (
    <main className={styles.shell}>
      <ColonyStage />
    </main>
  );
}
