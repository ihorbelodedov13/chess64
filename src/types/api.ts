// API Types based on OpenAPI schema

export type BotDifficulty = "easy" | "medium" | "hard";
export type PlayerColor = "white" | "black";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
}

export interface UserResponse {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  rating: number;
  games_played: number;
  last_online: string;
  online: boolean;
  wins: number;
  losses: number;
  draws: number;
  created_at: string;
  selected_frame: number;
}

export interface UserStats {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  last_online: string;
  online: boolean;
  selected_frame: number;
}

export interface TimeControl {
  base: number;
  increment: number;
}

export interface GameResponse {
  id: string;
  status: string;
  game_type: string;
  white_player_id: number | null;
  black_player_id: number | null;
  current_fen: string;
  time_control: TimeControl;
  created_at: string;
}

export interface JoinGameResponse {
  game_id: string;
  player_color: "white" | "black";
  status: string;
}

export interface ActiveGameResponse {
  game_id: string;
  player_color: "white" | "black";
  status: string;
  game_type: string;
}

export interface CreateBotGameRequest {
  difficulty?: BotDifficulty;
  time_control?: TimeControl;
}

export interface PublicUserResponse {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  online: boolean;
  selected_frame: number;
  friend_status: "friends" | "request_sent" | "request_received" | null;
}

export interface FriendRequest {
  id: number;
  from_user_id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  rating: number;
  online: boolean;
  selected_frame: number;
  created_at: string;
}

export interface GameHistoryEntry {
  game_id: string;
  opponent_id: number | null;
  opponent_name: string | null;
  opponent_photo?: string | null;
  player_color: "white" | "black";
  result: "win" | "loss" | "draw" | null;
  game_type: "human" | "bot";
  created_at: string;
  finished_at: string | null;
}

// Matchmaking types
export interface MatchmakingJoinResponse {
  status: "match_found" | "waiting";
  game_id?: string;
  opponent_id?: number;
  player_color?: "white" | "black";
}

export interface MatchmakingStatusResponse {
  status: "in_queue" | "not_in_queue";
  position?: number;
  total_in_queue?: number;
  game_id?: string;
  player_color?: "white" | "black";
}

// WebSocket Message Types - Client to Server
export interface WSMoveMessage {
  type: "move";
  move: string; // UCI format: e2e4, e7e8q (with promotion)
}

export interface WSResignMessage {
  type: "resign";
}

export interface WSDrawOfferMessage {
  type: "draw_offer";
}

export interface WSChatMessage {
  type: "chat_message";
  message: string;
}

export interface WSTimerPingMessage {
  type: "timer_ping";
}

export type WSClientMessage =
  | WSMoveMessage
  | WSResignMessage
  | WSDrawOfferMessage
  | WSChatMessage
  | WSTimerPingMessage;

// WebSocket Message Types - Server to Client
export interface MoveHistoryEntry {
  move: string;
  player_id: number | null;
  timestamp: string;
  fen_after: string;
  is_bot?: boolean;
}

export interface WSPlayerInfo {
  name: string;
  photo: string | null;
  rating: number;
  frame: number;
  is_bot: boolean;
}

export interface WSGameStateMessage {
  type: "game_state";
  game_id: string;
  fen: string;
  current_turn: "white" | "black";
  is_check: boolean;
  is_checkmate: boolean;
  is_stalemate: boolean;
  legal_moves: string[];
  time_white: number;
  time_black: number;
  move_history: Record<string, MoveHistoryEntry>;
  status: string;
  is_game_over: boolean;
  white_player?: WSPlayerInfo;
  black_player?: WSPlayerInfo;
}

export interface WSMoveMadeMessage {
  type: "move_made";
  game_id: string;
  fen: string;
  current_turn: "white" | "black";
  is_check: boolean;
  is_checkmate: boolean;
  is_stalemate: boolean;
  legal_moves: string[];
  time_white: number;
  time_black: number;
  move_history: Record<string, MoveHistoryEntry>;
  status: string;
  is_game_over: boolean;
}

export interface WSGameOverMessage {
  type: "game_over";
  result: "checkmate" | "stalemate" | "resignation" | "draw" | "insufficient_material";
  winner: "white" | "black" | null;
  rating_change_white?: number;
  rating_change_black?: number;
}

export interface WSErrorMessage {
  type: "error";
  message: string;
}

export interface WSOpponentConnectedMessage {
  type: "opponent_connected";
}

export interface WSOpponentDisconnectedMessage {
  type: "opponent_disconnected";
}

export interface WSDrawOfferReceivedMessage {
  type: "draw_offer";
  from_user: number;
}

export interface WSChatReceivedMessage {
  type: "chat_message";
  user_id: number;
  message: string;
}

export interface WSAvailableGamesMessage {
  type: "available_games";
  games: {
    id: string;
    white_player: string;
    time_control: TimeControl;
    created_at: string;
  }[];
}

export type WSServerMessage =
  | WSGameStateMessage
  | WSMoveMadeMessage
  | WSGameOverMessage
  | WSErrorMessage
  | WSOpponentConnectedMessage
  | WSOpponentDisconnectedMessage
  | WSDrawOfferReceivedMessage
  | WSChatReceivedMessage
  | WSAvailableGamesMessage;
