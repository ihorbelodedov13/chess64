// API Types based on OpenAPI schema

export type BotDifficulty = "easy" | "medium" | "hard";

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
}

export interface UserStats {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  rating: number;
  games_played: number;
  last_online: string;
  online: boolean;
}

export interface TimeControl {
  base: number;
  increment: number;
}

export interface GameResponse {
  id: number;
  status: string;
  game_type: string;
  white_player_id: number | null;
  black_player_id: number | null;
  current_fen: string;
  time_control: TimeControl;
  created_at: string;
}

export interface JoinGameResponse {
  game_id: number;
  player_color: string;
  status: string;
}

export interface CreateBotGameRequest {
  difficulty?: BotDifficulty;
  time_control?: TimeControl;
}

// WebSocket Message Types
export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export interface WSMoveMessage extends WSMessage {
  type: "move";
  move: string;
}

export interface WSResignMessage extends WSMessage {
  type: "resign";
}

export interface WSChatMessage extends WSMessage {
  type: "chat_message";
  message: string;
}

export interface WSMoveMadeMessage extends WSMessage {
  type: "move_made";
  move: string;
  fen: string;
}

export interface WSGameOverMessage extends WSMessage {
  type: "game_over";
  result: string;
}

export interface WSErrorMessage extends WSMessage {
  type: "error";
  code: string;
  message?: string;
}

export type WSClientMessage = WSMoveMessage | WSResignMessage | WSChatMessage;
export type WSServerMessage =
  | WSMoveMadeMessage
  | WSGameOverMessage
  | WSErrorMessage;
