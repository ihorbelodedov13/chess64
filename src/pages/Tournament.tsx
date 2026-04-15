import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import styles from "./Tournament.module.scss";

const Tournament: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.tournament}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate("/")}>← Назад</button>
      </div>

      <div className={styles.tournamentContainer}>
        <h1 className={styles.tournamentTitle}>Турнир</h1>

        <div className={styles.tournamentContent}>
          <div className={styles.tournamentButtons}>
            <Button variant="primary" size="large" onClick={() => console.log("Записаться на турнир")} className={styles.tournamentButton}>
              Записаться на турнир
            </Button>

            <Button variant="secondary" size="large" onClick={() => console.log("График турниров")} className={styles.tournamentButton}>
              График турниров
            </Button>

            <Button variant="outline" size="large" onClick={() => console.log("Мероприятия")} className={styles.tournamentButton}>
              Мероприятия
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tournament;
