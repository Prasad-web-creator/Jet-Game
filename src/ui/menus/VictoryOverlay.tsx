import './VictoryOverlay.css';
import type { MissionRewards } from '../../types';

interface VictoryOverlayProps {
  missionName: string;
  rewards: MissionRewards;
  onNextMission: () => void;
}

export function VictoryOverlay({ missionName, rewards, onNextMission }: VictoryOverlayProps) {
  return (
    <div className="victory-overlay">
      <div className="victory-content">
        <h1 className="victory-title">MISSION ACCOMPLISHED!</h1>
        <h2 className="victory-mission-name">{missionName.toUpperCase()}</h2>
        
        <div className="victory-rewards-box">
          <div className="victory-reward-row">
            <span className="victory-label">SCORE REWARD:</span>
            <span className="victory-value">+{rewards.score.toLocaleString()} PTS</span>
          </div>
          {rewards.unlocks && rewards.unlocks.length > 0 && (
            <div className="victory-reward-row" style={{ marginTop: 8 }}>
              <span className="victory-label">UNLOCKED:</span>
              <span className="victory-value victory-value--unlock">NEW MISSION</span>
            </div>
          )}
        </div>

        <button className="victory-next-btn" onClick={onNextMission}>
          CONTINUE TO NEXT MISSION
        </button>
      </div>
    </div>
  );
}
