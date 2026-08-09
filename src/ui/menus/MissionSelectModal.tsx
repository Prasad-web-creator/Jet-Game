import { useState } from 'react';
import './MissionSelectModal.css';
import { MISSION_DEFINITIONS } from '../../game/missions/definitions/missionData';
import type { MissionDefinition } from '../../game/missions/types';

interface MissionSelectModalProps {
  onSelectMission: (missionId: string) => void;
  onClose: () => void;
}

export function MissionSelectModal({ onSelectMission, onClose }: MissionSelectModalProps) {
  const [selectedDef, setSelectedDef] = useState<MissionDefinition>(MISSION_DEFINITIONS[0]);

  return (
    <div className="mission-select-overlay">
      <div className="mission-select-container">
        {/* Header */}
        <div className="mission-select-header">
          <h2>TACTICAL MISSION SELECT</h2>
          <button className="mission-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="mission-select-body">
          {/* Left Column: Mission List */}
          <div className="mission-list">
            {MISSION_DEFINITIONS.map((def) => {
              const m = def.mission;
              const isSelected = selectedDef.mission.id === m.id;
              const isLocked = m.status === 'locked';

              return (
                <div
                  key={m.id}
                  className={`mission-item ${isSelected ? 'mission-item--selected' : ''} ${isLocked ? 'mission-item--locked' : ''}`}
                  onClick={() => !isLocked && setSelectedDef(def)}
                >
                  <div className="mission-item-header">
                    <span className="mission-item-title">{m.name}</span>
                    <span className={`mission-status-tag mission-status-tag--${m.status}`}>
                      {m.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="mission-item-desc">{m.description}</div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Mission Briefing & Launch */}
          <div className="mission-briefing-panel">
            <h3 className="briefing-title">{selectedDef.mission.name.toUpperCase()}</h3>
            <p className="briefing-text">{selectedDef.mission.briefing}</p>

            <div className="briefing-section">
              <h4>PRIMARY OBJECTIVES</h4>
              <ul className="briefing-obj-list">
                {selectedDef.mission.objectives.map((obj) => (
                  <li key={obj.id}>
                    <span className="obj-bullet">◇</span> {obj.description}
                  </li>
                ))}
              </ul>
            </div>

            <div className="briefing-section">
              <h4>REWARDS</h4>
              <div className="briefing-reward-tag">
                🏆 +{selectedDef.mission.rewards.score.toLocaleString()} PTS
              </div>
            </div>

            <button
              className="mission-launch-btn"
              disabled={selectedDef.mission.status === 'locked'}
              onClick={() => onSelectMission(selectedDef.mission.id)}
            >
              {selectedDef.mission.status === 'locked' ? 'MISSION LOCKED' : 'LAUNCH MISSION'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
