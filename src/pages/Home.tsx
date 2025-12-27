import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useAppStore } from "../stores/useAppStore";
import styles from "./Home.module.scss";

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const handleTraining = () => {
    navigate("/training");
  };

  const handleOnlineGame = () => {
    navigate("/online-game");
  };

  const handleTournament = () => {
    navigate("/tournament");
  };

  const handleMisc = () => {
    navigate("/misc");
  };

  const handleProfile = () => {
    navigate("/profile");
  };

  return (
    <div className={styles.home}>
      <div className={styles.homeContainer}>
        {/* Кнопка профиля в правом верхнем углу */}
        {user && (
          <button className={styles.profileBtn} onClick={handleProfile}>
            {user.photo_url ? (
              <img src={user.photo_url} alt={user.first_name} />
            ) : (
              <span>👤</span>
            )}
          </button>
        )}

        <h1 className={styles.homeTitle}>Шахматы</h1>

        <div className={styles.homeButtons}>
          {/* Кнопка тренировка */}
          <Button
            variant="primary"
            size="large"
            onClick={handleTraining}
            className={`${styles.homeButton} ${styles.trainingButton}`}
          >
            Тренировка
          </Button>

          {/* Две кнопки в ряд */}
          <div className={styles.homeButtonRow}>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleOnlineGame}
              className={styles.homeButton}
            >
              Игра по сети
            </Button>

            <Button
              variant="secondary"
              size="medium"
              onClick={handleTournament}
              className={styles.homeButton}
            >
              Турнир
            </Button>
          </div>

          {/* Кнопка разное */}
          <Button
            variant="outline"
            size="medium"
            onClick={handleMisc}
            className={`${styles.homeButton} ${styles.miscButton}`}
          >
            Разное
          </Button>

          {/* Кнопка профиль */}
          <Button
            variant="outline"
            size="medium"
            onClick={handleProfile}
            className={styles.homeButton}
          >
            Профиль
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;
