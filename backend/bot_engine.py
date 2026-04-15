"""
Chess bot engine.

Uses Stockfish 18 via python-chess async UCI when available.
Falls back to a minimax engine if the binary is missing.

Difficulty  Stockfish Skill Level  Move time
easy        3                      0.05 s   (~1400 ELO)
medium      10                     0.1  s   (~2000 ELO)
hard        20                     0.5  s   (~3500 ELO)
"""
from __future__ import annotations

import asyncio
import os
import random
from pathlib import Path

import chess
import chess.engine

# ── Stockfish binary path ────────────────────────────────────────────────────

_HERE = Path(__file__).parent
_STOCKFISH_CANDIDATES = [
    _HERE / "stockfish" / "stockfish-macos-x86-64-avx2",
    _HERE / "stockfish" / "stockfish",
    Path("/usr/local/bin/stockfish"),
    Path("/usr/bin/stockfish"),
    Path("/opt/homebrew/bin/stockfish"),
]

def _find_stockfish() -> Path | None:
    for p in _STOCKFISH_CANDIDATES:
        if p.exists() and os.access(p, os.X_OK):
            return p
    return None

_STOCKFISH_PATH = _find_stockfish()

# ── Difficulty config ────────────────────────────────────────────────────────

_DIFFICULTY_CONFIG = {
    "easy":   {"skill": 3,  "time": 0.05},
    "medium": {"skill": 10, "time": 0.10},
    "hard":   {"skill": 20, "time": 0.50},
}

# ── Stockfish async engine ───────────────────────────────────────────────────

_engine: chess.engine.UciProtocol | None = None
_engine_lock = asyncio.Lock()


async def _get_engine() -> chess.engine.UciProtocol | None:
    global _engine
    if _STOCKFISH_PATH is None:
        return None
    async with _engine_lock:
        if _engine is None:
            try:
                _, _engine = await chess.engine.popen_uci(str(_STOCKFISH_PATH))
            except Exception:
                _engine = None
    return _engine


async def get_bot_move_async(board: chess.Board, difficulty: str = "medium") -> chess.Move | None:
    """Return the best move using Stockfish (or minimax fallback)."""
    legal = list(board.legal_moves)
    if not legal:
        return None

    engine = await _get_engine()
    if engine is not None:
        cfg = _DIFFICULTY_CONFIG.get(difficulty, _DIFFICULTY_CONFIG["medium"])
        try:
            await engine.configure({"Skill Level": cfg["skill"]})
            result = await engine.play(
                board,
                chess.engine.Limit(time=cfg["time"]),
            )
            return result.move
        except Exception:
            pass  # fall through to minimax

    # Fallback: synchronous minimax (run in thread to avoid blocking event loop)
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_bot_move, board, difficulty)


# ── Legacy sync minimax (fallback) ──────────────────────────────────────────

PIECE_VALUES = {
    chess.PAWN: 100, chess.KNIGHT: 320, chess.BISHOP: 330,
    chess.ROOK: 500, chess.QUEEN: 900, chess.KING: 20000,
}

PAWN_TABLE = [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
]
KNIGHT_TABLE = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
]
BISHOP_TABLE = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
]
ROOK_TABLE = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
]
QUEEN_TABLE = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
]
KING_TABLE = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
]
PIECE_TABLES = {
    chess.PAWN: PAWN_TABLE, chess.KNIGHT: KNIGHT_TABLE,
    chess.BISHOP: BISHOP_TABLE, chess.ROOK: ROOK_TABLE,
    chess.QUEEN: QUEEN_TABLE, chess.KING: KING_TABLE,
}


def _psv(piece_type: int, square: int, color: chess.Color) -> int:
    table = PIECE_TABLES.get(piece_type, [0] * 64)
    idx = square if color == chess.WHITE else (7 - square // 8) * 8 + square % 8
    return table[idx]


def _evaluate(board: chess.Board) -> int:
    if board.is_checkmate():
        return -20000 if board.turn == chess.WHITE else 20000
    if board.is_stalemate() or board.is_insufficient_material():
        return 0
    score = 0
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p:
            v = PIECE_VALUES[p.piece_type] + _psv(p.piece_type, sq, p.color)
            score += v if p.color == chess.WHITE else -v
    return score


def _minimax(board: chess.Board, depth: int, alpha: int, beta: int, maximising: bool) -> int:
    if depth == 0 or board.is_game_over():
        return _evaluate(board)
    if maximising:
        best = -99999
        for m in board.legal_moves:
            board.push(m)
            best = max(best, _minimax(board, depth - 1, alpha, beta, False))
            board.pop()
            alpha = max(alpha, best)
            if beta <= alpha:
                break
        return best
    else:
        best = 99999
        for m in board.legal_moves:
            board.push(m)
            best = min(best, _minimax(board, depth - 1, alpha, beta, True))
            board.pop()
            beta = min(beta, best)
            if beta <= alpha:
                break
        return best


def get_bot_move(board: chess.Board, difficulty: str = "medium") -> chess.Move | None:
    """Synchronous minimax fallback."""
    legal = list(board.legal_moves)
    if not legal:
        return None
    if difficulty == "easy":
        return random.choice(legal)

    depth = 2 if difficulty == "medium" else 3
    maximising = board.turn == chess.WHITE
    random.shuffle(legal)
    best_move, best_val = None, (-99999 if maximising else 99999)

    for m in legal:
        board.push(m)
        val = _minimax(board, depth - 1, -99999, 99999, not maximising)
        board.pop()
        if (maximising and val > best_val) or (not maximising and val < best_val):
            best_val, best_move = val, m

    return best_move or random.choice(legal)
