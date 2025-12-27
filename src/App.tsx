import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Training from "./pages/Training";
import OnlineGame from "./pages/OnlineGame";
import Tournament from "./pages/Tournament";
import Misc from "./pages/Misc";
import Profile from "./pages/Profile";
import { initializeApp } from "./core/init";
import { useAppStore } from "./stores/useAppStore";
import { getCachedInitData, setCachedInitData } from "./core/api";
import TokenInput from "./components/TokenInput";
import styles from "./App.module.scss";

function App() {
  const { isLoading } = useAppStore();
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Проверка необходимости ввода токена в режиме разработки
  useEffect(() => {
    const devMode = import.meta.env.VITE_DEV_MODE === "true";
    const hasToken = !!getCachedInitData();

    if (devMode && !hasToken) {
      setShowTokenInput(true);
      setIsInitializing(false);
    } else {
      // Инициализация приложения при монтировании
      initializeApp().then((success) => {
        if (success) {
          console.log("App initialized successfully");
        } else {
          console.warn("App initialization failed");
        }
        setIsInitializing(false);
      });
    }
  }, []);

  const handleTokenSubmit = async (token: string) => {
    // Сохраняем токен
    setCachedInitData(token);
    setShowTokenInput(false);
    setIsInitializing(true);

    // Инициализируем приложение с новым токеном
    const success = await initializeApp();
    if (success) {
      console.log("App initialized successfully with token");
    } else {
      console.warn("App initialization failed with token");
      // Если инициализация не удалась, показываем форму снова
      setShowTokenInput(true);
    }
    setIsInitializing(false);
  };

  // Показываем форму ввода токена в режиме разработки
  if (showTokenInput) {
    return <TokenInput onTokenSubmit={handleTokenSubmit} />;
  }

  // Показываем загрузчик во время инициализации
  if (isLoading || isInitializing) {
    return (
      <div className={styles.app}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/training" element={<Training />} />
          <Route path="/online-game" element={<OnlineGame />} />
          <Route path="/tournament" element={<Tournament />} />
          <Route path="/misc" element={<Misc />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
