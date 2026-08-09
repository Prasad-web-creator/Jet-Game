import type { AircraftConfig } from '../../../types';

export interface HangarAircraftDefinition {
  config: AircraftConfig;
  role: string;
  description: string;
  price: number;
  unlockLevel: number;
  isUnlockedByDefault?: boolean;
}

export const HANGAR_AIRCRAFT: HangarAircraftDefinition[] = [
  {
    config: {
      id: 'f16_player',
      name: 'F-16C Fighting Falcon',
      modelPath: '',
      maxSpeed: 360,     // m/s
      minSpeed: 60,
      acceleration: 45,  // m/s²
      turnRate: 1.20,
      rollRate: 2.00,
      maxHealth: 1000,
      weaponSlots: 4,
    },
    role: 'Multirole Fighter',
    description: 'Agile, highly maneuverable multirole jet fighter. Balanced performance in dogfighting and ground strikes.',
    price: 0,
    unlockLevel: 1,
    isUnlockedByDefault: true,
  },
  {
    config: {
      id: 'a10_warthog',
      name: 'A-10C Thunderbolt II',
      modelPath: '',
      maxSpeed: 290,
      minSpeed: 45,
      acceleration: 35,
      turnRate: 0.95,
      rollRate: 1.50,
      maxHealth: 1800,    // High Armor
      weaponSlots: 6,
    },
    role: 'Heavy Ground Attack',
    description: 'Armored close-air-support jet built around a 30mm Avenger rotary cannon. High armor and devastating firepower.',
    price: 3000,
    unlockLevel: 3,
  },
  {
    config: {
      id: 'su35_flanker',
      name: 'Su-35 Flanker-E',
      modelPath: '',
      maxSpeed: 410,
      minSpeed: 50,
      acceleration: 55,
      turnRate: 1.45,    // Super-maneuverable
      rollRate: 2.30,
      maxHealth: 1100,
      weaponSlots: 4,
    },
    role: 'Air Superiority Interceptor',
    description: 'Thrust-vectoring super-maneuverable interceptor. Out-turns enemy fighters in high-G dogfights.',
    price: 6000,
    unlockLevel: 5,
  },
  {
    config: {
      id: 'f22_raptor',
      name: 'F-22A Raptor',
      modelPath: '',
      maxSpeed: 460,     // Supercruise
      minSpeed: 55,
      acceleration: 65,
      turnRate: 1.60,
      rollRate: 2.60,
      maxHealth: 1400,
      weaponSlots: 6,
    },
    role: 'Stealth Air Dominance Ace',
    description: '5th Generation stealth superiority fighter. Unmatched speed, acceleration, and stealth missile delivery.',
    price: 12000,
    unlockLevel: 8,
  },
];
