import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyVoicePower,
  computeRunSpeed,
  computeSpawnSpacing,
  evaluateKickHit,
  formatHudInt,
  selectObstacleKind,
} from './rules';

test('classifyVoicePower respects threshold and scales weak -> normal -> super', () => {
  const threshold = 0.25;
  assert.deepEqual(classifyVoicePower(0.1, threshold, false), {
    tier: 'none',
    power: 0,
  });
  assert.deepEqual(classifyVoicePower(0.28, threshold, false), {
    tier: 'weak',
    power: 1,
  });
  assert.deepEqual(classifyVoicePower(0.42, threshold, false), {
    tier: 'normal',
    power: 2,
  });
  assert.deepEqual(classifyVoicePower(0.75, threshold, false), {
    tier: 'super',
    power: 3,
  });
});

test('classifyVoicePower upgrades any above-threshold scream to super when Super Scream is active', () => {
  assert.deepEqual(classifyVoicePower(0.26, 0.25, true), {
    tier: 'super',
    power: 3,
  });
  assert.deepEqual(classifyVoicePower(0.1, 0.25, true), {
    tier: 'none',
    power: 0,
  });
});

test('evaluateKickHit shatters hurdles on weak kick and brick walls on super kick', () => {
  const hurdleWeak = evaluateKickHit({
    kind: 'hurdle',
    currentHp: 1,
    tier: 'weak',
    combo: 0,
    doubleKickActive: false,
    superScreamActive: false,
  });
  assert.equal(hurdleWeak.destroyed, true);
  assert.equal(hurdleWeak.newHp, 0);
  assert.equal(hurdleWeak.pointsAwarded, 100);

  const wallWeak = evaluateKickHit({
    kind: 'brick_wall',
    currentHp: 3,
    tier: 'weak',
    combo: 0,
    doubleKickActive: false,
    superScreamActive: false,
  });
  assert.equal(wallWeak.destroyed, false);
  assert.equal(wallWeak.newHp, 2);

  const wallSuper = evaluateKickHit({
    kind: 'brick_wall',
    currentHp: 3,
    tier: 'super',
    combo: 6,
    doubleKickActive: false,
    superScreamActive: false,
  });
  assert.equal(wallSuper.destroyed, true);
  assert.equal(wallSuper.newHp, 0);
  assert.ok(wallSuper.pointsAwarded > 300);
});

test('evaluateKickHit doubles damage and score with Double Kick power-up', () => {
  const normalBoulder = evaluateKickHit({
    kind: 'boulder',
    currentHp: 2,
    tier: 'weak',
    combo: 0,
    doubleKickActive: true,
    superScreamActive: false,
  });
  assert.equal(normalBoulder.destroyed, true);
  assert.equal(normalBoulder.pointsAwarded, 440);
});

test('difficulty curves stay bounded and ramp smoothly', () => {
  const startSpeed = computeRunSpeed(0, 0);
  const midSpeed = computeRunSpeed(450, 35);
  const maxSpeed = computeRunSpeed(5000, 300);
  assert.equal(startSpeed, 11.5);
  assert.ok(midSpeed > startSpeed && midSpeed < maxSpeed);
  assert.equal(maxSpeed, 24.5);

  const startSpacing = computeSpawnSpacing(0);
  const lateSpacing = computeSpawnSpacing(2000);
  assert.equal(startSpacing, 24.0);
  assert.equal(lateSpacing, 13.5);
});

test('selectObstacleKind introduces tougher obstacles progressively', () => {
  assert.equal(selectObstacleKind(20, 0.9), 'wood_barrier');
  assert.equal(selectObstacleKind(150, 0.9), 'moving_gate');
  assert.equal(selectObstacleKind(350, 0.95), 'brick_wall');
});

test('formatHudInt formats whole numbers cleanly', () => {
  assert.equal(formatHudInt(1234.6), '1,235');
  assert.equal(formatHudInt(-5), '0');
});
