import { useState } from 'react';
import './UpgradeScreenModal.css';
import { UPGRADE_DEFINITIONS, UpgradeService } from '../../services/progression/UpgradeService';
import { saveGameService } from '../../services/storage/SaveGameService';
import { HANGAR_AIRCRAFT } from '../../game/aircraft/definitions/aircraftData';

interface UpgradeScreenModalProps {
  onClose: () => void;
}

export function UpgradeScreenModal({ onClose }: UpgradeScreenModalProps) {
  const [saveData, setSaveData] = useState(saveGameService.getData());
  const currentAircraftId = saveData.player.currentAircraftId;
  const currentAircraft = HANGAR_AIRCRAFT.find((a) => a.config.id === currentAircraftId) ?? HANGAR_AIRCRAFT[0];

  const handleUpgrade = async (statId: string) => {
    const ok = await UpgradeService.purchaseUpgrade(currentAircraftId, statId);
    if (ok) {
      setSaveData({ ...saveGameService.getData() });
    }
  };

  return (
    <div className="upgrade-overlay">
      <div className="upgrade-container">
        {/* Header */}
        <div className="upgrade-header">
          <div>
            <h2>TACTICAL AIRCRAFT UPGRADES</h2>
            <div className="upgrade-sub">SELECTED JET: {currentAircraft.config.name.toUpperCase()}</div>
          </div>
          <div className="upgrade-credits">💰 {saveData.player.credits.toLocaleString()} CREDITS</div>
          <button className="upgrade-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Upgrade Cards Grid */}
        <div className="upgrade-grid">
          {UPGRADE_DEFINITIONS.map((def) => {
            const currentLevel = UpgradeService.getStatLevel(currentAircraftId, def.id);
            const cost = UpgradeService.getUpgradeCost(def.id, currentLevel);
            const isMaxed = currentLevel >= def.maxLevel;
            const canAfford = saveData.player.credits >= cost;

            return (
              <div key={def.id} className="upgrade-card">
                <div className="card-header">
                  <span className="card-title">{def.name}</span>
                  <span className="card-level">LVL {currentLevel} / {def.maxLevel}</span>
                </div>
                <div className="card-desc">{def.description}</div>

                {/* Level Pips Bar */}
                <div className="card-pips">
                  {Array.from({ length: def.maxLevel }).map((_, idx) => (
                    <div key={idx} className={`pip ${idx < currentLevel ? 'pip--filled' : ''}`} />
                  ))}
                </div>

                {/* Upgrade Button */}
                <button
                  className="card-buy-btn"
                  disabled={isMaxed || !canAfford}
                  onClick={() => handleUpgrade(def.id)}
                >
                  {isMaxed ? 'MAX LEVEL' : `UPGRADE (💰 ${cost.toLocaleString()})`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
