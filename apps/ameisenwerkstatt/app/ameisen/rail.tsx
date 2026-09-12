import styles from "./ameisen.module.css";

export type RailPlateModel = {
  label: string;
  value: string;
  tone: "gold" | "green" | "cyan" | "magenta" | "bone";
  noteLines: readonly string[];
  alert?: boolean;
  flash?: boolean;
  heartbeat?: boolean;
  /** Smaller value type for the STE-52 decision peek — keeps the rail calm. */
  compact?: boolean;
};

export type RailModel = {
  besteTour: RailPlateModel;
  iteration: RailPlateModel;
  pheromon: RailPlateModel;
  gesperrt: RailPlateModel;
  /** Compact top-candidate p peek (STE-52). Read-only; not a fifth tool. */
  wahl: RailPlateModel;
};

type RailProps = {
  model: RailModel;
};

export function Rail({ model }: RailProps) {
  const plates = [model.besteTour, model.iteration, model.pheromon, model.gesperrt, model.wahl];
  return (
    <section className={styles.rail} aria-live="polite">
      {plates.map((plate, index) => {
        const classes = [styles.plate];
        if (plate.alert) {
          classes.push(styles.plateAlert);
        }
        if (plate.flash) {
          classes.push(styles.plateFlash);
        }
        if (plate.heartbeat) {
          classes.push(styles.plateHeartbeat);
        }
        if (plate.compact) {
          classes.push(styles.plateCompact);
        }
        return (
          <article key={index} className={classes.join(" ")}>
            <div className={styles.plateLabel}>{plate.label}</div>
            <div className={`${styles.plateValue} ${toneClass(plate.tone)}`}>{plate.value}</div>
            <div className={styles.plateNote}>
              {plate.noteLines.map((line, lineIndex) => (
                <span key={lineIndex} className={styles.plateNoteLine}>
                  {line}
                </span>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function toneClass(tone: RailPlateModel["tone"]): string {
  switch (tone) {
    case "gold":
      return styles.toneGold;
    case "green":
      return styles.toneGreen;
    case "cyan":
      return styles.toneCyan;
    case "magenta":
      return styles.toneMagenta;
    case "bone":
      return styles.toneBone;
  }
}
