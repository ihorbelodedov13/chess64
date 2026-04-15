import React, { useState, useMemo, useCallback } from "react";
import type { Square } from "chess.js";
import { useChessStore } from "../stores/useChessStore";
import ChessPiece from "./ChessPiece";
import type { PieceType } from "./ChessPiece";
import styles from "./ChessBoard.module.scss";

interface ChessBoardProps {
  onMove?: (from: string, to: string, promotion?: string) => boolean | void;
  disabled?: boolean;
  orientation?: "white" | "black";
  showMoveHistory?: boolean;
  myTurn?: boolean;
}

interface PromotionDialogProps {
  color: "w" | "b";
  onSelect: (piece: string) => void;
  onCancel: () => void;
}

interface AnimPiece {
  type: PieceType;
  color: "w" | "b";
  col: number;
  row: number;
  dx: number;
  dy: number;
  toSquare: Square;
  moveKey: string;
}

const PROMO_TYPES: PieceType[] = ["q", "r", "b", "n"];

const PromotionDialog: React.FC<PromotionDialogProps> = ({ color, onSelect, onCancel }) => (
  <div className={styles.promotionOverlay} onClick={onCancel}>
    <div className={styles.promotionDialog} onClick={(e) => e.stopPropagation()}>
      <h3>Выберите фигуру</h3>
      <div className={styles.promotionPieces}>
        {PROMO_TYPES.map((type) => (
          <button
            key={type}
            className={`${styles.promotionPiece} ${styles[color]}`}
            onClick={() => onSelect(type)}
          >
            <ChessPiece type={type} color={color} />
          </button>
        ))}
      </div>
    </div>
  </div>
);

function squareToColRow(sq: Square, orientation: "white" | "black") {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  if (orientation === "white") {
    return { col: file, row: 7 - rank };
  } else {
    return { col: 7 - file, row: rank };
  }
}

const ChessBoard: React.FC<ChessBoardProps> = ({
  onMove,
  disabled = false,
  orientation = "white",
  showMoveHistory = true,
  myTurn = false,
}) => {
  const { game, currentTurn, moveHistory } = useChessStore();
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [promotionMove, setPromotionMove] = useState<{ from: Square; to: Square } | null>(null);

  // Which move key has finished animating
  const [animDoneKey, setAnimDoneKey] = useState<string | null>(null);

  // Compute anim piece synchronously during render — no useEffect, no flicker
  const animPiece = useMemo<AnimPiece | null>(() => {
    if (moveHistory.length === 0) return null;
    const last = moveHistory[moveHistory.length - 1];
    if (!last?.move || last.move.length < 4) return null;

    const fromSq = last.move.slice(0, 2) as Square;
    const toSq = last.move.slice(2, 4) as Square;
    if (fromSq === toSq) return null;

    const piece = game.get(toSq);
    if (!piece) return null;

    const fromPos = squareToColRow(fromSq, orientation);
    const toPos = squareToColRow(toSq, orientation);

    return {
      type: piece.type as PieceType,
      color: piece.color,
      col: toPos.col,
      row: toPos.row,
      dx: fromPos.col - toPos.col,
      dy: fromPos.row - toPos.row,
      toSquare: toSq,
      moveKey: last.move,
    };
  }, [moveHistory, game, orientation]);

  const isAnimating = animPiece !== null && animPiece.moveKey !== animDoneKey;

  // Check if current player can move
  const canMove = !disabled;

  // Compute available moves for selected piece
  const availableMoves = useMemo(() => {
    if (!selectedSquare || !canMove) return new Set<Square>();

    const moves = new Set<Square>();
    const piece = game.get(selectedSquare);

    if (!piece) return moves;

    // Get all possible moves for the selected piece
    const allMoves = game.moves({ square: selectedSquare, verbose: true });

    allMoves.forEach((move) => {
      if (typeof move === "object" && "to" in move) {
        moves.add(move.to as Square);
      }
    });

    return moves;
  }, [selectedSquare, game, canMove]);

  // Check if move needs promotion
  const needsPromotion = useCallback((from: Square, to: Square): boolean => {
    const piece = game.get(from);
    if (!piece || piece.type !== "p") return false;
    
    const toRank = to[1];
    return (piece.color === "w" && toRank === "8") || (piece.color === "b" && toRank === "1");
  }, [game]);

  // Handle promotion selection
  const handlePromotionSelect = (piece: string) => {
    if (promotionMove) {
      onMove?.(promotionMove.from, promotionMove.to, piece);
      setPromotionMove(null);
      setSelectedSquare(null);
    }
  };

  // Handle promotion cancel
  const handlePromotionCancel = () => {
    setPromotionMove(null);
    setSelectedSquare(null);
  };

  const handleSquareClick = (square: Square) => {
    if (!canMove) return;

    const piece = game.get(square);
    const isSelected = selectedSquare === square;
    const isAvailableMove = availableMoves.has(square);

    // If clicked on available move - make move
    if (isAvailableMove && selectedSquare) {
      // Check for pawn promotion
      if (needsPromotion(selectedSquare, square)) {
        setPromotionMove({ from: selectedSquare, to: square });
        return;
      }

      onMove?.(selectedSquare, square);
      setSelectedSquare(null);
      return;
    }

    // If clicked on same piece - deselect
    if (isSelected) {
      setSelectedSquare(null);
      return;
    }

    // If clicked on own piece - select it
    if (piece) {
      const playerColor = currentTurn === "white" ? "w" : "b";
      if (piece.color === playerColor) {
        setSelectedSquare(square);
        return;
      }
    }

    // If clicked on empty square or opponent's piece without selection - deselect
    setSelectedSquare(null);
  };

  // Get last move for highlighting
  const lastMove = useMemo(() => {
    if (moveHistory.length === 0) return null;
    const last = moveHistory[moveHistory.length - 1];
    if (last && last.move) {
      return {
        from: last.move.slice(0, 2) as Square,
        to: last.move.slice(2, 4) as Square,
      };
    }
    return null;
  }, [moveHistory]);

  const renderBoard = () => {
    const board = [];
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks =
      orientation === "white"
        ? ["8", "7", "6", "5", "4", "3", "2", "1"]
        : ["1", "2", "3", "4", "5", "6", "7", "8"];

    const orderedFiles = orientation === "white" ? files : [...files].reverse();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = (orderedFiles[file] + ranks[rank]) as Square;
        const piece = game.get(square);
        const isLightSquare = (file + rank) % 2 === 0;
        const isSelected = selectedSquare === square;
        const isAvailableMove = availableMoves.has(square);
        const isLastMoveFrom = lastMove?.from === square;
        const isLastMoveTo = lastMove?.to === square;
        const isInCheck = piece?.type === "k" && game.inCheck() && 
          ((game.turn() === "w" && piece.color === "w") || (game.turn() === "b" && piece.color === "b"));

        // Hide piece at destination square while animating
        const isAnimTarget = isAnimating && animPiece?.toSquare === square;

        board.push(
          <div
            key={square}
            className={`
              ${styles.square} 
              ${isLightSquare ? styles.light : styles.dark}
              ${isSelected ? styles.selected : ""}
              ${isAvailableMove ? styles.availableMove : ""}
              ${isLastMoveFrom || isLastMoveTo ? styles.lastMove : ""}
              ${isInCheck ? styles.inCheck : ""}
              ${!canMove ? styles.disabled : ""}
            `}
            onClick={() => handleSquareClick(square)}
            data-square={square}
          >
            {piece && !isAnimTarget && (
              <div className={`${styles.piece} ${styles[piece.color]}`}>
                <ChessPiece type={piece.type as PieceType} color={piece.color} />
              </div>
            )}
            {isAvailableMove && !piece && (
              <div className={styles.moveIndicator}></div>
            )}
            {isAvailableMove && piece && (
              <div className={styles.captureIndicator}></div>
            )}
          </div>
        );
      }
    }

    return board;
  };

  // Format move history for display
  const formattedMoveHistory = useMemo(() => {
    const moves: { number: number; white?: string; black?: string }[] = [];
    
    moveHistory.forEach((entry, index) => {
      const moveNumber = Math.floor(index / 2) + 1;
      const isWhiteMove = index % 2 === 0;
      
      if (isWhiteMove) {
        moves.push({ number: moveNumber, white: entry.move });
      } else if (moves.length > 0) {
        moves[moves.length - 1].black = entry.move;
      }
    });
    
    return moves;
  }, [moveHistory]);

  return (
    <div className={styles.chessBoardContainer}>
      <div className={`${styles.boardWrapper}${myTurn ? ` ${styles.boardMyTurn}` : ""}`}>
        <div className={styles.board}>
          {renderBoard()}

          {/* Animating piece overlay — CSS keyframe, no flicker */}
          {isAnimating && animPiece && (
            <div
              key={animPiece.moveKey}
              className={styles.animPieceWrapper}
              style={{
                left: `${animPiece.col * 12.5}%`,
                top: `${animPiece.row * 12.5}%`,
                "--anim-dx": `${animPiece.dx * 100}%`,
                "--anim-dy": `${animPiece.dy * 100}%`,
              } as React.CSSProperties}
              onAnimationEnd={() => setAnimDoneKey(animPiece.moveKey)}
            >
              <div className={`${styles.piece} ${styles[animPiece.color]}`}>
                <ChessPiece type={animPiece.type} color={animPiece.color} />
              </div>
            </div>
          )}
        </div>
        
        {/* File labels */}
        <div className={styles.fileLabels}>
          {(orientation === "white" 
            ? ["a", "b", "c", "d", "e", "f", "g", "h"]
            : ["h", "g", "f", "e", "d", "c", "b", "a"]
          ).map((file) => (
            <span key={file} className={styles.label}>{file}</span>
          ))}
        </div>
      </div>

      {/* Rank labels */}
      <div className={styles.rankLabels}>
        {(orientation === "white"
          ? ["8", "7", "6", "5", "4", "3", "2", "1"]
          : ["1", "2", "3", "4", "5", "6", "7", "8"]
        ).map((rank) => (
          <span key={rank} className={styles.label}>{rank}</span>
        ))}
      </div>

      {showMoveHistory && (
        <div className={styles.moveHistory}>
          <div className={styles.movesList}>
            {formattedMoveHistory.map((move) => (
              <div key={move.number} className={styles.moveRow}>
                <span className={styles.moveNumber}>{move.number}.</span>
                <span className={styles.movePair}>
                  <span className={styles.moveWhite}>{move.white || "…"}</span>
                  {move.black
                    ? <span className={styles.moveBlack}>{move.black}</span>
                    : <span className={styles.movePlaceholder}>…</span>
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promotion dialog */}
      {promotionMove && (
        <PromotionDialog
          color={currentTurn === "white" ? "w" : "b"}
          onSelect={handlePromotionSelect}
          onCancel={handlePromotionCancel}
        />
      )}
    </div>
  );
};

export default ChessBoard;

