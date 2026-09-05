import { RemoteShip, Vector3D, QuaternionD } from '../types';

export function normalizeVector3D(val: any, fallback: Vector3D = { x: 0, y: 0, z: 0 }): Vector3D {
  if (!val) return { ...fallback };
  if (Array.isArray(val)) {
    return {
      x: typeof val[0] === 'number' && !isNaN(val[0]) ? val[0] : fallback.x,
      y: typeof val[1] === 'number' && !isNaN(val[1]) ? val[1] : fallback.y,
      z: typeof val[2] === 'number' && !isNaN(val[2]) ? val[2] : fallback.z,
    };
  }
  return {
    x: typeof val.x === 'number' && !isNaN(val.x) ? val.x : fallback.x,
    y: typeof val.y === 'number' && !isNaN(val.y) ? val.y : fallback.y,
    z: typeof val.z === 'number' && !isNaN(val.z) ? val.z : fallback.z,
  };
}

export function normalizeQuaternionD(
  val: any,
  fallback: QuaternionD = { x: 0, y: 0, z: 0, w: 1 }
): QuaternionD {
  if (!val) return { ...fallback };
  if (Array.isArray(val)) {
    return {
      x: typeof val[0] === 'number' && !isNaN(val[0]) ? val[0] : fallback.x,
      y: typeof val[1] === 'number' && !isNaN(val[1]) ? val[1] : fallback.y,
      z: typeof val[2] === 'number' && !isNaN(val[2]) ? val[2] : fallback.z,
      w: typeof val[3] === 'number' && !isNaN(val[3]) ? val[3] : fallback.w,
    };
  }
  return {
    x: typeof val.x === 'number' && !isNaN(val.x) ? val.x : fallback.x,
    y: typeof val.y === 'number' && !isNaN(val.y) ? val.y : fallback.y,
    z: typeof val.z === 'number' && !isNaN(val.z) ? val.z : fallback.z,
    w: typeof val.w === 'number' && !isNaN(val.w) ? val.w : fallback.w,
  };
}

export function normalizeShip(raw: any): RemoteShip {
  if (!raw) {
    return {
      id: 'unknown-' + Math.random().toString(36).substring(2, 7),
      callsign: 'UNKNOWN SHIP',
      isAI: false,
      position: { x: 0, y: 0, z: -500 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      hull: 100,
      maxHull: 100,
      shield: 100,
      maxShield: 100,
      lastHit: 0,
      boost: false,
      decoupled: false,
      score: 0,
      targetId: null,
    };
  }

  const id = String(raw.id || 'ship-' + Math.random().toString(36).substring(2, 7));
  const isAI = Boolean(raw.isAI ?? id.startsWith('ai-'));
  const callsign = String(raw.callsign || (isAI ? 'BANDIT [AI]' : 'PILOT'));

  const hull = typeof raw.hull === 'number' && !isNaN(raw.hull) ? raw.hull : 100;
  const maxHull = typeof raw.maxHull === 'number' && !isNaN(raw.maxHull) ? raw.maxHull : Math.max(hull, 100);
  const shield = typeof raw.shield === 'number' && !isNaN(raw.shield) ? raw.shield : 100;
  const maxShield = typeof raw.maxShield === 'number' && !isNaN(raw.maxShield) ? raw.maxShield : Math.max(shield, 100);
  const lastHit = typeof raw.lastHit === 'number' && !isNaN(raw.lastHit) ? raw.lastHit : 0;

  return {
    id,
    callsign,
    isAI,
    position: normalizeVector3D(raw.position, { x: 0, y: 0, z: -400 }),
    velocity: normalizeVector3D(raw.velocity, { x: 0, y: 0, z: 0 }),
    rotation: normalizeQuaternionD(raw.rotation, { x: 0, y: 0, z: 0, w: 1 }),
    angularVelocity: normalizeVector3D(raw.angularVelocity, { x: 0, y: 0, z: 0 }),
    hull,
    maxHull,
    shield,
    maxShield,
    lastHit,
    boost: Boolean(raw.boost),
    decoupled: Boolean(raw.decoupled),
    score: typeof raw.score === 'number' ? raw.score : 0,
    targetId: raw.targetId ? String(raw.targetId) : null,
    ready: Boolean(raw.ready),
  };
}
