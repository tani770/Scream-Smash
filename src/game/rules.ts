export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type KickPowerTier = 'none' | 'weak' | 'normal' | 'super';

export type ObstacleKind =
  | 'hurdle'
  | 'wood_barrier'
  | 'moving_gate'
  | 'boulder'
  | 'brick_wall';

export type PowerUpKind = 'super_scream' | 'double_kick';

export interface ObstacleSpec {
  kind: ObstacleKind;
  label: string;
  maxHp: number;
  basePoints: number;
  /** Minimum tier power (1=weak, 2=normal, 3=super) for a clean 1-hit shatter */
  cleanBreakPower: number;
  hitRadius: number;
  height: number;
}

export const OBSTACLE_SPECS: Record<ObstacleKind, ObstacleSpec> = {
  hurdle: {
    kind: 'hurdle',
    label: 'Track Hurdle',
    maxHp: 1,
    basePoints: 100,
    cleanBreakPower: 1,
    hitRadius: 1.05,
    height: 1.25,
  },
  wood_barrier: {
    kind: 'wood_barrier',
    label: 'Wooden Barrier',
    maxHp: 1,
    basePoints: 130,
    cleanBreakPower: 1,
    hitRadius: 1.15,
    height: 1.45,
  },
  moving_gate: {
    kind: 'moving_gate',
    label: 'Sliding Gate',
    maxHp: 2,
    basePoints: 180,
    cleanBreakPower: 2,
    hitRadius: 1.25,
    height: 1.65,
  },
  boulder: {
    kind: 'boulder',
    label: 'Rolling Boulder',
    maxHp: 2,
    basePoints: 220,
    cleanBreakPower: 2,
    hitRadius: 1.3,
    height: 1.75,
  },
  brick_wall: {
    kind: 'brick_wall',
    label: 'Brick Wall',
    maxHp: 3,
    basePoints: 300,
    cleanBreakPower: 3,
    hitRadius: 1.35,
    height: 2.15,
  },
};

export const INITIAL_LIVES = 3;
export const POWERUP_DURATION_SEC = 8.5;
export const KICK_ACTIVE_WINDOW_SEC = 0.36;
export const KICK_COOLDOWN_SEC = 0.22;
export const INVULN_DURATION_SEC = 1.35;

/**
 * Classifies normalized microphone amplitude (0..1) into kick tiers based on
 * the player's calibrated sensitivity threshold.
 */
export function classifyVoicePower(
  volume: number,
  threshold: number,
  superScreamActive: boolean,
): { tier: KickPowerTier; power: number } {
  const clampedVol = Math.max(0, Math.min(1, volume));
  const safeThreshold = Math.max(0.05, Math.min(0.8, threshold));

  if (clampedVol < safeThreshold) {
    return { tier: 'none', power: 0 };
  }

  if (superScreamActive) {
    return { tier: 'super', power: 3 };
  }

  const delta = clampedVol - safeThreshold;
  if (delta >= 0.32 || clampedVol >= 0.84) {
    return { tier: 'super', power: 3 };
  }
  if (delta >= 0.14) {
    return { tier: 'normal', power: 2 };
  }
  return { tier: 'weak', power: 1 };
}

export function tierToPower(tier: KickPowerTier): number {
  switch (tier) {
    case 'super':
      return 3;
    case 'normal':
      return 2;
    case 'weak':
      return 1;
    default:
      return 0;
  }
}

export interface KickResolution {
  destroyed: boolean;
  newHp: number;
  pointsAwarded: number;
  debrisCount: number;
  shakeTrauma: number;
  hitstopSec: number;
}

/**
 * Resolves a kick hitting an obstacle, factoring in kick power tier,
 * Double Kick (2x damage & 2x score), Super Scream, and active combo.
 */
export function evaluateKickHit(params: {
  kind: ObstacleKind;
  currentHp: number;
  tier: KickPowerTier;
  combo: number;
  doubleKickActive: boolean;
  superScreamActive: boolean;
}): KickResolution {
  const spec = OBSTACLE_SPECS[params.kind];
  const basePower = params.superScreamActive
    ? 3
    : tierToPower(params.tier);

  if (basePower <= 0) {
    return {
      destroyed: false,
      newHp: params.currentHp,
      pointsAwarded: 0,
      debrisCount: 0,
      shakeTrauma: 0,
      hitstopSec: 0,
    };
  }

  const damage = params.doubleKickActive ? basePower * 2 : basePower;
  const newHp = Math.max(0, params.currentHp - damage);
  const destroyed = newHp === 0;

  const comboMult = Math.min(5, 1 + Math.floor(params.combo / 3) * 0.5);
  const tierBonus = basePower === 3 ? 1.5 : basePower === 2 ? 1.15 : 1.0;
  const powerupBonus = params.doubleKickActive ? 2 : 1;

  const pointsAwarded = destroyed
    ? Math.round(spec.basePoints * comboMult * tierBonus * powerupBonus)
    : Math.round(spec.basePoints * 0.35 * powerupBonus);

  const debrisCount = destroyed
    ? basePower === 3
      ? 24
      : basePower === 2
        ? 16
        : 10
    : 6;

  const shakeTrauma = destroyed
    ? basePower === 3
      ? 0.72
      : basePower === 2
        ? 0.45
        : 0.25
    : 0.2;

  const hitstopSec = destroyed
    ? basePower === 3
      ? 0.065
      : basePower === 2
        ? 0.04
        : 0.022
    : 0.02;

  return {
    destroyed,
    newHp,
    pointsAwarded,
    debrisCount,
    shakeTrauma,
    hitstopSec,
  };
}

/**
 * Multi-knob difficulty ramp:
 * - Opening 10-15s (~0..180m) stays approachable.
 * - Gradually increases forward speed from 11.5 m/s up to 24.5 m/s.
 */
export function computeRunSpeed(distance: number, elapsedSec: number): number {
  const distFactor = Math.min(1, Math.max(0, distance) / 900);
  const timeFactor = Math.min(1, Math.max(0, elapsedSec - 6) / 75);
  const blend = Math.max(distFactor, timeFactor * 0.75);
  return 11.5 + blend * 13.0;
}

/**
 * Spacing between consecutive obstacles in meters.
 * Starts generous (24m) and tightens smoothly down to 13.5m.
 */
export function computeSpawnSpacing(distance: number): number {
  const ramp = Math.min(1, Math.max(0, distance) / 850);
  return 24.0 - ramp * 10.5;
}

/**
 * Chooses obstacle variety unlocked by distance so the opening run teaches
 * simple hurdles/barriers before mixing in moving gates, boulders, and brick walls.
 */
export function selectObstacleKind(distance: number, roll: number): ObstacleKind {
  const r = Math.max(0, Math.min(0.9999, roll));
  if (distance < 90) {
    return r < 0.55 ? 'hurdle' : 'wood_barrier';
  }
  if (distance < 220) {
    if (r < 0.32) return 'hurdle';
    if (r < 0.62) return 'wood_barrier';
    if (r < 0.85) return 'boulder';
    return 'moving_gate';
  }
  if (r < 0.2) return 'hurdle';
  if (r < 0.42) return 'wood_barrier';
  if (r < 0.64) return 'moving_gate';
  if (r < 0.84) return 'boulder';
  return 'brick_wall';
}

export function formatHudInt(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-US');
}
