import { saveGameService } from '../storage/SaveGameService';
import { HANGAR_AIRCRAFT } from '../../game/aircraft/definitions/aircraftData';

export class ProgressionService {
  /** Calculate XP required for next level */
  static getXpForNextLevel(level: number): number {
    return level * 1000;
  }

  /** Award XP to player profile and handle level ups */
  static async addXp(amount: number): Promise<{ newLevel: number; leveledUp: boolean }> {
    let leveledUp = false;
    let newLevel = 1;

    await saveGameService.updateData((data) => {
      data.player.xp += amount;
      let req = ProgressionService.getXpForNextLevel(data.player.level);

      while (data.player.xp >= req) {
        data.player.xp -= req;
        data.player.level += 1;
        leveledUp = true;
        req = ProgressionService.getXpForNextLevel(data.player.level);
        console.log(`[ProgressionService] ⭐ LEVEL UP! Reached Level ${data.player.level}`);
      }

      newLevel = data.player.level;
    });

    return { newLevel, leveledUp };
  }

  /** Award credits to player profile */
  static async addCredits(amount: number): Promise<number> {
    let total = 0;
    await saveGameService.updateData((data) => {
      data.player.credits += amount;
      total = data.player.credits;
    });
    return total;
  }

  /** Unlock aircraft if player level & credit requirements are satisfied */
  static async unlockAircraft(aircraftId: string): Promise<boolean> {
    const item = HANGAR_AIRCRAFT.find((a) => a.config.id === aircraftId);
    if (!item) return false;

    const saveData = saveGameService.getData();
    if (saveData.player.unlockedAircraftIds.includes(aircraftId)) {
      return true; // Already unlocked
    }

    if (saveData.player.credits < item.price) {
      console.warn(`[ProgressionService] Cannot unlock ${item.config.name}: Insufficient credits.`);
      return false;
    }

    await saveGameService.updateData((data) => {
      data.player.credits -= item.price;
      data.player.unlockedAircraftIds.push(aircraftId);
    });

    console.log(`[ProgressionService] ✈ UNLOCKED AIRCRAFT: ${item.config.name}`);
    return true;
  }

  /** Set active aircraft */
  static async selectAircraft(aircraftId: string): Promise<boolean> {
    const saveData = saveGameService.getData();
    if (!saveData.player.unlockedAircraftIds.includes(aircraftId)) {
      return false;
    }

    await saveGameService.updateData((data) => {
      data.player.currentAircraftId = aircraftId;
    });
    return true;
  }
}
