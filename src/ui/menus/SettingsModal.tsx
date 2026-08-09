import { useState } from 'react';
import './SettingsModal.css';
import { saveGameService } from '../../services/storage/SaveGameService';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [saveData, setSaveData] = useState(saveGameService.getData());
  const settings = saveData.settings;

  const handleUpdateSetting = async <K extends keyof typeof settings>(key: K, val: (typeof settings)[K]) => {
    await saveGameService.updateData((data) => {
      data.settings[key] = val;
    });
    setSaveData({ ...saveGameService.getData() });
  };

  return (
    <div className="settings-overlay">
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          <h2>SYSTEM SETTINGS</h2>
          <button className="settings-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* Audio Controls */}
          <div className="setting-group">
            <h3>AUDIO SETTINGS</h3>
            <div className="setting-row">
              <label>MASTER VOLUME ({Math.round(settings.masterVolume * 100)}%)</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.masterVolume}
                onChange={(e) => handleUpdateSetting('masterVolume', parseFloat(e.target.value))}
              />
            </div>
            <div className="setting-row">
              <label>MUSIC VOLUME ({Math.round(settings.musicVolume * 100)}%)</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.musicVolume}
                onChange={(e) => handleUpdateSetting('musicVolume', parseFloat(e.target.value))}
              />
            </div>
            <div className="setting-row">
              <label>SFX VOLUME ({Math.round(settings.sfxVolume * 100)}%)</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.sfxVolume}
                onChange={(e) => handleUpdateSetting('sfxVolume', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Controls & Gameplay */}
          <div className="setting-group">
            <h3>FLIGHT CONTROLS</h3>
            <div className="setting-row">
              <label>INVERT PITCH AXIS</label>
              <button
                className={`toggle-btn ${settings.invertPitch ? 'toggle-btn--active' : ''}`}
                onClick={() => handleUpdateSetting('invertPitch', !settings.invertPitch)}
              >
                {settings.invertPitch ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
            <div className="setting-row">
              <label>MOUSE SENSITIVITY ({settings.mouseSensitivity.toFixed(1)}x)</label>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={settings.mouseSensitivity}
                onChange={(e) => handleUpdateSetting('mouseSensitivity', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Graphics Quality */}
          <div className="setting-group">
            <h3>GRAPHICS PRESET</h3>
            <div className="setting-row">
              <label>PRESET</label>
              <div className="segmented-control">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    className={`segment-btn ${settings.graphicsQuality === q ? 'segment-btn--active' : ''}`}
                    onClick={() => handleUpdateSetting('graphicsQuality', q)}
                  >
                    {q.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
