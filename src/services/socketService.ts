import { getCachedInitData } from "../core/api";
import type {
  WSClientMessage,
  WSServerMessage,
  WSGameStateMessage,
  WSMoveMadeMessage,
  WSGameOverMessage,
  WSErrorMessage,
} from "../types/api";

type MessageHandler = (message: WSServerMessage) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Event | string) => void;

// WebSocket URL: приоритет VITE_WS_BASE_URL → VITE_API_BASE_URL → текущий хост страницы.
// Используем window.location чтобы автоматически поддерживать любой домен (ngrok, прод и т.д.)
function getWsBaseUrl(): string {
  if (import.meta.env.VITE_WS_BASE_URL) return import.meta.env.VITE_WS_BASE_URL;
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL.replace(/^http/, "ws");
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

const WS_BASE_URL = getWsBaseUrl();

class GameWebSocketService {
  private ws: WebSocket | null = null;
  private gameId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isIntentionalClose = false;

  // Event handlers
  private onMessageHandlers: MessageHandler[] = [];
  private onConnectHandlers: ConnectionHandler[] = [];
  private onDisconnectHandlers: ConnectionHandler[] = [];
  private onErrorHandlers: ErrorHandler[] = [];

  /**
   * Подключение к игре через WebSocket
   */
  connect(gameId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn("WebSocket already connected");
      return;
    }

    this.gameId = gameId;
    this.isIntentionalClose = false;
    const token = getCachedInitData();

    if (!token) {
      console.error("No auth token available");
      this.notifyError("No auth token available");
      return;
    }

    // Для WebSocket токен передаётся без Bearer
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const wsUrl = `${WS_BASE_URL}/ws/game/${gameId}?token=${encodeURIComponent(cleanToken)}`;
    console.log("Connecting to WebSocket:", wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.notifyError("Failed to create WebSocket connection");
    }
  }

  /**
   * Подключение к лобби для получения списка игр
   */
  connectToLobby(): void {
    const token = getCachedInitData();

    if (!token) {
      console.error("No auth token available");
      this.notifyError("No auth token available");
      return;
    }

    // Для WebSocket токен передаётся без Bearer
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const wsUrl = `${WS_BASE_URL}/ws/lobby?token=${encodeURIComponent(cleanToken)}`;
    console.log("Connecting to lobby WebSocket:", wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.notifyError("Failed to create WebSocket connection");
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;
      this.onConnectHandlers.forEach((handler) => handler());
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      this.onDisconnectHandlers.forEach((handler) => handler());

      // Notify error only for abnormal closures
      if (event.code === 1008) {
        // Policy Violation - auth error
        this.notifyError("Ошибка авторизации WebSocket");
      } else if (event.code !== 1000 && event.code !== 1001 && !this.isIntentionalClose) {
        // Abnormal closure
        this.notifyError(event.reason || `Соединение закрыто (код: ${event.code})`);
      }

      // Попытка переподключения если это не было намеренное закрытие
      if (!this.isIntentionalClose && this.gameId && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        setTimeout(() => {
          if (this.gameId) {
            this.connect(this.gameId);
          }
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onerror = () => {
      // WebSocket error event doesn't contain useful info
      // Real error details come in onclose
      console.error("WebSocket error event");
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSServerMessage;
        console.log("WebSocket message received:", message);
        this.onMessageHandlers.forEach((handler) => handler(message));
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
  }

  /**
   * Отправка хода
   */
  sendMove(move: string): void {
    this.send({ type: "move", move });
  }

  /**
   * Сдача в игре
   */
  sendResign(): void {
    this.send({ type: "resign" });
  }

  /**
   * Предложение ничьей
   */
  sendDrawOffer(): void {
    this.send({ type: "draw_offer" });
  }

  /**
   * Отправка сообщения в чат
   */
  sendChatMessage(message: string): void {
    this.send({ type: "chat_message", message });
  }

  /**
   * Пинг таймера
   */
  sendTimerPing(): void {
    this.send({ type: "timer_ping" });
  }

  private send(message: WSClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log("WebSocket message sent:", message);
    } else {
      console.error("WebSocket is not connected");
      this.notifyError("WebSocket is not connected");
    }
  }

  /**
   * Отключение от WebSocket
   */
  disconnect(): void {
    this.isIntentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.gameId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Проверка подключения
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Получение ID текущей игры
   */
  getGameId(): string | null {
    return this.gameId;
  }

  // Event subscription methods
  onMessage(handler: MessageHandler): () => void {
    this.onMessageHandlers.push(handler);
    return () => {
      this.onMessageHandlers = this.onMessageHandlers.filter((h) => h !== handler);
    };
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.onConnectHandlers.push(handler);
    return () => {
      this.onConnectHandlers = this.onConnectHandlers.filter((h) => h !== handler);
    };
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.onDisconnectHandlers.push(handler);
    return () => {
      this.onDisconnectHandlers = this.onDisconnectHandlers.filter((h) => h !== handler);
    };
  }

  onError(handler: ErrorHandler): () => void {
    this.onErrorHandlers.push(handler);
    return () => {
      this.onErrorHandlers = this.onErrorHandlers.filter((h) => h !== handler);
    };
  }

  private notifyError(error: Event | string): void {
    this.onErrorHandlers.forEach((handler) => handler(error));
  }

  // Clear all handlers
  clearHandlers(): void {
    this.onMessageHandlers = [];
    this.onConnectHandlers = [];
    this.onDisconnectHandlers = [];
    this.onErrorHandlers = [];
  }
}

// Export singleton instance
export const gameWebSocket = new GameWebSocketService();

// Export types for convenience
export type {
  WSGameStateMessage,
  WSMoveMadeMessage,
  WSGameOverMessage,
  WSErrorMessage,
};
