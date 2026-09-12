import type { Metadata } from "next";
import { BienenStage } from "./bienen-stage";
import styles from "./bienen.module.css";

export const metadata: Metadata = {
  title: "Bienenstock — outdoor hive",
  description:
    "A woven skep in a meadow with a foraging bee colony and an orbit camera. Portfolio demo scene.",
};

export default function BienenPage() {
  return (
    <main className={styles.shell}>
      <BienenStage />
    </main>
  );
}
