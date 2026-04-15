import React from "react";
import styles from "./TimeControlPicker.module.scss";

export interface TimeControl {
  base: number;
  increment: number;
}

export interface TimeControlOption {
  base: number;
  increment: number;
  label: string;
  category: "Пуля" | "Блиц" | "Рапид" | "Классика";
}

export const TIME_CONTROLS: TimeControlOption[] = [
  { base: 60,   increment: 0,  label: "1+0",   category: "Пуля" },
  { base: 120,  increment: 1,  label: "2+1",   category: "Пуля" },
  { base: 180,  increment: 0,  label: "3+0",   category: "Блиц" },
  { base: 180,  increment: 2,  label: "3+2",   category: "Блиц" },
  { base: 300,  increment: 0,  label: "5+0",   category: "Блиц" },
  { base: 300,  increment: 3,  label: "5+3",   category: "Блиц" },
  { base: 600,  increment: 0,  label: "10+0",  category: "Рапид" },
  { base: 600,  increment: 5,  label: "10+5",  category: "Рапид" },
  { base: 900,  increment: 10, label: "15+10", category: "Рапид" },
  { base: 1800, increment: 0,  label: "30+0",  category: "Классика" },
  { base: 1800, increment: 20, label: "30+20", category: "Классика" },
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Пуля":     "Молниеносные партии. Нет времени на долгие расчёты — только инстинкт.",
  "Блиц":     "Быстрые партии. Популярный формат — нужно играть уверенно и быстро.",
  "Рапид":    "Темповые партии. Достаточно времени для тактики и стратегии.",
  "Классика": "Классические партии. Максимальное время для глубокого анализа.",
};

const CATEGORY_ORDER = ["Пуля", "Блиц", "Рапид", "Классика"] as const;

function formatDescription(opt: TimeControlOption): string {
  const mins = opt.base / 60;
  const minsStr = Number.isInteger(mins) ? `${mins} мин` : `${opt.base} сек`;
  if (opt.increment === 0) {
    return `${minsStr} на всю партию`;
  }
  return `${minsStr} на партию + ${opt.increment} сек за каждый ход`;
}

interface TimeControlPickerProps {
  value: TimeControl;
  onChange: (tc: TimeControl) => void;
}

const TimeControlPicker: React.FC<TimeControlPickerProps> = ({ value, onChange }) => {
  const isSelected = (opt: TimeControlOption) =>
    opt.base === value.base && opt.increment === value.increment;

  const selected = TIME_CONTROLS.find(isSelected);

  return (
    <div className={styles.picker}>
      {CATEGORY_ORDER.map((cat) => {
        const opts = TIME_CONTROLS.filter((o) => o.category === cat);
        return (
          <div key={cat} className={styles.group}>
            <span className={styles.groupLabel}>{cat}</span>
            <div className={styles.options}>
              {opts.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`${styles.option} ${isSelected(opt) ? styles.active : ""}`}
                  onClick={() => onChange({ base: opt.base, increment: opt.increment })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {selected && (
        <div className={styles.info}>
          <span className={styles.infoName}>{selected.label} · {selected.category}</span>
          <span className={styles.infoDesc}>{formatDescription(selected)}</span>
          <span className={styles.infoRule}>{CATEGORY_DESCRIPTIONS[selected.category]}</span>
        </div>
      )}
    </div>
  );
};

export default TimeControlPicker;
