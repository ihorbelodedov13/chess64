import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Training from "./pages/Training";
import OnlineGame from "./pages/OnlineGame";
import Tournament from "./pages/Tournament";
import Misc from "./pages/Misc";
import Profile from "./pages/Profile";
import UserProfilePage from "./pages/UserProfilePage";
import Shop from "./pages/Shop";
import GlobalNotifications from "./components/GlobalNotifications";
import { initializeApp } from "./core/init";
import { useAppStore } from "./stores/useAppStore";
import { getCachedInitData, setCachedInitData } from "./core/api";
import TokenInput from "./components/TokenInput";
import styles from "./App.module.scss";

// Redirects to /online-game when app is opened via invite link
function InviteRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (sessionStorage.getItem("invite_game_id")) {
      navigate("/online-game", { replace: true });
    }
  }, [navigate]);
  return null;
}

function App() {
  const { isLoading } = useAppStore();
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const devMode = import.meta.env.VITE_DEV_MODE === "true";

    // Invite link: сохраняем game_id из start_param (Telegram deep link) или URL param
    const startParam =
      tg?.initDataUnsafe?.start_param ||
      new URLSearchParams(window.location.search).get("startapp");
    if (startParam) {
      sessionStorage.setItem("invite_game_id", startParam);
    }

    // ── 1. Running inside Telegram Mini App ───────────────────────────────
    if (tg?.initData) {
      tg.ready();    // signal the app is ready to display
      tg.expand();   // go fullscreen

      setCachedInitData(tg.initData);
      initializeApp().finally(() => setIsInitializing(false));
      return;
    }

    // ── 2. Dev mode without Telegram context ──────────────────────────────
    if (devMode) {
      if (!getCachedInitData()) {
        setShowTokenInput(true);
        setIsInitializing(false);
      } else {
        initializeApp().finally(() => setIsInitializing(false));
      }
      return;
    }

    // ── 3. Production without Telegram context ────────────────────────────
    // App opened in a regular browser — still try to init (e.g. cached token)
    if (getCachedInitData()) {
      initializeApp().finally(() => setIsInitializing(false));
    } else {
      // No token available outside Telegram in production
      setIsInitializing(false);
    }
  }, []);

  const handleTokenSubmit = async (token: string) => {
    setCachedInitData(token);
    setShowTokenInput(false);
    setIsInitializing(true);

    const success = await initializeApp();
    if (!success) {
      setCachedInitData(null);
      setShowTokenInput(true);
    }
    setIsInitializing(false);
  };

  if (showTokenInput) {
    return <TokenInput onTokenSubmit={handleTokenSubmit} />;
  }

  if (isLoading || isInitializing) {
    return (
      <div className={styles.app}>
        <div className={styles.loading} />
      </div>
    );
  }

  return (
    <Router>
      <InviteRedirect />
      <GlobalNotifications />
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/training" element={<Training />} />
          <Route path="/online-game" element={<OnlineGame />} />
          <Route path="/tournament" element={<Tournament />} />
          <Route path="/misc" element={<Misc />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user/:userId" element={<UserProfilePage />} />
          <Route path="/shop" element={<Shop />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
