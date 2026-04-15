import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../stores/useAppStore";
import { updateFrame } from "../core/api";
import AvatarWithFrame, { FRAMES, FRAME_NAMES } from "../components/AvatarWithFrame";
import styles from "./Shop.module.scss";

export default function Shop() {
  const navigate = useNavigate();
  const { user, setUser } = useAppStore();

  const [selected, setSelected] = useState<number>(user?.selected_frame ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSelect = useCallback(async (frameIdx: number) => {
    if (saving || frameIdx === selected) return;
    setSelected(frameIdx);
    setSaving(true);
    try {
      const res = await updateFrame(frameIdx);
      if (user) setUser({ ...user, ...res.data });
    } catch {
      setSelected(selected);
    } finally {
      setSaving(false);
    }
  }, [saving, selected, user, setUser]);

  if (!user) return null;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← Назад</button>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Магазин</h1>
        <p className={styles.subtitle}>Выбери оформление для аватарки</p>
      </div>

      {/* Live preview */}
      <div className={styles.preview}>
        <AvatarWithFrame
          photoUrl={user.photo_url}
          firstName={user.first_name}
          lastName={user.last_name}
          frame={selected}
          size={100}
          fallbackClassName={styles.avatarFallback}
        />
        <p className={styles.previewLabel}>{FRAME_NAMES[selected]}</p>
      </div>

      {/* Grid of frames */}
      <div className={styles.grid}>
        {FRAMES.map((_, idx) => (
          <button
            key={idx}
            className={`${styles.frameCard} ${selected === idx ? styles.active : ""}`}
            onClick={() => handleSelect(idx)}
            disabled={saving}
          >
            <div className={styles.framePreview}>
              <AvatarWithFrame
                photoUrl={user.photo_url}
                firstName={user.first_name}
                lastName={user.last_name}
                frame={idx}
                size={60}
                fallbackClassName={styles.avatarFallbackSmall}
              />
            </div>
            <span className={styles.frameName}>{FRAME_NAMES[idx]}</span>
            <span className={styles.frameBadge}>Бесплатно</span>
            {selected === idx && <span className={styles.activeCheck}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
