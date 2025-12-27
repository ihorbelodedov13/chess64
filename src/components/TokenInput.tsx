import React, { useState } from "react";
import styles from "./TokenInput.module.scss";

interface TokenInputProps {
  onTokenSubmit: (token: string) => void;
}

const TokenInput: React.FC<TokenInputProps> = ({ onTokenSubmit }) => {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Пожалуйста, введите токен");
      return;
    }
    setError("");
    onTokenSubmit(token.trim());
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Введите токен пользователя</h2>
        <p className={styles.description}>
          Режим разработки активен. Пожалуйста, введите токен для авторизации.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="token" className={styles.label}>
              Токен:
            </label>
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError("");
              }}
              placeholder="Введите токен пользователя"
              className={styles.input}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
          </div>
          <button
            type="submit"
            className={`${styles.submitButton} ${styles.button}`}
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
};

export default TokenInput;
