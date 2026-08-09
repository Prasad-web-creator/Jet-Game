import { useState } from 'react';
import './ProfileModal.css';
import { saveGameService } from '../../services/storage/SaveGameService';
import { ProgressionService } from '../../services/progression/ProgressionService';

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const [saveData, setSaveData] = useState(saveGameService.getData());
  const player = saveData.player;

  const xpNext = ProgressionService.getXpForNextLevel(player.level);
  const xpPct = Math.min(100, Math.round((player.xp / xpNext) * 100));

  const handleUpdateCallsign = async (newCallsign: string) => {
    if (!newCallsign.trim()) return;
    await saveGameService.updateData((data) => {
      data.player.callsign = newCallsign.trim().toUpperCase();
    });
    setSaveData({ ...saveGameService.getData() });
  };

  return (
    <div className="profile-overlay">
      <div className="profile-container">
        {/* Header */}
        <div className="profile-header">
          <h2>PILOT DOSSIER & PROFILE</h2>
          <button className="profile-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="profile-body">
          {/* Top Rank Badge & Level */}
          <div className="profile-rank-box">
            <div className="rank-badge">LVL {player.level}</div>
            <div className="rank-info">
              <div className="callsign-display">
                <span>{player.callsign}</span>
                <button
                  className="edit-callsign-btn"
                  onClick={() => {
                    const input = prompt('Enter new Callsign:', player.callsign);
                    if (input) handleUpdateCallsign(input);
                  }}
                >
                  ✎ EDIT
                </button>
              </div>
              <div className="xp-progress-section">
                <div className="xp-text-row">
                  <span>EXPERIENCE (XP)</span>
                  <span>{player.xp} / {xpNext} XP ({xpPct}%)</span>
                </div>
                <div className="xp-bar-track">
                  <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="profile-stats-grid">
            <div className="stat-card">
              <span className="stat-label">CREDITS BALANCE</span>
              <span className="stat-val stat-val--gold">💰 {player.credits.toLocaleString()}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">AIR COMBAT KILLS</span>
              <span className="stat-val">{player.totalKills} HOSTILES</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">MISSIONS COMPLETED</span>
              <span className="stat-val">{player.missionsCompleted} MISSIONS</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">UNLOCKED JETS</span>
              <span className="stat-val">{player.unlockedAircraftIds.length} AIRCRAFT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
