import React, { useEffect, useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ChessBoard from "./ChessBoard";
import Button from "./Button";
import AvatarWithFrame from "./AvatarWithFrame";
import { useChessStore } from "../stores/useChessStore";
import { gameWebSocket } from "../services/socketService";
import type { WSServerMessage } from "../types/api";
import type { PlayerColor } from "../stores/useChessStore";
import { Bot, Flag, Handshake, LogOut, Zap, Circle, Link2, Send, Check, X, Crown } from "lucide-react";
import { cancelGame } from "../core/api";
import styles from "./GameRoom.module.scss";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string | undefined;

interface GameRoomProps {
  gameId: string;
  playerColor: PlayerColor;
  isBot?: boolean;
  isPrivate?: boolean;
  onLeave?: () => void;
}

type ModalType = "resign" | "leave" | null;

const GameRoom: React.FC<GameRoomProps> = ({ gameId, playerColor, isBot = false, isPrivate = false, onLeave }) => {
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [disconnectedSeconds, setDisconnectedSeconds] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const opponentEverConnected = useRef(false);

  // Local countdown timers (synced from server on each WS message)
  const [localTimeWhite, setLocalTimeWhite] = useState(600);
  const [localTimeBlack, setLocalTimeBlack] = useState(600);
  const localTimeWhiteRef = useRef(600);
  const localTimeBlackRef = useRef(600);

  const {
    gameStatus,
    currentTurn,
    opponentConnected,
    gameResult,
    gameResultReason,
    isCheck,
    isCheckmate,
    isStalemate,
    timeWhite,
    timeBlack,
    drawOfferReceived,
    ratingChangeWhite,
    ratingChangeBlack,
    error,
    whitePlayerInfo,
    blackPlayerInfo,
    initializeGame,
    handleGameState,
    handleMoveMade,
    handleGameOver,
    handleError,
    setConnected,
    setOpponentConnected,
    setDrawOfferReceived,
    addChatMessage,
    resetGame,
    isMyTurn,
  } = useChessStore();

  // Sync local timers from store (server values) — called after each WS message
  useEffect(() => {
    localTimeWhiteRef.current = timeWhite;
    localTimeBlackRef.current = timeBlack;
    setLocalTimeWhite(timeWhite);
    setLocalTimeBlack(timeBlack);
  }, [timeWhite, timeBlack]);

  // Live countdown tick — decrements active player's timer every second
  useEffect(() => {
    if (gameStatus !== "playing" || !opponentConnected && !isBot) return;

    const interval = setInterval(() => {
      if (currentTurn === "white") {
        localTimeWhiteRef.current = Math.max(0, localTimeWhiteRef.current - 1);
        setLocalTimeWhite(localTimeWhiteRef.current);
      } else {
        localTimeBlackRef.current = Math.max(0, localTimeBlackRef.current - 1);
        setLocalTimeBlack(localTimeBlackRef.current);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStatus, currentTurn, opponentConnected, isBot]);

  const handleMessage = useCallback((message: WSServerMessage) => {
    switch (message.type) {
      case "game_state":
        handleGameState(message);
        break;
      case "move_made":
        handleMoveMade(message);
        break;
      case "game_over":
        handleGameOver(message);
        break;
      case "error":
        handleError(message.message);
        break;
      case "opponent_connected":
        opponentEverConnected.current = true;
        setOpponentConnected(true);
        break;
      case "opponent_disconnected":
        setOpponentConnected(false);
        break;
      case "draw_offer":
        if (!isBot) setDrawOfferReceived(true, message.from_user);
        break;
      case "chat_message":
        addChatMessage(message.user_id, message.message, false);
        break;
    }
  }, [handleGameState, handleMoveMade, handleGameOver, handleError, setOpponentConnected, setDrawOfferReceived, addChatMessage, isBot]);

  useEffect(() => {
    initializeGame(gameId, playerColor);
    const unsubMessage = gameWebSocket.onMessage(handleMessage);
    const unsubConnect = gameWebSocket.onConnect(() => setConnected(true));
    const unsubDisconnect = gameWebSocket.onDisconnect(() => setConnected(false));
    const unsubError = gameWebSocket.onError((err) => {
      handleError(typeof err === "string" ? err : "Connection error");
    });
    gameWebSocket.connect(gameId);
    return () => {
      unsubMessage();
      unsubConnect();
      unsubDisconnect();
      unsubError();
      gameWebSocket.disconnect();
      resetGame();
    };
  }, [gameId, playerColor, handleMessage, initializeGame, setConnected, handleError, resetGame]);

  useEffect(() => {
    if (!isBot && !opponentConnected && gameStatus === "playing") {
      setDisconnectedSeconds(0);
      const interval = setInterval(() => setDisconnectedSeconds((s) => s + 1), 1000);
      return () => clearInterval(interval);
    } else {
      setDisconnectedSeconds(0);
    }
  }, [opponentConnected, gameStatus, isBot]);

  const handleMove = useCallback((from: string, to: string, promotion?: string) => {
    if (!isMyTurn()) return false;
    const moveStr = promotion ? `${from}${to}${promotion}` : `${from}${to}`;
    gameWebSocket.sendMove(moveStr);
    return true;
  }, [isMyTurn]);

  const handleResign = () => {
    gameWebSocket.sendResign();
    setOpenModal(null);
  };

  const handleOfferDraw = () => {
    gameWebSocket.sendDrawOffer();
  };

  const handleLeaveGame = () => {
    setOpenModal(null);
    gameWebSocket.disconnect();
    if (onLeave) {
      onLeave();
    } else {
      navigate("/online-game");
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusMessage = () => {
    if (error) return `Ошибка: ${error}`;
    switch (gameStatus) {
      case "connecting":
        return "Подключение...";
      case "waiting":
        return isBot ? "Запуск бота..." : "Ожидание соперника...";
      case "playing":
        if (isWaitingForInvite) return isPrivate ? "Ждём друга..." : "Ожидание соперника...";
        if (isCheckmate) return "Мат!";
        if (isStalemate) return "Пат!";
        if (isCheck) return isMyTurn() ? "Ваш король под шахом!" : "Шах!";
        return isMyTurn() ? "Ваш ход" : isBot ? "Бот думает..." : "Ход соперника";
      case "finished":
        return "Игра завершена";
      case "error":
        return "Ошибка соединения";
      default:
        return "Загрузка...";
    }
  };

  const getResultMessage = () => {
    if (!gameResult) return null;
    const resultText = { win: "Победа!", loss: "Поражение", draw: "Ничья" }[gameResult];
    const reasonText = gameResultReason ? ` · ${translateReason(gameResultReason)}` : "";
    return resultText + reasonText;
  };

  const translateReason = (reason: string): string => {
    const t: Record<string, string> = {
      checkmate: "мат",
      stalemate: "пат",
      resignation: "сдача",
      draw: "ничья",
      insufficient_material: "нет материала",
      timeout: "время",
      abandoned: "отключение соперника",
    };
    return t[reason] || reason;
  };

  const ratingChange = playerColor === "white" ? ratingChangeWhite : ratingChangeBlack;
  const opponentInfo = playerColor === "white" ? blackPlayerInfo : whitePlayerInfo;

  const inviteLink = BOT_USERNAME
    ? `https://t.me/${BOT_USERNAME}?start=${gameId}`
    : `${window.location.origin}/?startapp=${gameId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleShareTelegram = () => {
    const tg = window.Telegram?.WebApp as (TelegramWebApp & { openTelegramLink?: (url: string) => void }) | undefined;
    // Ссылка в теле текста — Telegram гарантированно делает https:// кликабельным
    const text = `♟ Давай сыграем в шахматы!\n\n${inviteLink}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  const handleCancelInvite = async () => {
    setIsCancelling(true);
    try {
      await cancelGame(gameId);
    } catch {
      // игра могла уже не существовать — всё равно уходим
    } finally {
      gameWebSocket.disconnect();
      if (onLeave) onLeave();
      else navigate("/online-game");
    }
  };

  // Waiting for invite opponent — только для приватных игр
  const isWaitingForInvite = !isBot && isPrivate && gameStatus === "playing" && !opponentConnected;
  // Waiting for random opponent — публичный матчмейкинг
  const isWaitingForOpponent = !isBot && !isPrivate && gameStatus === "playing" && !opponentConnected;

  return (
    <div className={styles.gameRoom}>

      {/* Header: opponent info + timers */}
      <div className={styles.gameHeader}>
        <div className={styles.statusSide}>
          {opponentInfo ? (
            <>
              <AvatarWithFrame
                photoUrl={opponentInfo.photo}
                firstName={opponentInfo.name}
                frame={opponentInfo.frame}
                size={44}
              />
              <div className={styles.opponentMeta}>
                <span className={styles.opponentName}>{opponentInfo.name}</span>
                {!opponentInfo.is_bot && (
                  <span className={styles.opponentRating}><Crown size={8} /> {opponentInfo.rating}</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={styles.gameStatus}>{getStatusMessage()}</div>
            </>
          )}
        </div>

        <div className={styles.timersSide}>
          <div className={`${styles.timer} ${currentTurn === "black" ? (playerColor === "black" ? styles.myTimer : styles.activeTimer) : ""}`}>
            <div className={styles.timerRow}>
              {isBot
                ? <Bot size={13} style={{ opacity: 0.7, flexShrink: 0 }} />
                : <Circle size={8} fill="currentColor" style={{ opacity: 0.6, flexShrink: 0 }} />
              }
              <span className={styles.timerValue}>{formatTime(localTimeBlack)}</span>
            </div>
          </div>
          <div className={`${styles.timer} ${currentTurn === "white" ? (playerColor === "white" ? styles.myTimer : styles.activeTimer) : ""}`}>
            <div className={styles.timerRow}>
              <Circle size={8} fill="white" style={{ flexShrink: 0 }} />
              <span className={styles.timerValue}>{formatTime(localTimeWhite)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Result overlay */}
      {gameStatus === "finished" && gameResult && (
        <div className={styles.resultOverlay}>
          <div className={`${styles.resultCard} ${styles[`result_${gameResult}`]}`}>
            <div className={styles.resultIcon}>
              {gameResult === "win" ? "🏆" : gameResult === "loss" ? "💀" : "🤝"}
            </div>
            <div className={styles.resultTitle}>{getResultMessage()}</div>
            {!isBot && ratingChange !== null && (
              <div className={`${styles.ratingBadge} ${ratingChange >= 0 ? styles.ratingPos : styles.ratingNeg}`}>
                {ratingChange > 0 ? `+${ratingChange}` : ratingChange} очков
              </div>
            )}
          </div>
        </div>
      )}

      {/* Waiting for random opponent overlay */}
      {isWaitingForOpponent && (
        <div className={styles.waitingOverlay}>
          <div className={styles.waitingPanel}>
            <div className={styles.waitingSpinner} />
            <div className={styles.waitingTitle}>Поиск соперника</div>
            <div className={styles.waitingHint}>Ожидаем игрока с таким же контролем времени...</div>
            <Button variant="ghost" size="medium" onClick={handleLeaveGame} className={styles.waitingCancelBtn}>
              <LogOut size={14} style={{ marginRight: 6 }} /> Отменить
            </Button>
          </div>
        </div>
      )}

      {/* Invite overlay — shown while waiting for the friend to join */}
      {isWaitingForInvite && (
        <div className={styles.inviteOverlay}>
          <div className={styles.invitePanel}>
            <div className={styles.invitePanelTitle}>Пригласите соперника</div>
            <p className={styles.inviteHint}>
              Скопируй ссылку и отправь другу — он перейдёт в бота и получит кнопку для входа в игру
            </p>
            <div className={styles.inviteLinkBox} onClick={handleCopyLink} role="button" style={{ cursor: "pointer" }}>
              <span className={styles.inviteLinkText}>{inviteLink}</span>
            </div>
            <div className={styles.inviteActions}>
              <Button variant="primary" size="medium" onClick={handleCopyLink}>
                {linkCopied
                  ? <><Check size={14} style={{ marginRight: 6 }} />Скопировано!</>
                  : <><Link2 size={14} style={{ marginRight: 6 }} />Скопировать ссылку</>
                }
              </Button>
              <Button variant="outline" size="medium" onClick={handleShareTelegram}>
                <Send size={14} style={{ marginRight: 6 }} />Поделиться в Telegram
              </Button>
              <Button
                variant="ghost"
                size="medium"
                onClick={handleCancelInvite}
                disabled={isCancelling}
                className={styles.inviteCancelBtn}
              >
                <X size={14} style={{ marginRight: 6 }} />
                {isCancelling ? "Отмена..." : "Отменить и выйти"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Opponent disconnected (human games only, was connected before) */}
      {!isBot && gameStatus === "playing" && !opponentConnected && opponentEverConnected.current && (
        <div className={styles.opponentDisconnected}>
          <div className={styles.opponentDisconnectedIcon}><Zap size={16} /></div>
          <div className={styles.opponentDisconnectedText}>
            <strong>Соперник отключился</strong>
            <span>Переподключение: {Math.max(0, 60 - disconnectedSeconds)} с</span>
          </div>
          <div className={styles.opponentDisconnectedTimer}>Таймер на паузе</div>
        </div>
      )}

      {/* Draw offer (human games only) */}
      {!isBot && drawOfferReceived && (
        <div className={styles.drawOffer}>
          <span>Соперник предлагает ничью</span>
          <Button variant="primary" size="small" onClick={() => handleOfferDraw()}>
            Принять
          </Button>
          <Button variant="outline" size="small" onClick={() => setDrawOfferReceived(false)}>
            Отклонить
          </Button>
        </div>
      )}

      {/* Chess board */}
      <div className={styles.gameBoard}>

        <ChessBoard
          onMove={handleMove}
          disabled={gameStatus !== "playing" || !isMyTurn() || isWaitingForOpponent}
          orientation={playerColor || "white"}
          showMoveHistory={true}
          myTurn={gameStatus === "playing" && isMyTurn() && !isWaitingForInvite && !isWaitingForOpponent}
        />

      </div>

      {/* Controls */}
      <div className={styles.gameControls}>
        {gameStatus === "playing" && !isWaitingForInvite && (isBot || opponentConnected) && (
          <>
            <Button variant="outline" size="medium" onClick={() => setOpenModal("resign")}>
              <Flag size={15} style={{ marginRight: 7 }} /> Сдаться
            </Button>
            {!isBot && (
              <Button variant="outline" size="medium" onClick={handleOfferDraw}>
                <Handshake size={15} style={{ marginRight: 7 }} /> Предложить ничью
              </Button>
            )}
          </>
        )}

        {gameStatus === "finished" && (
          <Button variant="primary" size="medium" onClick={handleLeaveGame}>
            В меню
          </Button>
        )}
      </div>

      {/* Modal: resign */}
      {openModal === "resign" && (
        <div className={styles.modalOverlay} onClick={() => setOpenModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}><Flag size={32} /></div>
            <h3 className={styles.modalTitle}>Сдаться?</h3>
            <p className={styles.modalText}>
              {isBot ? "Текущая партия будет завершена." : "Вы засчитаете сопернику победу."}
            </p>
            <div className={styles.modalActions}>
              <Button variant="primary" size="medium" onClick={handleResign}>
                Да, сдаюсь
              </Button>
              <Button variant="outline" size="medium" onClick={() => setOpenModal(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: leave */}
      {openModal === "leave" && (
        <div className={styles.modalOverlay} onClick={() => setOpenModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}><LogOut size={32} /></div>
            <h3 className={styles.modalTitle}>Покинуть игру?</h3>
            <p className={styles.modalText}>
              {isBot
                ? "Игра с ботом будет прервана."
                : "Игра продолжится без вас. Таймер будет идти."}
            </p>
            <div className={styles.modalActions}>
              <Button variant="primary" size="medium" onClick={handleLeaveGame}>
                Покинуть
              </Button>
              <Button variant="outline" size="medium" onClick={() => setOpenModal(null)}>
                Остаться
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameRoom;
