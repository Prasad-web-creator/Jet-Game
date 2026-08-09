import type { ISaveStorageProvider, PlayerSaveData } from './ISaveStorageProvider';

const SAVE_KEY = 'jetstrike_player_save_v1';

export class LocalStorageSaveProvider implements ISaveStorageProvider {
  async loadSaveData(): Promise<PlayerSaveData | null> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      const json = window.localStorage.getItem(SAVE_KEY);
      if (!json) return null;
      return JSON.parse(json) as PlayerSaveData;
    } catch (err) {
      console.error('[LocalStorageSaveProvider] Failed to load save data:', err);
      return null;
    }
  }

  async saveData(data: PlayerSaveData): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const json = JSON.stringify(data);
      window.localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch (err) {
      console.error('[LocalStorageSaveProvider] Failed to persist save data:', err);
      return false;
    }
  }

  async resetSaveData(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(SAVE_KEY);
      }
      return true;
    } catch (err) {
      console.error('[LocalStorageSaveProvider] Failed to reset save data:', err);
      return false;
    }
  }
}
