import { saveGameService } from '../storage/SaveGameService';

export interface StatUpgradeDefinition {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
}

export const UPGRADE_DEFINITIONS: StatUpgradeDefinition[] = [
  { id: 'speed', name: 'Top Speed', description: 'Increases aircraft maximum flight speed (+10 m/s per level).', maxLevel: 5, baseCost: 500, costMultiplier: 1.5 },
  { id: 'acceleration', name: 'Acceleration', description: 'Increases engine thrust acceleration (+5 m/s² per level).', maxLevel: 5, baseCost: 450, costMultiplier: 1.5 },
  { id: 'armor', name: 'Armor Protection', description: 'Increases airframe structural health (+15 HP per level).', maxLevel: 5, baseCost: 600, costMultiplier: 1.6 },
  { id: 'handling', name: 'Handling & Agility', description: 'Enhances pitch and roll turn rates (+0.08 rad/s per level).', maxLevel: 5, baseCost: 500, costMultiplier: 1.5 },
  { id: 'missileCapacity', name: 'Missile Payload', description: 'Increases Sidewinder missile capacity (+1 missile per level).', maxLevel: 3, baseCost: 1000, costMultiplier: 1.8 },
  { id: 'missileDamage', name: 'Missile Warhead', description: 'Increases missile explosion damage (+20 DMG per level).', maxLevel: 5, baseCost: 750, costMultiplier: 1.6 },
  { id: 'gunDamage', name: 'Vulcan Ammo Caliber', description: 'Increases 20mm cannon bullet damage (+2 DMG per level).', maxLevel: 5, baseCost: 400, costMultiplier: 1.4 },
  { id: 'lockSpeed', name: 'Radar Lock Speed', description: 'Reduces target lock-on timer (-10% lock time per level).', maxLevel: 4, baseCost: 800, costMultiplier: 1.7 },
  { id: 'boostCapacity', name: 'Afterburner Fuel', description: 'Increases maximum boost fuel capacity (+15 fuel per level).', maxLevel: 5, baseCost: 500, costMultiplier: 1.5 },
];

export class UpgradeService {
  static getStatLevel(aircraftId: string, statId: string): number {
    const saveData = saveGameService.getData();
    return saveData.upgrades[aircraftId]?.[statId] ?? 0;
  }

  static getUpgradeCost(statId: string, currentLevel: number): number {
    const def = UPGRADE_DEFINITIONS.find((u) => u.id === statId);
    if (!def || currentLevel >= def.maxLevel) return 0;
    return Math.round(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
  }

  static async purchaseUpgrade(aircraftId: string, statId: string): Promise<boolean> {
    const def = UPGRADE_DEFINITIONS.find((u) => u.id === statId);
    if (!def) return false;

    const currentLevel = this.getStatLevel(aircraftId, statId);
    if (currentLevel >= def.maxLevel) return false;

    const cost = this.getUpgradeCost(statId, currentLevel);
    const saveData = saveGameService.getData();

    if (saveData.player.credits < cost) {
      console.warn(`[UpgradeService] Insufficient credits (${saveData.player.credits}/${cost})`);
      return false;
    }

    await saveGameService.updateData((data) => {
      data.player.credits -= cost;
      if (!data.upgrades[aircraftId]) {
        data.upgrades[aircraftId] = {};
      }
      data.upgrades[aircraftId][statId] = currentLevel + 1;
    });

    console.log(`[UpgradeService] ⬆ UPGRADED ${def.name} to Level ${currentLevel + 1} for ${aircraftId}`);
    return true;
  }
}
