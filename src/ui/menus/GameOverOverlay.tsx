import './GameOverOverlay.css';

interface GameOverOverlayProps {
  score: number;
  onRestart: () => void;
}

export function GameOverOverlay({ score, onRestart }: GameOverOverlayProps) {
  return (
    <div className="game-over-overlay">
      <div className="game-over-content">
        <h1 className="game-over-title">MISSION FAILED</h1>
        <div className="game-over-score">FINAL SCORE: {score.toLocaleString()}</div>
        <button className="game-over-restart-btn" onClick={onRestart}>
          RESTART MISSION
        </button>
      </div>
    </div>
  );
}
