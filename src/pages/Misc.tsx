import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import styles from "./Misc.module.scss";

const Misc: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.misc}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate("/")}>← Назад</button>
      </div>

      <div className={styles.miscContainer}>
        <h1 className={styles.miscTitle}>Разное</h1>

        <div className={styles.miscContent}>
          <div className={styles.miscButtons}>
            <Button variant="primary" size="large" onClick={() => console.log("Сообщество")} className={styles.miscButton}>
              Сообщество
            </Button>

            <Button variant="secondary" size="large" onClick={() => console.log("Кузня")} className={styles.miscButton}>
              Кузня
            </Button>

            <Button variant="outline" size="large" onClick={() => console.log("Тех поддержка")} className={styles.miscButton}>
              Тех поддержка
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Misc;
