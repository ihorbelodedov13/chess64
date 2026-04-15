import React, { useState, useMemo } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import Button from "./Button";
import ChessPiece from "./ChessPiece";
import type { PieceType } from "./ChessPiece";
import { RefreshCw, LogOut } from "lucide-react";
import styles from "./LocalGame.module.scss";

interface LocalGameProps {
  onBackToMenu?: () => void;
}

const LocalGame: React.FC<LocalGameProps> = ({ onBackToMenu }) => {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string>("");

  const currentTurn = game.turn(); // "w" | "b"

  const availableMoves = useMemo(() => {
    if (!selectedSquare) return new Set<Square>();
    const moves = new Set<Square>();
    game.moves({ square: selectedSquare, verbose: true }).forEach((move) => {
      if (typeof move === "object" && "to" in move) moves.add(move.to as Square);
    });
    return moves;
  }, [selectedSquare, game]);

  const handleSquareClick = (square: Square) => {
    if (gameOver) return;

    const piece = game.get(square);
    const isAvailableMove = availableMoves.has(square);

    if (isAvailableMove && selectedSquare) {
      try {
        const move = game.move({ from: selectedSquare, to: square });
        if (move) {
          const next = new Chess(game.fen());
          setGame(next);
          setMoveHistory((prev) => [...prev, move.san]);
          setSelectedSquare(null);
          if (next.isGameOver()) {
            setGameOver(true);
            if (next.isCheckmate()) setGameResult("Шах и мат!");
            else if (next.isStalemate()) setGameResult("Пат!");
            else setGameResult("Ничья!");
          }
        }
      } catch { /* ignore invalid move */ }
      return;
    }

    if (selectedSquare === square) { setSelectedSquare(null); return; }
    if (piece && piece.color === currentTurn) { setSelectedSquare(square); return; }
    setSelectedSquare(null);
  };

  const resetGame = () => {
    setGame(new Chess());
    setSelectedSquare(null);
    setMoveHistory([]);
    setGameOver(false);
    setGameResult("");
  };

  const getStatusText = () => {
    if (gameOver) return gameResult;
    if (game.inCheck()) return `${currentTurn === "w" ? "Белые" : "Чёрные"} под шахом!`;
    return `Ход ${currentTurn === "w" ? "белых" : "чёрных"}`;
  };

  // Move history formatted as pairs
  const movePairs = useMemo(() => {
    const pairs: { n: number; w?: string; b?: string }[] = [];
    moveHistory.forEach((san, idx) => {
      if (idx % 2 === 0) pairs.push({ n: idx / 2 + 1, w: san });
      else if (pairs.length) pairs[pairs.length - 1].b = san;
    });
    return pairs;
  }, [moveHistory]);

  const renderBoard = () => {
    const board = [];
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const square = (files[f] + ranks[r]) as Square;
        const piece = game.get(square);
        const isLight = (f + r) % 2 === 0;
        const isSelected = selectedSquare === square;
        const isAvail = availableMoves.has(square);
        const isInCheck = piece?.type === "k" && game.inCheck() && piece.color === currentTurn;

        board.push(
          <div
            key={square}
            className={[
              styles.square,
              isLight ? styles.light : styles.dark,
              isSelected ? styles.selected : "",
              isAvail ? styles.availableMove : "",
              isInCheck ? styles.inCheck : "",
            ].join(" ")}
            onClick={() => handleSquareClick(square)}
          >
            {piece && (
              <div className={`${styles.piece} ${styles[piece.color]}`}>
                <ChessPiece type={piece.type as PieceType} color={piece.color} />
              </div>
            )}
            {isAvail && !piece && <div className={styles.moveIndicator} />}
            {isAvail && piece && <div className={styles.captureIndicator} />}
          </div>
        );
      }
    }
    return board;
  };

  return (
    <div className={styles.localGame}>
      {/* Header */}
      <div className={styles.gameHeader}>
        <div className={styles.statusSide}>
          <span
            className={styles.turnDot}
            style={{ background: gameOver ? "#6b7280" : currentTurn === "w" ? "#fff" : "#1a1110",
              boxShadow: gameOver ? "none" : currentTurn === "w"
                ? "0 0 6px rgba(255,255,255,.6)"
                : "0 0 6px rgba(239,78,5,.6)" }}
          />
          <span className={styles.gameStatus}>{getStatusText()}</span>
        </div>
        <div className={styles.playersBadge}>
          <span className={styles.playerW}>Белые</span>
          <span className={styles.playerSep}>vs</span>
          <span className={styles.playerB}>Чёрные</span>
        </div>
      </div>

      {/* Result banner */}
      {gameOver && (
        <div className={styles.resultBanner}>
          <span className={styles.resultTitle}>{gameResult}</span>
        </div>
      )}

      {/* Board */}
      <div className={styles.gameBoard}>
        <div className={styles.chessBoardContainer}>
          <div className={styles.boardWrapper}>
            <div className={styles.board}>{renderBoard()}</div>
            <div className={styles.fileLabels}>
              {["a","b","c","d","e","f","g","h"].map(f => (
                <span key={f} className={styles.label}>{f}</span>
              ))}
            </div>
          </div>

          {movePairs.length > 0 && (
            <div className={styles.moveHistory}>
              <div className={styles.movesList}>
                {movePairs.map((p) => (
                  <div key={p.n} className={styles.moveRow}>
                    <span className={styles.moveNumber}>{p.n}.</span>
                    <span className={styles.movePair}>
                      <span className={styles.moveWhite}>{p.w}</span>
                      {p.b
                        ? <span className={styles.moveBlack}>{p.b}</span>
                        : <span className={styles.movePlaceholder}>…</span>
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={styles.gameControls}>
        {gameOver && (
          <Button variant="primary" size="medium" onClick={resetGame}>
            <RefreshCw size={15} style={{ marginRight: 7 }} /> Новая игра
          </Button>
        )}
        {onBackToMenu && (
          <Button variant={gameOver ? "ghost" : "outline"} size="medium" onClick={onBackToMenu}>
            <LogOut size={15} style={{ marginRight: 7 }} /> Выйти
          </Button>
        )}
      </div>
    </div>
  );
};

export default LocalGame;
