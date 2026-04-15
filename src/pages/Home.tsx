import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useAppStore } from "../stores/useAppStore";
import { User, Trophy, ClipboardList, LayoutGrid } from "lucide-react";
import AvatarWithFrame from "../components/AvatarWithFrame";
import chess64Url from "../assets/СHESS64.svg";
import horseBgUrl from "../assets/horsebg.png";
import styles from "./Home.module.scss";

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();

  return (
    <div className={styles.home}>
      {/* Фоновая лошадь */}
      <img src={horseBgUrl} alt="" className={styles.horseBg} />

      {/* Топбар */}
      <div className={styles.topBar}>
        <img src={chess64Url} alt="CHESS64" className={styles.logo} />
        {user && (
          <button className={styles.profileBtn} onClick={() => navigate("/profile")}>
            {user.photo_url || user.selected_frame ? (
              <AvatarWithFrame
                photoUrl={user.photo_url}
                firstName={user.first_name}
                lastName={user.last_name}
                frame={user.selected_frame ?? 0}
                size={44}
              />
            ) : (
              <User size={22} strokeWidth={1.8} />
            )}
          </button>
        )}
      </div>

      {/* Основной контент */}
      <div className={styles.content}>
        <h1 className={styles.title}>Сыграй в шахматы</h1>

        <div className={styles.mainActions}>
          <Button
            variant="primary"
            size="large"
            onClick={() => navigate("/online-game")}
            className={styles.netBtn}
          >
            ИГРА ПО СЕТИ
          </Button>

          <Button
            variant="secondary"
            size="large"
            onClick={() => navigate("/training")}
            className={styles.actionBtn}
          >
            Тренировка
          </Button>
        </div>

        {/* Нижние плитки */}
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <Trophy size={26} className={styles.tileIcon} />
            <span className={styles.tileName}>Турнир</span>
            <span className={styles.tileWip}>В разработке</span>
          </div>
          <div className={styles.tile}>
            <ClipboardList size={26} className={styles.tileIcon} />
            <span className={styles.tileName}>Задачи</span>
            <span className={styles.tileWip}>В разработке</span>
          </div>
          <div className={styles.tile}>
            <LayoutGrid size={26} className={styles.tileIcon} />
            <span className={styles.tileName}>Разное</span>
            <span className={styles.tileWip}>В разработке</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
