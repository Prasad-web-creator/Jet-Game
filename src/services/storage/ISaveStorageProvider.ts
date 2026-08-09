export interface PlayerProfileData {
  id: string;
  name: string;
  callsign: string;
  level: number;
  xp: number;
  credits: number;
  totalKills: number;
  missionsCompleted: number;
  currentAircraftId: string;
  unlockedAircraftIds: string[];
}

export interface SettingsData {
  masterVolume: number; // 0.0 - 1.0
  musicVolume: number;  // 0.0 - 1.0
  sfxVolume: number;    // 0.0 - 1.0
  invertPitch: boolean;
  mouseSensitivity: number; // 0.1 - 2.0
  graphicsQuality: 'low' | 'medium' | 'high';
}

export interface PlayerSaveData {
  player: PlayerProfileData;
  upgrades: Record<string, Record<string, number>>; // aircraftId -> { statId -> level }
  settings: SettingsData;
  unlockedMissionIds: string[];
}

export interface ISaveStorageProvider {
  loadSaveData(): Promise<PlayerSaveData | null>;
  saveData(data: PlayerSaveData): Promise<boolean>;
  resetSaveData(): Promise<boolean>;
}
