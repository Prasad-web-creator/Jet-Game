import { useState, useEffect } from 'react';
import './MainMenu.css';
import { MissionSelectModal } from './MissionSelectModal';
import { AircraftSelectModal } from './AircraftSelectModal';
import { UpgradeScreenModal } from './UpgradeScreenModal';
import { ProfileModal } from './ProfileModal';
import { SettingsModal } from './SettingsModal';
import { saveGameService } from '../../services/storage/SaveGameService';
import type { PlayerSaveData } from '../../services/storage/ISaveStorageProvider';

import type { PlayerProfile } from '../../firebase/multiplayer/networkTypes';

interface MainMenuProps {
  onStartGame:    (missionId?: string) => void;
  onMultiplayer?: () => void;
  onSignOut?:     () => void;
  profile?:       PlayerProfile | null;
}

type MenuTab = 'none' | 'missions' | 'aircraft' | 'upgrades' | 'profile' | 'settings';

function MainMenu({ onStartGame, onMultiplayer, onSignOut, profile }: MainMenuProps) {
  const [activeTab, setActiveTab] = useState<MenuTab>('none');
  const [saveData, setSaveData] = useState<PlayerSaveData | null>(null);

  useEffect(() => {
    saveGameService.initialize().then((data) => setSaveData({ ...data }));
  }, []);

  return (
    <div id="main-menu" className="main-menu">
      <div className="menu-content">
        <h1 className="menu-title">
          <span className="title-accent">JET</span> STRIKE
        </h1>
        <p className="menu-subtitle">AIR SUPERIORITY</p>

        {(profile ?? saveData?.player) && (
          <div className="menu-player-bar">
            <span className="player-callsign">
              PILOT: {profile?.callsign ?? saveData?.player.callsign}
            </span>
            <span className="player-level">LVL {profile?.level ?? saveData?.player.level}</span>
            <span className="player-credits">
              💰 {(profile?.credits ?? saveData?.player.credits ?? 0).toLocaleString()} CREDITS
            </span>
            {onSignOut && (
              <button
                className="logout-mini-btn"
                style={{
                  background: 'rgba(255, 68, 68, 0.15)',
                  border: '1px solid rgba(255, 68, 68, 0.5)',
                  color: '#ff6666',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontFamily: 'inherit',
                  fontSize: 10,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginLeft: 8,
                }}
                onClick={onSignOut}
              >
                LOG OUT 🚪
              </button>
            )}
          </div>
        )}

        <nav className="menu-actions">
          <button
            className="menu-button menu-button-primary"
            onClick={() => onStartGame()}
          >
            PLAY (QUICK SORTIE)
          </button>

          <button
            className="menu-button"
            onClick={() => setActiveTab('missions')}
          >
            MISSIONS
          </button>

          {onMultiplayer && (
            <button
              id="btn-multiplayer"
              className="menu-button"
              style={{ borderColor: 'rgba(0,180,255,0.4)', color: '#00b4ff' }}
              onClick={onMultiplayer}
            >
              ⚡ MULTIPLAYER
            </button>
          )}

          <button
            className="menu-button"
            onClick={() => setActiveTab('aircraft')}
          >
            AIRCRAFT
          </button>

          <button
            className="menu-button"
            onClick={() => setActiveTab('upgrades')}
          >
            UPGRADES
          </button>

          <button
            className="menu-button"
            onClick={() => setActiveTab('profile')}
          >
            PROFILE
          </button>

          <button
            className="menu-button"
            onClick={() => setActiveTab('settings')}
          >
            SETTINGS
          </button>

          {onSignOut && (
            <button
              id="btn-logout"
              className="menu-button"
              style={{ borderColor: 'rgba(255, 68, 68, 0.4)', color: '#ff4444' }}
              onClick={onSignOut}
            >
              🚪 LOG OUT
            </button>
          )}
        </nav>

        <p className="menu-version">v0.1.0 — Combat & Progression Architecture</p>
      </div>

      {/* Modals */}
      {activeTab === 'missions' && (
        <MissionSelectModal
          onSelectMission={(missionId) => {
            setActiveTab('none');
            onStartGame(missionId);
          }}
          onClose={() => setActiveTab('none')}
        />
      )}

      {activeTab === 'aircraft' && (
        <AircraftSelectModal onClose={() => setActiveTab('none')} />
      )}

      {activeTab === 'upgrades' && (
        <UpgradeScreenModal onClose={() => setActiveTab('none')} />
      )}

      {activeTab === 'profile' && (
        <ProfileModal onClose={() => setActiveTab('none')} />
      )}

      {activeTab === 'settings' && (
        <SettingsModal onClose={() => setActiveTab('none')} />
      )}
    </div>
  );
}

export default MainMenu;
