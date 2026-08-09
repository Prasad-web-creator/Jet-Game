import { useState } from 'react';
import './PauseOverlay.css';
import { SettingsModal } from './SettingsModal';

interface PauseOverlayProps {
  onResume: () => void;
  onRestart: () => void;
  onExitToMenu: () => void;
}

export function PauseOverlay({ onResume, onRestart, onExitToMenu }: PauseOverlayProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="pause-overlay">
      <div className="pause-container">
        <h2 className="pause-title">GAME PAUSED</h2>

        <div className="pause-menu-actions">
          <button className="pause-btn pause-btn--primary" onClick={onResume}>
            RESUME FLIGHT
          </button>
          <button className="pause-btn" onClick={onRestart}>
            RESTART MISSION
          </button>
          <button className="pause-btn" onClick={() => setShowSettings(true)}>
            SETTINGS
          </button>
          <button className="pause-btn pause-btn--danger" onClick={onExitToMenu}>
            ABORT MISSION & EXIT
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
