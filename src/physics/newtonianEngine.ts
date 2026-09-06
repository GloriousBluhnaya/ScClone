import * as THREE from 'three';
import { ShipPhysicsState, ThrusterInputs, Vector3D } from '../types';

export interface ShipSpecs {
  mass: number;                // kg
  mainThrust: number;          // N (forward)
  retroThrust: number;         // N (braking)
  maneuverThrust: number;      // N (lateral/vertical)
  pitchTorque: number;         // N*m
  yawTorque: number;           // N*m
  rollTorque: number;          // N*m
  boostMultiplier: number;     // 1.8x
  projectileSpeed: number;     // m/s (e.g. 1200 m/s for laser repeater)
  maxSCMSpeed: number;         // m/s in coupled mode (e.g. 320 m/s)
  maxBoostSpeed: number;       // m/s in boost (e.g. 750 m/s)
  maxPitchRate: number;        // rad/s (full 360 deg in 5.0s => 2*pi/5 = 1.2566 rad/s = 72 deg/s)
  maxYawRate: number;          // rad/s (full 360 deg in 8.0s => 2*pi/8 = 0.7854 rad/s = 45 deg/s)
  maxRollRate: number;         // rad/s (approx 137.5 deg/s = 2.4 rad/s)
  pitchAngularAccel: number;   // rad/s^2 (high acceleration for snappy, responsive control)
  yawAngularAccel: number;     // rad/s^2 (high acceleration for snappy, responsive control)
  rollAngularAccel: number;    // rad/s^2
  swayJerkLimit: number;       // m/s^3 (lateral thruster jerk limit - rate of change of lateral acceleration)
  heaveJerkLimit: number;      // m/s^3 (vertical thruster jerk limit - rate of change of vertical acceleration)
  surgeJerkLimit: number;      // m/s^3 (longitudinal thruster jerk limit - rate of change of surge acceleration)
}

export const DEFAULT_SPECS: ShipSpecs = {
  mass: 22000,
  // Reduced accelerations by 30% for forward (5.6G) and lateral/vertical (3.5G), while keeping reverse (3G) unchanged.
  // Standard gravity g = 9.81 m/s^2 -> Force = mass * G * 9.81
  mainThrust: 22000 * 5.6 * 9.81,     // 1,208,592 N (5.6G forward acceleration - reduced 30% from 8G)
  retroThrust: 22000 * 3 * 9.81,      // 647,460 N (3G reverse acceleration - unchanged)
  maneuverThrust: 22000 * 3.5 * 9.81, // 755,370 N (3.5G lateral / vertical strafe - reduced 30% from 5G)
  pitchTorque: 95000,
  yawTorque: 85000,
  rollTorque: 120000,
  boostMultiplier: 1.75,
  projectileSpeed: 1250,
  maxSCMSpeed: 320,
  maxBoostSpeed: 500,
  // User spec: exactly 5 seconds for full 360 deg rotation in pure pitch at max pitch input
  // 360 deg = 2 * PI radians => 2 * PI / 5.0 = 1.256637 rad/s (72 deg/s)
  maxPitchRate: (2 * Math.PI) / 5.0,
  // User spec: exactly 8 seconds for full 360 deg rotation in pure yaw at max yaw input
  // 360 deg = 2 * PI radians => 2 * PI / 8.0 = 0.785398 rad/s (45 deg/s)
  maxYawRate: (2 * Math.PI) / 8.0,
  maxRollRate: 2.4,
  // Raised angular accelerations for immediate, crisp responsiveness (reaches max speed in ~0.12s)
  pitchAngularAccel: 9.0, // rad/s^2
  yawAngularAccel: 7.0,   // rad/s^2
  rollAngularAccel: 12.0, // rad/s^2
  // Star Citizen IFCS physical thruster jerk limits (da/dt in m/s^3):
  // At 5G max lateral acceleration (~49.05 m/s^2):
  // With swayJerkLimit = 50.0 m/s^3 (~5.1 G/s):
  // - Transitioning from 0G to full right acceleration (+5G) takes ~0.98 seconds
  // - Transitioning from full left (-5G) to full right (+5G) acceleration takes ~1.96 seconds.
  // This completely eliminates input wiggling / instant direction snapping and enforces true mass inertia.
  swayJerkLimit: 50.0,  // m/s^3 (~1.96s full reversal across zero between left and right acceleration)
  heaveJerkLimit: 50.0, // m/s^3 (~1.96s full reversal across zero between down and up acceleration)
  surgeJerkLimit: 70.0, // m/s^3 (~1.54s full reversal between -3G retro and +8G forward acceleration)
};

export class NewtonianFlightEngine {
  private specs: ShipSpecs;

  // Reusable Three.js math vectors to avoid GC pressure in hot animation loop
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private rot = new THREE.Quaternion();
  private angVel = new THREE.Vector3();
  private accel = new THREE.Vector3();
  // Local thruster accelerations exerted on the physical hull (X=sway, Y=heave, Z=surge)
  private currentLocalAccel = new THREE.Vector3(0, 0, 0);

  // Smoothed thruster command rates for fluid IFCS transitions without jerky snaps
  private smoothedSway = 0;
  private smoothedHeave = 0;
  private smoothedSurge = 0;
  private smoothedRoll = 0;

  constructor(specs: ShipSpecs = DEFAULT_SPECS) {
    this.specs = specs;
  }

  public initShip(position: Vector3D = { x: 0, y: 0, z: 0 }): ShipPhysicsState {
    this.pos.set(position.x, position.y, position.z);
    this.vel.set(0, 0, 0);
    this.rot.identity();
    this.angVel.set(0, 0, 0);
    this.accel.set(0, 0, 0);
    this.currentLocalAccel.set(0, 0, 0);

    this.smoothedSway = 0;
    this.smoothedHeave = 0;
    this.smoothedSurge = 0;
    this.smoothedRoll = 0;

    return {
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      mass: this.specs.mass,
      momentOfInertia: { x: 18000, y: 22000, z: 12000 },
      throttle: 0,
      targetThrottle: 0,
      boostActive: false,
      ifcsMode: 'coupled',
      speedLimit: this.specs.maxSCMSpeed,
      currentSpeed: 0,
      gForce: 1.0,
    };
  }

  public update(
    state: ShipPhysicsState,
    inputs: ThrusterInputs,
    dt: number
  ): ShipPhysicsState {
    // Clamp delta time to prevent physics explosions on frame spikes
    const delta = Math.min(dt, 0.1);

    // Sync from state to vectors
    this.pos.set(state.position.x, state.position.y, state.position.z);
    this.vel.set(state.velocity.x, state.velocity.y, state.velocity.z);
    this.rot.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    this.angVel.set(state.angularVelocity.x, state.angularVelocity.y, state.angularVelocity.z);

    // Flight geometry rules:
    // 1. Base speed limit of 320 m/s in any direction.
    // 2. With boost, raise speed limit to 500 m/s, but boost ONLY works for forward strafe (not vertical or side strafes).
    // 3. While over the speed limit, cannot keep acceleration into the same vector traveling without using boost.
    const isForwardStrafe = inputs.surge > 0.05 || this.smoothedSurge > 0.05;
    const boostEngaged = inputs.boost && isForwardStrafe;
    const forwardBoostMult = boostEngaged ? this.specs.boostMultiplier : 1.0;
    const baseSpeedLimit = this.specs.maxSCMSpeed; // 320 m/s
    const activeSpeedLimit = boostEngaged ? this.specs.maxBoostSpeed : baseSpeedLimit; // 500 m/s with forward boost

    // Star Citizen IFCS thruster rise rate & jerk smoothing:
    // Uses Three.js MathUtils.damp with lambda = 22 for immediate (~0.05s) response
    // while eliminating harsh instantaneous step discontinuities when alternating strafes
    this.smoothedSway = THREE.MathUtils.damp(this.smoothedSway, inputs.sway, 22, delta);
    this.smoothedHeave = THREE.MathUtils.damp(this.smoothedHeave, inputs.heave, 22, delta);
    this.smoothedSurge = THREE.MathUtils.damp(this.smoothedSurge, inputs.surge, 22, delta);
    this.smoothedRoll = THREE.MathUtils.damp(this.smoothedRoll, inputs.roll, 22, delta);

    if (Math.abs(inputs.sway) < 0.001 && Math.abs(this.smoothedSway) < 0.005) this.smoothedSway = 0;
    if (Math.abs(inputs.heave) < 0.001 && Math.abs(this.smoothedHeave) < 0.005) this.smoothedHeave = 0;
    if (Math.abs(inputs.surge) < 0.001 && Math.abs(this.smoothedSurge) < 0.005) this.smoothedSurge = 0;
    if (Math.abs(inputs.roll) < 0.001 && Math.abs(this.smoothedRoll) < 0.005) this.smoothedRoll = 0;

    // Local orientation axes
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rot);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.rot);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.rot);

    // 1. ROTATIONAL DYNAMICS (Star Citizen Fly-by-wire IFCS Rate-Demand)
    // Pilot sticks command desired rotational rate (% of max pitch/yaw/roll rate)
    const targetAngVelX = inputs.pitch * this.specs.maxPitchRate;
    const targetAngVelY = -inputs.yaw * this.specs.maxYawRate;
    const targetAngVelZ = -this.smoothedRoll * this.specs.maxRollRate;

    // High angular acceleration for crisp, snappy responsiveness
    const maxDeltaPitch = this.specs.pitchAngularAccel * delta;
    const maxDeltaYaw = this.specs.yawAngularAccel * delta;
    const maxDeltaRoll = this.specs.rollAngularAccel * delta;

    // Pitch rate integration (X-axis)
    const errorPitch = targetAngVelX - this.angVel.x;
    if (Math.abs(errorPitch) <= maxDeltaPitch) {
      this.angVel.x = targetAngVelX;
    } else {
      this.angVel.x += Math.sign(errorPitch) * maxDeltaPitch;
    }

    // Yaw rate integration (Y-axis)
    const errorYaw = targetAngVelY - this.angVel.y;
    if (Math.abs(errorYaw) <= maxDeltaYaw) {
      this.angVel.y = targetAngVelY;
    } else {
      this.angVel.y += Math.sign(errorYaw) * maxDeltaYaw;
    }

    // Roll rate integration (Z-axis)
    const errorRoll = targetAngVelZ - this.angVel.z;
    if (Math.abs(errorRoll) <= maxDeltaRoll) {
      this.angVel.z = targetAngVelZ;
    } else {
      this.angVel.z += Math.sign(errorRoll) * maxDeltaRoll;
    }

    // Clamp maximum rotational speeds per-axis to guarantee exact top speeds:
    // Pure pitch: max 1.2566 rad/s (360 deg in 5.0s)
    // Pure yaw: max 0.7854 rad/s (360 deg in 8.0s)
    this.angVel.x = Math.max(-this.specs.maxPitchRate, Math.min(this.specs.maxPitchRate, this.angVel.x));
    this.angVel.y = Math.max(-this.specs.maxYawRate, Math.min(this.specs.maxYawRate, this.angVel.y));
    this.angVel.z = Math.max(-this.specs.maxRollRate, Math.min(this.specs.maxRollRate, this.angVel.z));

    // Integrate rotation using angular velocity in local space
    const deltaAngle = this.angVel.clone().multiplyScalar(delta);
    const deltaRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(deltaAngle.x, deltaAngle.y, deltaAngle.z, 'YXZ')
    );
    this.rot.multiply(deltaRotation);
    this.rot.normalize();

    // 2. LINEAR DYNAMICS (IFCS Thruster Jerk Rate-Limiting -> Acceleration -> Velocity -> Position)
    // Decompose current velocity into ship local frame: Forward (Z), Lateral (X), Vertical (Y)
    const localVelForward = this.vel.dot(forward);
    const localVelRight = this.vel.dot(right);
    const localVelUp = this.vel.dot(up);

    const maxMainAccel = (this.specs.mainThrust / state.mass) * forwardBoostMult;   // ~54.94 m/s^2 (5.6G, or ~9.8G boosted)
    const maxRetroAccel = this.specs.retroThrust / state.mass;                     // ~29.43 m/s^2 (3G)
    const maxManeuverAccel = this.specs.maneuverThrust / state.mass;               // ~34.34 m/s^2 (3.5G)

    let targetAccelX = 0;
    let targetAccelY = 0;
    let targetAccelZ = 0;

    if (state.ifcsMode === 'coupled') {
      // COUPLED IFCS: Flight computer manages thrusters to achieve target velocity
      // Forward/Surge: W/S commands or throttle wheel setting
      let targetSurgeSpeed = 0;
      if (this.smoothedSurge > 0.01) {
        targetSurgeSpeed = this.smoothedSurge * (boostEngaged ? this.specs.maxBoostSpeed : baseSpeedLimit);
      } else if (this.smoothedSurge < -0.01) {
        // Reverse strafe is capped at base speed limit (320 m/s); boost never applies to reverse
        targetSurgeSpeed = this.smoothedSurge * baseSpeedLimit;
      }

      const surgeError = targetSurgeSpeed - localVelForward;
      if (surgeError >= 0) {
        targetAccelZ = Math.min(maxMainAccel, surgeError * 5.0);
      } else {
        targetAccelZ = -Math.min(maxRetroAccel, Math.abs(surgeError) * 5.0);
      }

      // Lateral (Sway): A / D or arrest drift
      // Target speed capped at 320 m/s (boost only works for forward strafe)
      const targetSwaySpeed = this.smoothedSway * baseSpeedLimit;
      const swayError = targetSwaySpeed - localVelRight;
      targetAccelX = Math.sign(swayError) * Math.min(maxManeuverAccel, Math.abs(swayError) * 5.0);

      // Vertical (Heave): Space / Ctrl or arrest drift
      // Target speed capped at 320 m/s (boost only works for forward strafe)
      const targetHeaveSpeed = this.smoothedHeave * baseSpeedLimit;
      const heaveError = targetHeaveSpeed - localVelUp;
      targetAccelY = Math.sign(heaveError) * Math.min(maxManeuverAccel, Math.abs(heaveError) * 5.0);

    } else {
      // DECOUPLED IFCS: Pure Newtonian Mechanics!
      // Thrusters only apply direct linear thrust when commanded.
      // Zero artificial arrest of drift: you can drift sideways, backwards, or tumble!
      if (this.smoothedSurge > 0.01) {
        targetAccelZ = this.smoothedSurge * maxMainAccel;
      } else if (this.smoothedSurge < -0.01) {
        targetAccelZ = this.smoothedSurge * maxRetroAccel;
      }

      if (Math.abs(this.smoothedSway) > 0.01) {
        targetAccelX = this.smoothedSway * maxManeuverAccel;
      }

      if (Math.abs(this.smoothedHeave) > 0.01) {
        targetAccelY = this.smoothedHeave * maxManeuverAccel;
      }
    }

    // Physical Thruster Jerk Rate-Limiting (da/dt in m/s^3):
    // Smooths thruster output spooling and enforces realistic acceleration curves,
    // eliminating instant reversals / wiggle spamming across lateral, vertical, and surge axes.

    // 1. Lateral (Sway, X-axis) Jerk Limiting:
    const maxDeltaAccelSway = this.specs.swayJerkLimit * delta;
    const errorAccelSway = targetAccelX - this.currentLocalAccel.x;
    if (Math.abs(errorAccelSway) <= maxDeltaAccelSway) {
      this.currentLocalAccel.x = targetAccelX;
    } else {
      this.currentLocalAccel.x += Math.sign(errorAccelSway) * maxDeltaAccelSway;
    }

    // 2. Vertical (Heave, Y-axis) Jerk Limiting:
    const maxDeltaAccelHeave = this.specs.heaveJerkLimit * delta;
    const errorAccelHeave = targetAccelY - this.currentLocalAccel.y;
    if (Math.abs(errorAccelHeave) <= maxDeltaAccelHeave) {
      this.currentLocalAccel.y = targetAccelY;
    } else {
      this.currentLocalAccel.y += Math.sign(errorAccelHeave) * maxDeltaAccelHeave;
    }

    // 3. Longitudinal (Surge, Z-axis) Jerk Limiting:
    const maxDeltaAccelSurge = this.specs.surgeJerkLimit * delta;
    const errorAccelSurge = targetAccelZ - this.currentLocalAccel.z;
    if (Math.abs(errorAccelSurge) <= maxDeltaAccelSurge) {
      this.currentLocalAccel.z = targetAccelZ;
    } else {
      this.currentLocalAccel.z += Math.sign(errorAccelSurge) * maxDeltaAccelSurge;
    }

    // Construct physical force vector in world space from rate-limited thruster accelerations
    const force = new THREE.Vector3(0, 0, 0);
    force.addScaledVector(right, this.currentLocalAccel.x * state.mass);
    force.addScaledVector(up, this.currentLocalAccel.y * state.mass);
    force.addScaledVector(forward, this.currentLocalAccel.z * state.mass);

    // 3. FLIGHT GEOMETRY VECTOR CONSTRAINT
    // "While you're over the speed limit, you cannot keep acceleration into the same vector you're traveling without using boost."
    const initialSpeed = this.vel.length();

    if (initialSpeed > 0.01) {
      const travelDir = this.vel.clone().divideScalar(initialSpeed);
      // Projection of force onto travel vector: positive = accelerating along travel vector; negative = braking
      const fParallel = force.dot(travelDir);

      if (initialSpeed >= baseSpeedLimit) {
        // Ship is over or at the base speed limit (>= 320 m/s)
        if (!boostEngaged) {
          // Without forward boost, you CANNOT keep acceleration into the same vector you're traveling!
          // Remove any force component pushing in the direction of velocity (fParallel > 0)
          if (fParallel > 0) {
            force.addScaledVector(travelDir, -fParallel);
          }
        } else {
          // With forward boost engaged, you can accelerate into the travel vector up to 500 m/s
          if (initialSpeed >= this.specs.maxBoostSpeed) {
            // At or over boost speed limit: cannot accelerate further into travel vector
            if (fParallel > 0) {
              force.addScaledVector(travelDir, -fParallel);
            }
          } else if (fParallel > 0) {
            // Approaching boost speed limit: clamp parallel force so this step cannot exceed maxBoostSpeed
            const maxDeltaV = Math.max(0, this.specs.maxBoostSpeed - initialSpeed);
            const maxAllowedF = (maxDeltaV * state.mass) / delta;
            if (fParallel > maxAllowedF) {
              force.addScaledVector(travelDir, -(fParallel - maxAllowedF));
            }
          }
        }
      } else if (!boostEngaged && fParallel > 0) {
        // Under 320 m/s without boost: prevent unboosted thrust from pushing past 320 m/s in this step
        const maxDeltaV = Math.max(0, baseSpeedLimit - initialSpeed);
        const maxAllowedF = (maxDeltaV * state.mass) / delta;
        if (fParallel > maxAllowedF) {
          force.addScaledVector(travelDir, -(fParallel - maxAllowedF));
        }
      }
    }

    // Acceleration a = F / m
    this.accel.copy(force).divideScalar(state.mass);

    // Compute G-force exerted on pilot: |a| / 9.81
    const gMagnitude = this.accel.length() / 9.81;
    const smoothedGForce = THREE.MathUtils.lerp(state.gForce, gMagnitude, delta * 12);

    // Integrate velocity v = v0 + a * dt
    this.vel.addScaledVector(this.accel, delta);

    // Enforce post-integration velocity bounds
    const newSpeed = this.vel.length();
    if (newSpeed > 0.01) {
      if (initialSpeed >= baseSpeedLimit && !boostEngaged) {
        // When over the speed limit without boost, speed along travel vector can never increase
        if (newSpeed > initialSpeed) {
          this.vel.setLength(initialSpeed);
        }
      } else if (!boostEngaged && newSpeed > baseSpeedLimit) {
        // Without boost, cannot exceed 320 m/s
        this.vel.setLength(baseSpeedLimit);
      } else if (newSpeed > this.specs.maxBoostSpeed) {
        // With boost, cannot exceed 500 m/s
        this.vel.setLength(this.specs.maxBoostSpeed);
      }
    }

    // Integrate position p = p0 + v * dt
    this.pos.addScaledVector(this.vel, delta);

    return {
      ...state,
      position: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
      velocity: { x: this.vel.x, y: this.vel.y, z: this.vel.z },
      rotation: { x: this.rot.x, y: this.rot.y, z: this.rot.z, w: this.rot.w },
      angularVelocity: { x: this.angVel.x, y: this.angVel.y, z: this.angVel.z },
      throttle: Math.abs(this.smoothedSurge),
      boostActive: boostEngaged,
      speedLimit: activeSpeedLimit,
      currentSpeed: this.vel.length(),
      gForce: smoothedGForce,
    };
  }

  /**
   * Star Citizen Predicted Impact Point (Lead PIP) Ballistics Calculator:
   * 
   * Given:
   *   P_target = target position
   *   V_target = target velocity
   *   P_shooter = shooter position (or weapon hardpoint)
   *   V_shooter = shooter velocity
   *   s = projectile muzzle speed (projectiles inherit V_shooter)
   * 
   * Relative displacement: D = P_target - P_shooter
   * Relative velocity: V_rel = V_target - V_shooter
   * 
   * The projectile's net velocity in space is V_shooter + s * UnitDirection
   * So projectile displacement at time t is:
   *   P_proj(t) = P_shooter + (V_shooter + s * Dir) * t
   * 
   * Target position at time t is:
   *   P_target(t) = P_target + V_target * t
   * 
   * At intercept:
   *   P_proj(t) = P_target(t)
   *   P_shooter + V_shooter * t + (s * Dir) * t = P_target + V_target * t
   *   (s * Dir) * t = (P_target - P_shooter) + (V_target - V_shooter) * t
   *   (s * Dir) * t = D + V_rel * t
   * 
   * Taking squared magnitude:
   *   s^2 * t^2 = |D + V_rel * t|^2
   *   s^2 * t^2 = D.D + 2(D . V_rel) * t + (V_rel . V_rel) * t^2
   * 
   * Standard Quadratic:
   *   A * t^2 + B * t + C = 0
   *   Where:
   *     A = (V_rel . V_rel) - s^2
   *     B = 2 * (D . V_rel)
   *     C = D . D
   * 
   * True gun aim unit vector:
   *   u = (D + V_rel * t) / (s * t)
   * Aim point at target distance R = |D|:
   *   P_aim = P_shooter + u * R
   * Predicted future target impact point:
   *   P_impact = P_target + V_target * t
   */
  public static calculateLeadPIP(
    shooterPos: Vector3D,
    shooterVel: Vector3D,
    targetPos: Vector3D,
    targetVel: Vector3D,
    projectileSpeed: number
  ): { leadPoint: Vector3D | null; impactPoint: Vector3D | null; timeToIntercept: number; aimDirection: Vector3D | null } {
    const Dx = targetPos.x - shooterPos.x;
    const Dy = targetPos.y - shooterPos.y;
    const Dz = targetPos.z - shooterPos.z;
    const dist = Math.hypot(Dx, Dy, Dz);

    if (dist < 0.1) {
      return { leadPoint: targetPos, impactPoint: targetPos, timeToIntercept: 0, aimDirection: { x: 0, y: 0, z: -1 } };
    }

    const Vrx = targetVel.x - shooterVel.x;
    const Vry = targetVel.y - shooterVel.y;
    const Vrz = targetVel.z - shooterVel.z;

    const A = (Vrx * Vrx + Vry * Vry + Vrz * Vrz) - (projectileSpeed * projectileSpeed);
    const B = 2 * (Dx * Vrx + Dy * Vry + Dz * Vrz);
    const C = Dx * Dx + Dy * Dy + Dz * Dz;

    const discriminant = B * B - 4 * A * C;

    if (discriminant < 0) {
      // Target is moving faster than projectile can intercept
      return { leadPoint: null, impactPoint: null, timeToIntercept: 0, aimDirection: null };
    }

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-B - sqrtDisc) / (2 * A);
    const t2 = (-B + sqrtDisc) / (2 * A);

    let t = -1;
    if (t1 > 0 && t2 > 0) {
      t = Math.min(t1, t2);
    } else if (t1 > 0) {
      t = t1;
    } else if (t2 > 0) {
      t = t2;
    }

    if (t <= 0 || !isFinite(t) || t > 10.0) {
      // No positive intercept within 10 seconds
      return { leadPoint: null, impactPoint: null, timeToIntercept: 0, aimDirection: null };
    }

    // Impact point where projectile meets the target
    const impactPoint: Vector3D = {
      x: targetPos.x + targetVel.x * t,
      y: targetPos.y + targetVel.y * t,
      z: targetPos.z + targetVel.z * t,
    };

    // Gun aiming vector (u) required so that projectile (with shooter velocity + muzzle speed * u)
    // hits the future target position
    const aimVecX = Dx + Vrx * t;
    const aimVecY = Dy + Vry * t;
    const aimVecZ = Dz + Vrz * t;
    const aimLen = Math.hypot(aimVecX, aimVecY, aimVecZ);

    if (aimLen < 0.0001) {
      return { leadPoint: impactPoint, impactPoint, timeToIntercept: t, aimDirection: { x: 0, y: 0, z: -1 } };
    }

    const ux = aimVecX / aimLen;
    const uy = aimVecY / aimLen;
    const uz = aimVecZ / aimLen;

    // The Lead Point along the shooter's line of sight to project onto the HUD:
    const leadPoint: Vector3D = {
      x: shooterPos.x + ux * dist,
      y: shooterPos.y + uy * dist,
      z: shooterPos.z + uz * dist,
    };

    return {
      leadPoint,
      impactPoint,
      timeToIntercept: t,
      aimDirection: { x: ux, y: uy, z: uz },
    };
  }
}
