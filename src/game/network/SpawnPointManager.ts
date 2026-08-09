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
  { x: 0,    z: 0 },
  { x: 1000, z: 0 },
  { x: 2000, z: 0 },
  { x: 3000, z: 0 },
  { x: 4000, z: 0 },
  { x: 5000, z: 0 },
];

export function getDeterministicSpawnPoint(slotIndex: number): SpawnPoint {
  const safeIndex = Math.max(0, Math.floor(slotIndex));
  const baseSlot  = PREDEFINED_SLOTS[safeIndex % PREDEFINED_SLOTS.length];
  
  // Calculate extra row offset if slotIndex exceeds predefined array
  const extraRow = Math.floor(safeIndex / PREDEFINED_SLOTS.length);
  const zOffset  = extraRow * -1000; // 1000m further back per tier

  const x = baseSlot.x;
  const z = baseSlot.z + zOffset;
  const groundH = IslandTerrain.getHeightAt(x, z);
  const y = groundH + 3.0; // 3m above runway surface

  return { x, y, z, heading: 0 };
}
