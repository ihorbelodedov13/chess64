import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import LocalGame from "../components/LocalGame";
import BotGame from "../components/BotGame";
import { Bot, Swords } from "lucide-react";
import styles from "./Training.module.scss";

type TrainingMode = "menu" | "self-game" | "bot-game";

const Training: React.FC = () => {
  const navigate = useNavigate();
  const [currentMode, setCurrentMode] = useState<TrainingMode>("menu");

  const handleBack = () => { navigate("/"); };
  const handleBackToMenu = () => { setCurrentMode("menu"); };

  if (currentMode === "bot-game") return <BotGame onBackToMenu={handleBackToMenu} />;

  if (currentMode === "self-game") return <LocalGame onBackToMenu={handleBackToMenu} />;

  return (
    <div className={styles.training}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={handleBack}>← Назад</button>
      </div>

      <div className={styles.trainingContainer}>
        <h1 className={styles.trainingTitle}>Тренировка</h1>

        <div className={styles.trainingContent}>
          <div className={styles.trainingButtons}>
            <Button variant="primary" size="large" onClick={() => setCurrentMode("bot-game")} className={styles.trainingButton}>
              <Bot size={17} style={{ marginRight: 8, flexShrink: 0 }} /> Игра против бота
            </Button>

            <Button variant="secondary" size="large" onClick={() => setCurrentMode("self-game")} className={styles.trainingButton}>
              <Swords size={17} style={{ marginRight: 8, flexShrink: 0 }} /> Игра сам с собой
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;
