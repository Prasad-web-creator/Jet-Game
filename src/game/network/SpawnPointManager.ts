/**
 * SpawnPointManager — deterministic runway spawn slot generator.
 *
 * Defines predefined runway slots (Slot 0..5) staggered safely along the airport.
 * For > 6 players, dynamically calculates additional staggered slot rows.
 */
import { IslandTerrain } from '../world/terrain/IslandTerrain';

export interface SpawnPoint {
  x:       number;
  y:       number;
  z:       number;
  heading: number; // radians (0 = North)
}

const PREDEFINED_SLOTS: Array<{ x: number; z: number }> = [
  { x: -18, z: -280 }, // Slot 0: Runway Left Rear
  { x:  18, z: -280 }, // Slot 1: Runway Right Rear
  { x: -18, z: -240 }, // Slot 2: Runway Left Mid
  { x:  18, z: -240 }, // Slot 3: Runway Right Mid
  { x: -18, z: -200 }, // Slot 4: Runway Left Front
  { x:  18, z: -200 }, // Slot 5: Runway Right Front
];

export function getDeterministicSpawnPoint(slotIndex: number): SpawnPoint {
  const safeIndex = Math.max(0, Math.floor(slotIndex));
  const baseSlot  = PREDEFINED_SLOTS[safeIndex % PREDEFINED_SLOTS.length];
  
  // Calculate extra row offset if slotIndex exceeds predefined array
  const extraRow = Math.floor(safeIndex / PREDEFINED_SLOTS.length);
  const zOffset  = extraRow * -80; // 80m further back per tier

  const x = baseSlot.x;
  const z = baseSlot.z + zOffset;
  const groundH = IslandTerrain.getHeightAt(x, z);
  const y = groundH + 3.0; // 3m above runway surface

  return { x, y, z, heading: 0 };
}
