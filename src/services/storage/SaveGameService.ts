import type { ISaveStorageProvider, PlayerSaveData } from './ISaveStorageProvider';
import { LocalStorageSaveProvider } from './LocalStorageSaveProvider';

const DEFAULT_SAVE_DATA: PlayerSaveData = {
  player: {
    id: 'player_01',
    name: 'Maverick',
    callsign: 'PHOENIX-1',
    level: 1,
    xp: 0,
    credits: 1500,
    totalKills: 0,
    missionsCompleted: 0,
    currentAircraftId: 'f16_player',
    unlockedAircraftIds: ['f16_player'],
  },
  upgrades: {
    f16_player: {
      speed: 0,
      acceleration: 0,
      armor: 0,
      handling: 0,
      missileCapacity: 0,
      missileDamage: 0,
      gunDamage: 0,
      lockSpeed: 0,
      boostCapacity: 0,
    },
  },
  settings: {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    invertPitch: false,
    mouseSensitivity: 1.0,
    graphicsQuality: 'high',
  },
  unlockedMissionIds: ['m1_training'],
};

export class SaveGameService {
  private static instance: SaveGameService;
  private provider: ISaveStorageProvider;
  private cachedData: PlayerSaveData;

  private constructor(provider?: ISaveStorageProvider) {
    this.provider = provider ?? new LocalStorageSaveProvider();
    this.cachedData = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  }

  static getInstance(): SaveGameService {
    if (!SaveGameService.instance) {
      SaveGameService.instance = new SaveGameService();
    }
    return SaveGameService.instance;
  }

  setStorageProvider(provider: ISaveStorageProvider): void {
    this.provider = provider;
  }

  async initialize(): Promise<PlayerSaveData> {
    const loaded = await this.provider.loadSaveData();
    if (loaded) {
      /**
       * BUG-11 FIX: Deep-merge so new fields added to DEFAULT_SAVE_DATA
       * are present even in older saves that predate them.
       * Simple spread { ...DEFAULT, ...loaded } would lose nested defaults.
       */
      this.cachedData = {
        player:             { ...DEFAULT_SAVE_DATA.player,   ...loaded.player },
        upgrades:           { ...DEFAULT_SAVE_DATA.upgrades, ...loaded.upgrades },
        settings:           { ...DEFAULT_SAVE_DATA.settings, ...loaded.settings },
        unlockedMissionIds: loaded.unlockedMissionIds ?? [...DEFAULT_SAVE_DATA.unlockedMissionIds],
      };
    } else {
      this.cachedData = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
      await this.provider.saveData(this.cachedData);
    }
    return this.cachedData;
  }

  getData(): PlayerSaveData {
    return this.cachedData;
  }

  async updateData(updater: (data: PlayerSaveData) => void): Promise<PlayerSaveData> {
    updater(this.cachedData);
    await this.provider.saveData(this.cachedData);
    return this.cachedData;
  }

  async resetSave(): Promise<PlayerSaveData> {
    await this.provider.resetSaveData();
    this.cachedData = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    await this.provider.saveData(this.cachedData);
    return this.cachedData;
  }
}

export const saveGameService = SaveGameService.getInstance();
