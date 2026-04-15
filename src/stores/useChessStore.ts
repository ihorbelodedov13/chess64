import { create } from "zustand";
import { Chess } from "chess.js";
import type {
  WSGameStateMessage,
  WSMoveMadeMessage,
  WSGameOverMessage,
  WSPlayerInfo,
  MoveHistoryEntry,
} from "../types/api";

export type GameStatus = "idle" | "connecting" | "waiting" | "playing" | "finished" | "error";
export type GameResult = "win" | "loss" | "draw" | null;
export type PlayerColor = "white" | "black" | null;

export interface ChatMessage {
  userId: number;
  message: string;
  timestamp: Date;
  isOwn: boolean;
}

export interface GameState {
  // Chess game instance
  game: Chess;
  
  // Game info
  gameId: string | null;
  playerColor: PlayerColor;
  currentTurn: PlayerColor;
  
  // Game status
  gameStatus: GameStatus;
  gameResult: GameResult;
  gameResultReason: string | null;
  
  // Game state flags
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isGameOver: boolean;
  
  // Legal moves (UCI format)
  legalMoves: string[];
  
  // Time control
  timeWhite: number;
  timeBlack: number;
  
  // Move history
  moveHistory: MoveHistoryEntry[];
  
  // Chat
  chatMessages: ChatMessage[];
  
  // Connection
  isConnected: boolean;
  
  // Opponent info
  opponentConnected: boolean;
  whitePlayerInfo: WSPlayerInfo | null;
  blackPlayerInfo: WSPlayerInfo | null;
  
  // Draw offer
  drawOfferReceived: boolean;
  drawOfferFrom: number | null;
  
  // Rating changes
  ratingChangeWhite: number | null;
  ratingChangeBlack: number | null;
  
  // Error
  error: string | null;
}

interface ChessActions {
  // Game initialization
  initializeGame: (gameId: string, playerColor: PlayerColor) => void;
  resetGame: () => void;
  
  // Game state updates from WebSocket
  handleGameState: (state: WSGameStateMessage) => void;
  handleMoveMade: (state: WSMoveMadeMessage) => void;
  handleGameOver: (state: WSGameOverMessage) => void;
  handleError: (message: string) => void;
  
  // Local move validation
  isValidMove: (from: string, to: string) => boolean;
  makeLocalMove: (from: string, to: string, promotion?: string) => boolean;
  
  // Status updates
  setGameStatus: (status: GameStatus) => void;
  setConnected: (connected: boolean) => void;
  setOpponentConnected: (connected: boolean) => void;
  
  // Draw offer
  setDrawOfferReceived: (received: boolean, fromUser?: number) => void;
  
  // Chat
  addChatMessage: (userId: number, message: string, isOwn: boolean) => void;
  
  // Computed
  isMyTurn: () => boolean;
}

const initialState: GameState = {
  game: new Chess(),
  gameId: null,
  playerColor: null,
  currentTurn: "white",
  gameStatus: "idle",
  gameResult: null,
  gameResultReason: null,
  isCheck: false,
  isCheckmate: false,
  isStalemate: false,
  isGameOver: false,
  legalMoves: [],
  timeWhite: 600,
  timeBlack: 600,
  moveHistory: [],
  chatMessages: [],
  isConnected: false,
  opponentConnected: false,
  whitePlayerInfo: null,
  blackPlayerInfo: null,
  drawOfferReceived: false,
  drawOfferFrom: null,
  ratingChangeWhite: null,
  ratingChangeBlack: null,
  error: null,
};

export const useChessStore = create<GameState & ChessActions>((set, get) => ({
  ...initialState,

  initializeGame: (gameId, playerColor) => {
    set({
      ...initialState,
      game: new Chess(),
      gameId,
      playerColor,
      gameStatus: "connecting",
    });
  },

  resetGame: () => {
    set({
      ...initialState,
      game: new Chess(),
    });
  },

  handleGameState: (state) => {
    const newGame = new Chess(state.fen);
    const moveHistoryArray = Object.entries(state.move_history)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([, entry]) => entry);

    set({
      game: newGame,
      gameId: state.game_id,
      currentTurn: state.current_turn,
      isCheck: state.is_check,
      isCheckmate: state.is_checkmate,
      isStalemate: state.is_stalemate,
      isGameOver: state.is_game_over,
      legalMoves: state.legal_moves,
      timeWhite: state.time_white,
      timeBlack: state.time_black,
      moveHistory: moveHistoryArray,
      gameStatus: state.is_game_over ? "finished" : "playing",
      error: null,
      ...(state.white_player !== undefined ? { whitePlayerInfo: state.white_player } : {}),
      ...(state.black_player !== undefined ? { blackPlayerInfo: state.black_player } : {}),
    });
  },

  handleMoveMade: (state) => {
    const newGame = new Chess(state.fen);
    const moveHistoryArray = Object.entries(state.move_history)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([, entry]) => entry);

    set({
      game: newGame,
      currentTurn: state.current_turn,
      isCheck: state.is_check,
      isCheckmate: state.is_checkmate,
      isStalemate: state.is_stalemate,
      isGameOver: state.is_game_over,
      legalMoves: state.legal_moves,
      timeWhite: state.time_white,
      timeBlack: state.time_black,
      moveHistory: moveHistoryArray,
      gameStatus: state.is_game_over ? "finished" : "playing",
      error: null,
    });
  },

  handleGameOver: (state) => {
    const { playerColor } = get();
    let gameResult: GameResult = null;

    if (state.winner === null) {
      gameResult = "draw";
    } else if (state.winner === playerColor) {
      gameResult = "win";
    } else {
      gameResult = "loss";
    }

    set({
      gameStatus: "finished",
      gameResult,
      gameResultReason: state.result,
      isGameOver: true,
      ratingChangeWhite: state.rating_change_white ?? null,
      ratingChangeBlack: state.rating_change_black ?? null,
    });
  },

  handleError: (message) => {
    set({
      error: message,
    });
  },

  isValidMove: (from, to) => {
    const { legalMoves } = get();
    const move = `${from}${to}`;
    // Check with and without promotion
    return legalMoves.some(m => m.startsWith(move));
  },

  makeLocalMove: (from, to, promotion) => {
    const { game, legalMoves } = get();
    
    // Check if move is in legal moves list
    const moveStr = promotion ? `${from}${to}${promotion}` : `${from}${to}`;
    if (!legalMoves.includes(moveStr) && !legalMoves.some(m => m.startsWith(`${from}${to}`))) {
      return false;
    }

    try {
      const result = game.move({ from, to, promotion });
      if (result) {
        set({
          game: new Chess(game.fen()),
        });
        return true;
      }
    } catch (error) {
      console.error("Invalid move:", error);
    }
    return false;
  },

  setGameStatus: (status) => {
    set({ gameStatus: status });
  },

  setConnected: (connected) => {
    set({ 
      isConnected: connected,
      gameStatus: connected ? get().gameStatus : "error",
    });
  },

  setOpponentConnected: (connected) => {
    set({ opponentConnected: connected });
  },

  setDrawOfferReceived: (received, fromUser) => {
    set({
      drawOfferReceived: received,
      drawOfferFrom: fromUser ?? null,
    });
  },

  addChatMessage: (userId, message, isOwn) => {
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          userId,
          message,
          timestamp: new Date(),
          isOwn,
        },
      ],
    }));
  },

  isMyTurn: () => {
    const { playerColor, currentTurn } = get();
    return playerColor === currentTurn;
  },
}));
