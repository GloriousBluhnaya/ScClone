import { RemoteShip, Vector3D, QuaternionD, LaserBolt } from '../types';

export interface AIWeaponFireEvent {
  shooterId: string;
  callsign: string;
  origin: Vector3D;
  velocity: Vector3D;
  color: string;
}

// Helpers for 3D vector math
function vSub(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vAdd(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vScale(a: Vector3D, s: number): Vector3D {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function vLength(a: Vector3D): number {
  return Math.hypot(a.x, a.y, a.z);
}

function vNormalize(a: Vector3D): Vector3D {
  const len = vLength(a);
  if (len < 0.00001) return { x: 0, y: 0, z: -1 };
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

function vDot(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vCross(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// Rotate vector by quaternion
function qRotateVector(q: QuaternionD, v: Vector3D): Vector3D {
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  const vx = v.x, vy = v.y, vz = v.z;

  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);

  // v' = v + q.w * t + cross(q.xyz, t)
  return {
    x: vx + qw * tx + (qy * tz - qz * ty),
    y: vy + qw * ty + (qz * tx - qx * tz),
    z: vz + qw * tz + (qx * ty - qy * tx),
  };
}

// Compute quaternion to rotate forward (0,0,-1) to direction
function qLookRotation(dir: Vector3D, upHint: Vector3D = { x: 0, y: 1, z: 0 }): QuaternionD {
  const forward = vNormalize(dir);
  let up = vNormalize(upHint);

  // If forward and up are parallel, pick another up
  if (Math.abs(vDot(forward, up)) > 0.99) {
    up = Math.abs(forward.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  }

  // Right = forward x up (for Three.js coordinate system where -Z is forward)
  // forward is -Z, so Right = -Z x Y = -X in standard, or in Three.js forward = (0,0,-1)
  // Let right = Cross(up, -forward) = Cross(forward, up)
  const right = vNormalize(vCross(up, { x: -forward.x, y: -forward.y, z: -forward.z }));
  const actualUp = vNormalize(vCross({ x: -forward.x, y: -forward.y, z: -forward.z }, right));

  // Construct rotation matrix:
  // m00 = right.x, m01 = actualUp.x, m02 = -forward.x
  // m10 = right.y, m11 = actualUp.y, m12 = -forward.y
  // m20 = right.z, m21 = actualUp.z, m22 = -forward.z
  const m00 = right.x, m01 = actualUp.x, m02 = -forward.x;
  const m10 = right.y, m11 = actualUp.y, m12 = -forward.y;
  const m20 = right.z, m21 = actualUp.z, m22 = -forward.z;

  const trace = m00 + m11 + m22;
  let q: QuaternionD;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    q = {
      w: 0.25 / s,
      x: (m21 - m12) * s,
      y: (m02 - m20) * s,
      z: (m10 - m01) * s,
    };
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    q = {
      w: (m21 - m12) / s,
      x: 0.25 * s,
      y: (m01 + m10) / s,
      z: (m02 + m20) / s,
    };
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    q = {
      w: (m02 - m20) / s,
      x: (m01 + m10) / s,
      y: 0.25 * s,
      z: (m12 + m21) / s,
    };
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    q = {
      w: (m10 - m01) / s,
      x: (m02 + m20) / s,
      y: (m12 + m21) / s,
      z: 0.25 * s,
    };
  }

  // Normalize quaternion
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

// Slerp for smooth rotation interpolation
function qSlerp(qa: QuaternionD, qb: QuaternionD, t: number): QuaternionD {
  let cosHalfTheta = qa.w * qb.w + qa.x * qb.x + qa.y * qb.y + qa.z * qb.z;
  let bx = qb.x, by = qb.y, bz = qb.z, bw = qb.w;

  if (cosHalfTheta < 0) {
    bw = -bw;
    bx = -bx;
    by = -by;
    bz = -bz;
    cosHalfTheta = -cosHalfTheta;
  }

  if (Math.abs(cosHalfTheta) >= 1.0) {
    return { ...qa };
  }

  const halfTheta = Math.acos(Math.max(-1, Math.min(1, cosHalfTheta)));
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

  if (Math.abs(sinHalfTheta) < 0.001) {
    return {
      w: qa.w * 0.5 + bw * 0.5,
      x: qa.x * 0.5 + bx * 0.5,
      y: qa.y * 0.5 + by * 0.5,
      z: qa.z * 0.5 + bz * 0.5,
    };
  }

  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  const res = {
    w: qa.w * ratioA + bw * ratioB,
    x: qa.x * ratioA + bx * ratioB,
    y: qa.y * ratioA + by * ratioB,
    z: qa.z * ratioA + bz * ratioB,
  };
  const len = Math.hypot(res.x, res.y, res.z, res.w);
  return { x: res.x / len, y: res.y / len, z: res.z / len, w: res.w / len };
}

export class AIFlightController {
  private lastFireTimes = new Map<string, number>();
  private aiFlightPhases = new Map<string, { phaseTimer: number; corkscrewAngle: number; strafeSign: number }>();

  /**
   * Advances simulation for a single AI ship against active targets (player or other vessels).
   */
  public updateAIShip(
    ai: RemoteShip,
    playerPos: Vector3D,
    playerVel: Vector3D,
    dt: number,
    currentTime: number
  ): { updatedShip: RemoteShip; fireEvent: AIWeaponFireEvent | null } {
    let state = this.aiFlightPhases.get(ai.id);
    if (!state) {
      state = {
        phaseTimer: Math.random() * 5,
        corkscrewAngle: Math.random() * Math.PI * 2,
        strafeSign: Math.random() > 0.5 ? 1 : -1,
      };
      this.aiFlightPhases.set(ai.id, state);
    }

    state.phaseTimer += dt;
    state.corkscrewAngle += dt * 1.8;

    // Switch strafe sign every 3 to 6 seconds for dynamic evasive maneuvers
    if (state.phaseTimer > 4.5) {
      state.phaseTimer = 0;
      state.strafeSign = -state.strafeSign;
    }

    const pos = { ...ai.position };
    let vel = { ...ai.velocity };
    let rot = { ...ai.rotation };

    // Calculate relative vector to player
    const relPos = vSub(playerPos, pos);
    const distToPlayer = vLength(relPos);
    const dirToPlayer = vNormalize(relPos);

    // AI Ship characteristics based on callsign
    const isArrow = ai.callsign.includes('ARROW');
    const isCutlass = ai.callsign.includes('CUTLASS');
    const maxSpeed = isArrow ? 380 : isCutlass ? 260 : 320;
    const accelRate = (isArrow ? 85 : isCutlass ? 50 : 65) * 0.7; // Reduced by 30%
    const turnSpeed = isArrow ? 2.6 : isCutlass ? 1.4 : 2.0;

    // Desired Aim vector: Lead Intercept Point for combat firing
    const muzzleSpeed = 1250;
    const relVel = vSub(playerVel, vel);
    const timeToHit = Math.min(2.5, distToPlayer / muzzleSpeed);
    const leadPoint = vAdd(playerPos, vScale(relVel, timeToHit));
    const aimDir = vNormalize(vSub(leadPoint, pos));

    // Target rotation: point nose towards leadPoint
    const targetRot = qLookRotation(aimDir);
    // Smooth turn using Slerp
    rot = qSlerp(rot, targetRot, Math.min(1.0, turnSpeed * dt));

    // Ship forward vector in world coordinates
    const forward = qRotateVector(rot, { x: 0, y: 0, z: -1 });
    const right = qRotateVector(rot, { x: 1, y: 0, z: 0 });
    const up = qRotateVector(rot, { x: 0, y: 1, z: 0 });

    // Desired acceleration vector (Surge + Sway + Heave)
    let accel = { x: 0, y: 0, z: 0 };
    let boostActive = false;

    if (distToPlayer > 1200) {
      // 1. Long range intercept: Boost surge towards target
      accel = vAdd(accel, vScale(forward, accelRate * 1.5));
      boostActive = true;
    } else if (distToPlayer > 350) {
      // 2. Medium dogfight range: Forward throttle + corkscrew strafe
      accel = vAdd(accel, vScale(forward, accelRate * 0.85));
      // Evasive spiral / corkscrew strafe
      const swayAmount = Math.cos(state.corkscrewAngle) * state.strafeSign * (accelRate * 0.45);
      const heaveAmount = Math.sin(state.corkscrewAngle) * (accelRate * 0.45);
      accel = vAdd(accel, vScale(right, swayAmount));
      accel = vAdd(accel, vScale(up, heaveAmount));
    } else if (distToPlayer > 120) {
      // 3. Close combat orbit & joust evasion
      // Decelerate surge or orbit laterally
      const swayAmount = state.strafeSign * (accelRate * 0.7);
      const heaveAmount = Math.sin(state.corkscrewAngle * 1.5) * (accelRate * 0.5);
      accel = vAdd(accel, vScale(right, swayAmount));
      accel = vAdd(accel, vScale(up, heaveAmount));
      // Slight retro thrust to avoid crashing into player
      accel = vAdd(accel, vScale(forward, -accelRate * 0.3));
    } else {
      // 4. Danger close collision avoidance: Hard break away
      accel = vAdd(accel, vScale(up, accelRate * 1.2));
      accel = vAdd(accel, vScale(right, state.strafeSign * accelRate * 1.0));
      boostActive = true;
    }

    // Leash to arena boundaries (keep within 1200m of center)
    const arenaCenter: Vector3D = { x: 0, y: 0, z: -450 };
    const fromCenter = vSub(pos, arenaCenter);
    const centerDist = vLength(fromCenter);
    if (centerDist > 1100) {
      const returnDir = vNormalize(vScale(fromCenter, -1));
      accel = vAdd(accel, vScale(returnDir, accelRate * 1.2));
    }

    // Apply acceleration with drag to velocity
    vel = vAdd(vel, vScale(accel, dt));
    const currentSpeed = vLength(vel);
    if (currentSpeed > maxSpeed) {
      vel = vScale(vel, maxSpeed / currentSpeed);
    }

    // Dampen perpendicular drift slightly (IFCS coupled stabilization)
    vel = vScale(vel, Math.max(0.92, 1.0 - 0.05 * dt));

    // Update position
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;

    // Shield recharge if not destroyed
    let shield = ai.shield;
    let hull = ai.hull;
    if (shield < ai.maxShield && hull > 0 && currentTime - ai.lastHit > 3000) {
      shield = Math.min(ai.maxShield, shield + 8 * dt);
    }

    // Weapon firing logic
    let fireEvent: AIWeaponFireEvent | null = null;
    const noseAlignment = vDot(forward, dirToPlayer);
    const lastFire = this.lastFireTimes.get(ai.id) || 0;

    // Fire when facing target within ~22 degrees and within 700 meters
    if (distToPlayer < 700 && noseAlignment > 0.92 && currentTime - lastFire > (isArrow ? 450 : isCutlass ? 350 : 400)) {
      this.lastFireTimes.set(ai.id, currentTime);

      const hardpointOffset = Math.random() > 0.5 ? 2.5 : -2.5;
      const muzzleOrigin = vAdd(vAdd(pos, vScale(right, hardpointOffset)), vScale(forward, 2.0));
      const boltVel = vAdd(vel, vScale(forward, muzzleSpeed));

      fireEvent = {
        shooterId: ai.id,
        callsign: ai.callsign,
        origin: muzzleOrigin,
        velocity: boltVel,
        color: isArrow ? '#f59e0b' : isCutlass ? '#ef4444' : '#f97316',
      };
    }

    return {
      updatedShip: {
        ...ai,
        position: pos,
        velocity: vel,
        rotation: rot,
        boost: boostActive,
        shield,
        hull,
      },
      fireEvent,
    };
  }
}

export const aiFlightSim = new AIFlightController();
