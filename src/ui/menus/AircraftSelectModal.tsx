import { useState } from 'react';
import './AircraftSelectModal.css';
import { HANGAR_AIRCRAFT } from '../../game/aircraft/definitions/aircraftData';
import type { HangarAircraftDefinition } from '../../game/aircraft/definitions/aircraftData';
import { saveGameService } from '../../services/storage/SaveGameService';
import { ProgressionService } from '../../services/progression/ProgressionService';

interface AircraftSelectModalProps {
  onClose: () => void;
}

export function AircraftSelectModal({ onClose }: AircraftSelectModalProps) {
  const [saveData, setSaveData] = useState(saveGameService.getData());
  const [selectedItem, setSelectedItem] = useState<HangarAircraftDefinition>(HANGAR_AIRCRAFT[0]);

  const isUnlocked = saveData.player.unlockedAircraftIds.includes(selectedItem.config.id);
  const isSelected = saveData.player.currentAircraftId === selectedItem.config.id;

  const handleUnlock = async () => {
    const ok = await ProgressionService.unlockAircraft(selectedItem.config.id);
    if (ok) {
      setSaveData({ ...saveGameService.getData() });
    }
  };

  const handleSelect = async () => {
    const ok = await ProgressionService.selectAircraft(selectedItem.config.id);
    if (ok) {
      setSaveData({ ...saveGameService.getData() });
    }
  };

  return (
    <div className="hangar-overlay">
      <div className="hangar-container">
        {/* Header */}
        <div className="hangar-header">
          <h2>AIRCRAFT HANGAR</h2>
          <div className="hangar-credits">💰 {saveData.player.credits.toLocaleString()} CREDITS</div>
          <button className="hangar-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="hangar-body">
          {/* Left Column: Aircraft List */}
          <div className="hangar-list">
            {HANGAR_AIRCRAFT.map((item) => {
              const unlocked = saveData.player.unlockedAircraftIds.includes(item.config.id);
              const active = saveData.player.currentAircraftId === item.config.id;
              const isCurrentSelected = selectedItem.config.id === item.config.id;

              return (
                <div
                  key={item.config.id}
                  className={`hangar-item ${isCurrentSelected ? 'hangar-item--active' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="hangar-item-title-row">
                    <span className="hangar-item-name">{item.config.name}</span>
                    {active && <span className="hangar-tag hangar-tag--equipped">EQUIPPED</span>}
                    {!unlocked && <span className="hangar-tag hangar-tag--locked">LOCKED</span>}
                  </div>
                  <div className="hangar-item-role">{item.role}</div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Aircraft Details & Specs */}
          <div className="hangar-details">
            <h3 className="hangar-title">{selectedItem.config.name.toUpperCase()}</h3>
            <p className="hangar-role-text">{selectedItem.role}</p>
            <p className="hangar-desc">{selectedItem.description}</p>

            {/* Spec Meters */}
            <div className="hangar-specs">
              <div className="spec-row">
                <span>MAX SPEED</span>
                <div className="spec-bar-track"><div className="spec-bar-fill" style={{ width: `${(selectedItem.config.maxSpeed / 500) * 100}%` }} /></div>
                <span>{selectedItem.config.maxSpeed} m/s</span>
              </div>
              <div className="spec-row">
                <span>ACCELERATION</span>
                <div className="spec-bar-track"><div className="spec-bar-fill" style={{ width: `${(selectedItem.config.acceleration / 70) * 100}%` }} /></div>
                <span>{selectedItem.config.acceleration} m/s²</span>
              </div>
              <div className="spec-row">
                <span>MANEUVERABILITY</span>
                <div className="spec-bar-track"><div className="spec-bar-fill" style={{ width: `${(selectedItem.config.turnRate / 2.0) * 100}%` }} /></div>
                <span>{selectedItem.config.turnRate} rad/s</span>
              </div>
              <div className="spec-row">
                <span>ARMOR HP</span>
                <div className="spec-bar-track"><div className="spec-bar-fill" style={{ width: `${(selectedItem.config.maxHealth / 200) * 100}%` }} /></div>
                <span>{selectedItem.config.maxHealth} HP</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="hangar-actions">
              {isUnlocked ? (
                <button
                  className="hangar-btn hangar-btn--equip"
                  disabled={isSelected}
                  onClick={handleSelect}
                >
                  {isSelected ? 'CURRENTLY EQUIPPED' : 'EQUIP AIRCRAFT'}
                </button>
              ) : (
                <button
                  className="hangar-btn hangar-btn--unlock"
                  disabled={saveData.player.credits < selectedItem.price}
                  onClick={handleUnlock}
                >
                  UNLOCK FOR 💰 {selectedItem.price.toLocaleString()} CREDITS
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
