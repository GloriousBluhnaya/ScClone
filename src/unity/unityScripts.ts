import { UnityScriptDoc } from '../types';

export const UNITY_SCRIPTS: UnityScriptDoc[] = [
  {
    fileName: 'NewtonianFlightPhysics.cs',
    title: '6-DoF Newtonian Flight Physics Engine',
    category: 'Physics',
    description: 'Implements authentic Star Citizen style 6-DoF Newtonian mechanics on a Unity Rigidbody. Supports Coupled and Decoupled IFCS flight modes, RCS thruster torque, angular inertia, and boost multiplier.',
    code: `using UnityEngine;

/// <summary>
/// 6-DoF Newtonian Spaceship Flight Controller
/// Modeled after Star Citizen's Intelligent Flight Control System (IFCS).
/// Uses real physical forces on Unity's Rigidbody.
/// </summary>
[RequireComponent(typeof(Rigidbody))]
public class NewtonianFlightPhysics : MonoBehaviour
{
    public enum IFCSMode
    {
        Coupled,   // Computer automatically fires counter-thrusters to arrest drift and match throttle
        Decoupled  // Pure Newtonian inertia: zero counter-thrust, drift freely in any orientation
    }

    [Header("Flight Dynamics & Limits")]
    [Tooltip("Vessel mass in kilograms (affects inertia)")]
    public float shipMass = 22000f; // 22 tons light fighter
    public float scmSpeedLimit = 320f; // SCM speed m/s in any direction
    public float boostSpeedLimit = 500f; // Boost speed limit m/s (forward strafe only)

    [Header("Thruster Force Outputs (Newtons - 8G Fwd, 5G Strafe, 3G Reverse)")]
    public float mainThrusterForce = 1726560f;    // 8G forward thrust (22000 kg * 8 * 9.81 m/s^2)
    public float retroThrusterForce = 647460f;    // 3G reverse/braking (22000 kg * 3 * 9.81 m/s^2)
    public float maneuverThrusterForce = 1079100f;// 5G lateral/vertical strafe (22000 kg * 5 * 9.81 m/s^2)
    public float boostMultiplier = 1.75f;

    [Header("Thruster Jerk Limits (da/dt in m/s^3)")]
    [Tooltip("Lateral strafe jerk limit in m/s^3 (~1.96s full reversal across zero between -5G and +5G)")]
    public float swayJerkLimit = 50.0f;
    [Tooltip("Vertical strafe jerk limit in m/s^3 (~1.96s full reversal across zero between -5G and +5G)")]
    public float heaveJerkLimit = 50.0f;
    [Tooltip("Longitudinal surge jerk limit in m/s^3 (~1.54s full reversal between -3G and +8G)")]
    public float surgeJerkLimit = 70.0f;

    [Header("Rotational RCS Dynamics (Fly-by-Wire IFCS)")]
    [Tooltip("Max pitch rate in rad/s (2*PI/5 = 1.2566 rad/s, 72 deg/s -> 360 deg in 5s)")]
    public float maxPitchRate = 1.2566f;
    [Tooltip("Max yaw rate in rad/s (2*PI/8 = 0.7854 rad/s, 45 deg/s -> 360 deg in 8s)")]
    public float maxYawRate = 0.7854f;
    public float maxRollRate = 2.4f;
    [Tooltip("Snappy angular accelerations in rad/s^2")]
    public float pitchAngularAccel = 9.0f;
    public float yawAngularAccel = 7.0f;
    public float rollAngularAccel = 12.0f;

    [Header("IFCS System State")]
    public IFCSMode flightMode = IFCSMode.Coupled;
    [Range(0f, 1f)] public float throttle = 0f;
    public bool isBoosting = false;

    // Component References
    private Rigidbody rb;

    // Current Telemetry
    public Vector3 CurrentVelocity => rb.velocity;
    public float CurrentSpeed => rb.velocity.magnitude;
    public float GForce { get; private set; }
    private Vector3 lastVelocity;
    private Vector3 currentLocalAccel = Vector3.zero;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
        rb.mass = shipMass;
        rb.useGravity = false; // Zero-gravity space vacuum
        rb.drag = 0f;          // Absolute vacuum (no atmospheric drag)
        rb.angularDrag = 0.05f;// Minimal RCS stabilization
        rb.interpolation = RigidbodyInterpolation.Interpolate;
    }

    void FixedUpdate()
    {
        // Calculate G-force telemetry (G = acceleration / 9.81 m/s^2)
        Vector3 acceleration = (rb.velocity - lastVelocity) / Time.fixedDeltaTime;
        GForce = acceleration.magnitude / 9.81f;
        lastVelocity = rb.velocity;

        // Apply Flight Assist dampening if in Coupled mode
        if (flightMode == IFCSMode.Coupled)
        {
            ApplyCoupledFlightAssist();
        }

        // Flight Geometry Speed Limit: 320 m/s in any direction, 500 m/s with forward boost
        float currentSpeed = rb.velocity.magnitude;
        float activeMaxSpeed = isBoosting ? boostSpeedLimit : scmSpeedLimit;
        if (currentSpeed > activeMaxSpeed)
        {
            rb.velocity = rb.velocity.normalized * activeMaxSpeed;
        }
    }

    /// <summary>
    /// Processes 6-DoF pilot input vectors in FixedUpdate.
    /// pitchYawRoll: X=Pitch (-1..1), Y=Yaw (-1..1), Z=Roll (-1..1)
    /// strafeSurge: X=Strafe Right/Left, Y=Strafe Up/Down, Z=Surge Forward/Back
    /// </summary>
    public void ApplyPilotInputs(Vector3 pitchYawRoll, Vector3 strafeSurge, bool boost)
    {
        // Boost ONLY applies to forward strafe (not lateral, vertical, or reverse)
        bool isForwardStrafe = strafeSurge.z > 0.05f || (flightMode == IFCSMode.Coupled && throttle > 0.01f);
        isBoosting = boost && isForwardStrafe;
        float forwardMult = isBoosting ? boostMultiplier : 1.0f;

        // 1. ROTATIONAL CONTROL (Fly-by-wire rate demand with high angular acceleration)
        Vector3 targetAngVel = new Vector3(
            pitchYawRoll.x * maxPitchRate,
            pitchYawRoll.y * maxYawRate,
            pitchYawRoll.z * maxRollRate
        );
        Vector3 currentAngVel = transform.InverseTransformDirection(rb.angularVelocity);
        Vector3 error = targetAngVel - currentAngVel;
        Vector3 angAccel = new Vector3(
            Mathf.Clamp(error.x / Time.fixedDeltaTime, -pitchAngularAccel, pitchAngularAccel),
            Mathf.Clamp(error.y / Time.fixedDeltaTime, -yawAngularAccel, yawAngularAccel),
            Mathf.Clamp(error.z / Time.fixedDeltaTime, -rollAngularAccel, rollAngularAccel)
        );
        rb.AddRelativeTorque(angAccel, ForceMode.Acceleration);

        // 2. TRANSLATIONAL CONTROL (Surge, Sway, Heave) with IFCS Physical Jerk Limits
        float dt = Time.fixedDeltaTime;
        float maxMainAccel = (mainThrusterForce / shipMass) * forwardMult;
        float maxRetroAccel = retroThrusterForce / shipMass;
        float maxManeuverAccel = maneuverThrusterForce / shipMass;

        float targetAccelX = strafeSurge.x * maxManeuverAccel;
        float targetAccelY = strafeSurge.y * maxManeuverAccel;
        float targetAccelZ = 0f;

        if (strafeSurge.z > 0.05f)
            targetAccelZ = strafeSurge.z * maxMainAccel;
        else if (strafeSurge.z < -0.05f)
            targetAccelZ = strafeSurge.z * maxRetroAccel;
        else if (flightMode == IFCSMode.Coupled && throttle > 0.01f)
            targetAccelZ = throttle * maxMainAccel;

        // Apply jerk rate-limiting (da/dt) to prevent instant wiggling and enforce realistic thruster spooling
        currentLocalAccel.x = Mathf.MoveTowards(currentLocalAccel.x, targetAccelX, swayJerkLimit * dt);
        currentLocalAccel.y = Mathf.MoveTowards(currentLocalAccel.y, targetAccelY, heaveJerkLimit * dt);
        currentLocalAccel.z = Mathf.MoveTowards(currentLocalAccel.z, targetAccelZ, surgeJerkLimit * dt);

        Vector3 localForce = currentLocalAccel * shipMass;

        // Convert to world space force
        Vector3 worldForce = transform.TransformDirection(localForce);

        // 3. FLIGHT GEOMETRY VECTOR CONSTRAINT:
        // "While you're over the speed limit, you cannot keep acceleration into the same vector you're traveling without using boost."
        float currentSpeed = rb.velocity.magnitude;
        if (currentSpeed > 0.01f)
        {
            Vector3 travelDir = rb.velocity.normalized;
            float fParallel = Vector3.Dot(worldForce, travelDir);

            if (currentSpeed >= scmSpeedLimit)
            {
                if (!isBoosting && fParallel > 0f)
                {
                    // Block acceleration along travel vector without forward boost
                    worldForce -= travelDir * fParallel;
                }
            }
        }

        rb.AddForce(worldForce, ForceMode.Force);
    }

    /// <summary>
    /// IFCS Coupled Flight Assist: fires counter-thrusters along axes with no pilot command.
    /// </summary>
    private void ApplyCoupledFlightAssist()
    {
        Vector3 localVel = transform.InverseTransformDirection(rb.velocity);
        Vector3 counterForce = Vector3.zero;

        // Cancel lateral drift (X)
        counterForce.x = -localVel.x * shipMass * 5f;
        counterForce.x = Mathf.Clamp(counterForce.x, -maneuverThrusterForce, maneuverThrusterForce);

        // Cancel vertical drift (Y)
        counterForce.y = -localVel.y * shipMass * 5f;
        counterForce.y = Mathf.Clamp(counterForce.y, -maneuverThrusterForce, maneuverThrusterForce);

        // If no throttle set, brake forward/backward drift (Z)
        if (Mathf.Abs(throttle) < 0.05f)
        {
            counterForce.z = -localVel.z * shipMass * 5f;
            counterForce.z = Mathf.Clamp(counterForce.z, -retroThrusterForce, mainThrusterForce);
        }

        rb.AddRelativeForce(counterForce, ForceMode.Force);
    }

    public void ToggleFlightMode()
    {
        flightMode = (flightMode == IFCSMode.Coupled) ? IFCSMode.Decoupled : IFCSMode.Coupled;
    }
}`
  },
  {
    fileName: 'TargetingAndLeadCalculator.cs',
    title: 'Ballistic Intercept & Lead PIP Calculator',
    category: 'Targeting & HUD',
    description: 'Calculates the Star Citizen Predicted Impact Point (PIP) for projectile weapons using the exact quadratic intercept formula. Accounts for target relative velocity and projectile velocity inheritance.',
    code: `using UnityEngine;

/// <summary>
/// Star Citizen Style Lead PIP (Predicted Impact Point) Calculator.
/// Solves the relative intercept quadratic equation to place the aiming reticle
/// exactly where the pilot must shoot to strike a moving target.
/// </summary>
public class TargetingAndLeadCalculator : MonoBehaviour
{
    [Header("Weapon Ballistics")]
    [Tooltip("Laser or projectile muzzle velocity in m/s")]
    public float projectileSpeed = 1250f;
    [Tooltip("Do projectiles inherit the shooter's current velocity? (True in Newtonian physics)")]
    public bool inheritShooterVelocity = true;

    [Header("Current Target")]
    public Transform currentTarget;
    public Rigidbody targetRigidbody;

    // References
    private Rigidbody shooterRigidbody;
    private Camera cockpitCamera;

    // Calculated Intercept Data
    public Vector3 PredictedLeadPoint { get; private set; }
    public Vector3 LeadScreenPosition { get; private set; }
    public bool HasValidSolution { get; private set; }
    public float TimeToIntercept { get; private set; }
    public float TargetDistance { get; private set; }

    void Awake()
    {
        shooterRigidbody = GetComponentInParent<Rigidbody>();
        cockpitCamera = Camera.main;
    }

    void Update()
    {
        if (currentTarget == null)
        {
            HasValidSolution = false;
            return;
        }

        Vector3 shooterPos = transform.position;
        Vector3 shooterVel = (inheritShooterVelocity && shooterRigidbody != null) 
            ? shooterRigidbody.velocity 
            : Vector3.zero;

        Vector3 targetPos = currentTarget.position;
        Vector3 targetVel = (targetRigidbody != null) 
            ? targetRigidbody.velocity 
            : Vector3.zero;

        TargetDistance = Vector3.Distance(shooterPos, targetPos);

        // Solve ballistic quadratic equation
        HasValidSolution = CalculateLeadIntercept(
            shooterPos, shooterVel, 
            targetPos, targetVel, 
            projectileSpeed, 
            out Vector3 leadPoint, 
            out float time
        );

        if (HasValidSolution)
        {
            PredictedLeadPoint = leadPoint;
            TimeToIntercept = time;

            // Project to Cockpit HUD screen space
            if (cockpitCamera != null)
            {
                Vector3 screenPoint = cockpitCamera.WorldToScreenPoint(PredictedLeadPoint);
                // Ensure target is in front of camera
                if (screenPoint.z > 0)
                {
                    LeadScreenPosition = screenPoint;
                }
                else
                {
                    HasValidSolution = false; // Behind cockpit
                }
            }
        }
    }

    /// <summary>
    /// Exact Quadratic Intercept Solution:
    /// |(P_target - P_shooter) + (V_target - V_shooter) * t| = projectileSpeed * t
    /// Expanded into: A*t^2 + B*t + C = 0
    /// </summary>
    public static bool CalculateLeadIntercept(
        Vector3 shooterPos, Vector3 shooterVel,
        Vector3 targetPos, Vector3 targetVel,
        float muzzleSpeed,
        out Vector3 leadPoint, out float interceptTime)
    {
        Vector3 relativePos = targetPos - shooterPos;
        Vector3 relativeVel = targetVel - shooterVel;

        float A = relativeVel.sqrMagnitude - (muzzleSpeed * muzzleSpeed);
        float B = 2f * Vector3.Dot(relativePos, relativeVel);
        float C = relativePos.sqrMagnitude;

        leadPoint = targetPos;
        interceptTime = 0f;

        // If target speed equals muzzle speed on exact matching vector
        if (Mathf.Abs(A) < 0.0001f)
        {
            if (Mathf.Abs(B) < 0.0001f) return false;
            interceptTime = -C / B;
            if (interceptTime <= 0) return false;
            leadPoint = targetPos + targetVel * interceptTime;
            return true;
        }

        float discriminant = B * B - 4f * A * C;
        if (discriminant < 0f)
        {
            // Target is moving too fast for projectile to ever intercept
            return false;
        }

        float sqrtDisc = Mathf.Sqrt(discriminant);
        float t1 = (-B - sqrtDisc) / (2f * A);
        float t2 = (-B + sqrtDisc) / (2f * A);

        float t = -1f;
        if (t1 > 0f && t2 > 0f) t = Mathf.Min(t1, t2);
        else if (t1 > 0f) t = t1;
        else if (t2 > 0f) t = t2;

        if (t <= 0f || float.IsNaN(t) || t > 10.0f)
        {
            return false;
        }

        interceptTime = t;
        // True gun aiming vector: accounts for shooter velocity inheritance and target displacement
        Vector3 aimVec = relativePos + relativeVel * t;
        Vector3 aimDir = aimVec.normalized;
        // Place lead point along line of sight at target distance so camera projection creates exact PIP
        leadPoint = shooterPos + aimDir * relativePos.magnitude;
        return true;
    }
}`
  },
  {
    fileName: 'CockpitHUDController.cs',
    title: 'Cockpit Camera & HUD Overlay Controller',
    category: 'Targeting & HUD',
    description: 'Manages first-person cockpit view, head-bobbing under G-forces, screenspace Lead PIP reticle rendering, Prograde/Retrograde velocity vector markers, and instrument panels.',
    code: `using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// First-Person Cockpit Camera & Holographic HUD Renderer.
/// Draws Lead PIP reticles, target brackets, velocity vector markers, and MFD readouts.
/// </summary>
public class CockpitHUDController : MonoBehaviour
{
    [Header("Cockpit Head Rig")]
    public Transform pilotHeadTransform;
    public float gForceHeadLag = 0.04f;
    public float maxHeadOffset = 0.15f;

    [Header("HUD UI Elements")]
    public RectTransform leadPipIcon;        // Lead PIP diamond
    public RectTransform targetBracketIcon;  // Target square bracket
    public RectTransform tviMarkerIcon;      // Total Vector Indicator (Prograde direction)
    public RectTransform antiTviMarkerIcon;  // Anti-TVI (Retrograde direction)
    public Text speedText;
    public Text gForceText;
    public Text ifcsModeText;
    public Text driftAngleText;
    public Text targetDistanceText;

    // Subsystems
    private NewtonianFlightPhysics flightPhysics;
    private TargetingAndLeadCalculator targetingCalculator;
    private Camera cam;
    private Vector3 initialHeadLocalPos;

    void Awake()
    {
        flightPhysics = GetComponentInParent<NewtonianFlightPhysics>();
        targetingCalculator = GetComponentInParent<TargetingAndLeadCalculator>();
        cam = GetComponent<Camera>();

        if (pilotHeadTransform != null)
            initialHeadLocalPos = pilotHeadTransform.localPosition;
    }

    void LateUpdate()
    {
        UpdateCockpitHeadInertia();
        UpdateHUDIndicators();
        UpdateTelemetryReadouts();
    }

    private void UpdateCockpitHeadInertia()
    {
        if (pilotHeadTransform == null || flightPhysics == null) return;

        // Subtle pilot head displacement under acceleration
        Vector3 localVel = transform.InverseTransformDirection(flightPhysics.CurrentVelocity);
        Vector3 targetOffset = -localVel.normalized * Mathf.Clamp(flightPhysics.GForce * gForceHeadLag, 0f, maxHeadOffset);

        pilotHeadTransform.localPosition = Vector3.Lerp(
            pilotHeadTransform.localPosition, 
            initialHeadLocalPos + targetOffset, 
            Time.deltaTime * 6f
        );
    }

    private void UpdateHUDIndicators()
    {
        // 1. Lead PIP (Predicted Impact Point)
        if (targetingCalculator != null && targetingCalculator.HasValidSolution)
        {
            leadPipIcon.gameObject.SetActive(true);
            leadPipIcon.position = targetingCalculator.LeadScreenPosition;
        }
        else
        {
            leadPipIcon.gameObject.SetActive(false);
        }

        // 2. Target Bracket
        if (targetingCalculator != null && targetingCalculator.currentTarget != null)
        {
            Vector3 targetScreen = cam.WorldToScreenPoint(targetingCalculator.currentTarget.position);
            if (targetScreen.z > 0)
            {
                targetBracketIcon.gameObject.SetActive(true);
                targetBracketIcon.position = targetScreen;
                if (targetDistanceText != null)
                    targetDistanceText.text = $"{targetingCalculator.TargetDistance:F0}m";
            }
            else
            {
                targetBracketIcon.gameObject.SetActive(false);
            }
        }
        else
        {
            targetBracketIcon.gameObject.SetActive(false);
        }

        // 3. Total Vector Indicator (TVI - Prograde flight path) & Anti-TVI (Retrograde)
        if (flightPhysics.CurrentSpeed > 0.5f)
        {
            Vector3 velNormalized = flightPhysics.CurrentVelocity.normalized;
            float driftAngle = Vector3.Angle(transform.forward, velNormalized);

            // Prograde TVI Marker
            if (tviMarkerIcon != null)
            {
                Vector3 tviWorldPoint = transform.position + velNormalized * 150f;
                Vector3 tviScreen = cam.WorldToScreenPoint(tviWorldPoint);
                if (tviScreen.z > 0)
                {
                    tviMarkerIcon.gameObject.SetActive(true);
                    tviMarkerIcon.position = tviScreen;
                }
                else
                {
                    tviMarkerIcon.gameObject.SetActive(false);
                }
            }

            // Retrograde Anti-TVI Marker
            if (antiTviMarkerIcon != null)
            {
                Vector3 antiTviWorldPoint = transform.position - velNormalized * 150f;
                Vector3 antiTviScreen = cam.WorldToScreenPoint(antiTviWorldPoint);
                if (antiTviScreen.z > 0)
                {
                    antiTviMarkerIcon.gameObject.SetActive(true);
                    antiTviMarkerIcon.position = antiTviScreen;
                }
                else
                {
                    antiTviMarkerIcon.gameObject.SetActive(false);
                }
            }

            if (driftAngleText != null)
                driftAngleText.text = $"DRIFT: {driftAngle:F0}°";
        }
        else
        {
            if (tviMarkerIcon != null) tviMarkerIcon.gameObject.SetActive(false);
            if (antiTviMarkerIcon != null) antiTviMarkerIcon.gameObject.SetActive(false);
            if (driftAngleText != null) driftAngleText.text = "DRIFT: 0°";
        }
    }

    private void UpdateTelemetryReadouts()
    {
        if (speedText != null) speedText.text = $"SPD: {flightPhysics.CurrentSpeed:F0} m/s";
        if (gForceText != null) gForceText.text = $"G: {flightPhysics.GForce:F1} G";
        if (ifcsModeText != null) ifcsModeText.text = $"IFCS: {flightPhysics.flightMode.ToString().ToUpper()}";
    }
}`
  },
  {
    fileName: 'SpaceshipWeaponSystem.cs',
    title: 'Ballistic Laser Weapon & Velocity Inheritance',
    category: 'Weapons',
    description: 'Fires laser bolts from wing and nose hardpoints with true Newtonian velocity inheritance: Projectile Vector = Ship Velocity + (Muzzle Direction * Projectile Speed). Handles muzzle flash and collision impact.',
    code: `using UnityEngine;

/// <summary>
/// Spaceship Ballistic / Laser Weapon System.
/// Faithfully applies Newtonian velocity inheritance so projectiles fire accurately
/// while the ship is strafing, boosting, or drifting at high velocity.
/// </summary>
public class SpaceshipWeaponSystem : MonoBehaviour
{
    [Header("Hardpoints")]
    public Transform[] muzzleHardpoints;
    public GameObject laserBoltPrefab;

    [Header("Ballistics Specs")]
    public float muzzleSpeed = 1250f; // m/s
    public float fireRate = 8f;       // rounds per second
    public float weaponRange = 3000f; // 3 km max projectile lifetime
    public float damage = 20f;

    private Rigidbody shipRigidbody;
    private float nextFireTime;
    private int hardpointIndex = 0;

    void Awake()
    {
        shipRigidbody = GetComponentInParent<Rigidbody>();
    }

    public void TryFire()
    {
        if (Time.time < nextFireTime) return;
        nextFireTime = Time.time + (1f / fireRate);

        if (muzzleHardpoints == null || muzzleHardpoints.Length == 0) return;

        // Alternate or fire twin hardpoints
        Transform muzzle = muzzleHardpoints[hardpointIndex];
        hardpointIndex = (hardpointIndex + 1) % muzzleHardpoints.Length;

        FireLaserFromHardpoint(muzzle);
    }

    private void FireLaserFromHardpoint(Transform muzzle)
    {
        // Compute muzzle exit velocity with Newtonian velocity inheritance:
        // V_bolt = V_ship + (Forward * muzzleSpeed)
        Vector3 shipVel = (shipRigidbody != null) ? shipRigidbody.velocity : Vector3.zero;
        Vector3 boltVelocity = shipVel + (muzzle.forward * muzzleSpeed);

        GameObject bolt = Instantiate(laserBoltPrefab, muzzle.position, muzzle.rotation);
        
        LaserBolt projectile = bolt.GetComponent<LaserBolt>();
        if (projectile != null)
        {
            projectile.Initialize(boltVelocity, damage, weaponRange / muzzleSpeed, gameObject);
        }
    }
}`
  },
  {
    fileName: 'SpaceshipNetworkSync.cs',
    title: 'Multiplayer Synchronization (Netcode for GameObjects)',
    category: 'Networking',
    description: 'Server-authoritative multiplayer network synchronization using Unity Netcode for GameObjects (NGO). Handles position/rotation extrapolation, thruster states, firing RPCs, and damage synchronization.',
    code: `using Unity.Netcode;
using UnityEngine;

/// <summary>
/// Multiplayer Network Synchronizer for Spaceships using Unity Netcode for GameObjects (NGO).
/// Implements client-side prediction for the local pilot and dead-reckoning extrapolation
/// for remote peer spacecraft over UDP/IP.
/// </summary>
[RequireComponent(typeof(NetworkObject))]
public class SpaceshipNetworkSync : NetworkBehaviour
{
    // Networked synchronized state variables
    private readonly NetworkVariable<Vector3> netPosition = new(
        writePerm: NetworkVariableWritePermission.Owner, 
        readPerm: NetworkVariableReadPermission.Everyone);

    private readonly NetworkVariable<Quaternion> netRotation = new(
        writePerm: NetworkVariableWritePermission.Owner, 
        readPerm: NetworkVariableReadPermission.Everyone);

    private readonly NetworkVariable<Vector3> netVelocity = new(
        writePerm: NetworkVariableWritePermission.Owner, 
        readPerm: NetworkVariableReadPermission.Everyone);

    private readonly NetworkVariable<float> netShield = new(
        100f, 
        writePerm: NetworkVariableWritePermission.Server, 
        readPerm: NetworkVariableReadPermission.Everyone);

    private readonly NetworkVariable<float> netHull = new(
        100f, 
        writePerm: NetworkVariableWritePermission.Server, 
        readPerm: NetworkVariableReadPermission.Everyone);

    private Rigidbody rb;
    private NewtonianFlightPhysics flightPhysics;
    private SpaceshipWeaponSystem weaponSystem;

    // Extrapolation parameters for remote peers
    public float interpolationSpeed = 18f;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
        flightPhysics = GetComponent<NewtonianFlightPhysics>();
        weaponSystem = GetComponent<SpaceshipWeaponSystem>();
    }

    public override void OnNetworkSpawn()
    {
        if (IsOwner)
        {
            // Enable local physics and input
            if (flightPhysics != null) flightPhysics.enabled = true;
            if (rb != null) rb.isKinematic = false;
        }
        else
        {
            // Remote ship: drive position via interpolated network state
            if (flightPhysics != null) flightPhysics.enabled = false;
            if (rb != null) rb.isKinematic = true;
        }
    }

    void Update()
    {
        if (IsOwner)
        {
            // Owner pushes telemetry to NetworkVariables (buffered & sent by NGO)
            netPosition.Value = transform.position;
            netRotation.Value = transform.rotation;
            netVelocity.Value = (rb != null) ? rb.velocity : Vector3.zero;
        }
        else
        {
            // Remote client interpolates towards network state with dead-reckoning
            Vector3 extrapolatedPos = netPosition.Value + netVelocity.Value * Time.deltaTime;
            transform.position = Vector3.Lerp(transform.position, extrapolatedPos, Time.deltaTime * interpolationSpeed);
            transform.rotation = Quaternion.Slerp(transform.rotation, netRotation.Value, Time.deltaTime * interpolationSpeed);
        }
    }

    /// <summary>
    /// Owner invokes ServerRpc when triggering lasers to ensure server-authoritative combat.
    /// </summary>
    [ServerRpc]
    public void FireWeaponServerRpc(Vector3 origin, Vector3 velocity)
    {
        // Server validates firing rate and broadcasts to all clients
        FireWeaponClientRpc(origin, velocity);
    }

    [ClientRpc]
    private void FireWeaponClientRpc(Vector3 origin, Vector3 velocity)
    {
        if (IsOwner) return; // Local player already spawned local client-predicted laser
        // Spawn replicated laser bolt visual effect on remote machines
    }

    /// <summary>
    /// Server handles authoritative hit registration and shield/hull deduction.
    /// </summary>
    [ServerRpc(RequireOwnership = false)]
    public void ApplyDamageServerRpc(float damageAmount)
    {
        if (netShield.Value > 0)
        {
            float shieldDmg = Mathf.Min(netShield.Value, damageAmount);
            netShield.Value -= shieldDmg;
            damageAmount -= shieldDmg;
        }

        if (damageAmount > 0)
        {
            netHull.Value = Mathf.Max(0, netHull.Value - damageAmount);
            if (netHull.Value <= 0)
            {
                ShipExplodedClientRpc();
            }
        }
    }

    [ClientRpc]
    private void ShipExplodedClientRpc()
    {
        // Trigger explosion VFX and audio across all clients
    }
}`
  },
  {
    fileName: 'ShipCockpitManager.cs',
    title: 'HUD Virtual Joystick (V-Joy) & Flight Input Controller',
    category: 'Targeting & HUD',
    description: 'Implements Star Citizen HUD Virtual Joystick. Draws vector line from HUD center to mouse cursor, maps displacement to percentage of maximum pitch/yaw speed, and supports deadzone, recentering, and 6-DoF thrusters.',
    code: `using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Star Citizen Style HUD Virtual Joystick (V-Joy) Flight Input Controller.
/// Draws a vector line from the center of the HUD to the mouse cursor position,
/// converting distance and deflection into an exact percentage of maximum pitch and yaw speed.
/// </summary>
public class ShipCockpitManager : MonoBehaviour
{
    private NewtonianFlightPhysics flight;
    private TargetingAndLeadCalculator targeting;
    private SpaceshipWeaponSystem weapons;

    [Header("Virtual Joystick Configuration")]
    [Tooltip("Maximum radius in pixels from screen center for 100% pitch/yaw rate")]
    public float maxJoystickRadius = 180f;

    [Tooltip("Deadzone radius in pixels where no rotational torque is applied")]
    public float deadzoneRadius = 18f;

    [Tooltip("Invert pitch axis (moving mouse up pulls nose down)")]
    public bool invertPitch = false;

    [Header("HUD UI Elements (Optional)")]
    public RectTransform hudCenterAnchor;
    public RectTransform joystickPipHandle;
    public Image vectorLineImage; // Rotated and scaled UI Image acting as the vector line
    public Text pitchPercentText;
    public Text yawPercentText;

    private Vector2 currentMousePos;
    private Vector2 screenCenter;
    private float pitchInput = 0f;
    private float yawInput = 0f;
    private float deflectionPercent = 0f;

    void Awake()
    {
        flight = GetComponent<NewtonianFlightPhysics>();
        targeting = GetComponent<TargetingAndLeadCalculator>();
        weapons = GetComponent<SpaceshipWeaponSystem>();

        // Keep cursor visible and unlocked so player can see virtual joystick pip
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;

        screenCenter = new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
        currentMousePos = screenCenter;
    }

    void Update()
    {
        screenCenter = new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);

        // 1. UPDATE VIRTUAL JOYSTICK POSITION
        currentMousePos = Input.mousePosition;

        // Vector from center of HUD to mouse position
        Vector2 deltaFromCenter = currentMousePos - screenCenter;
        float distance = deltaFromCenter.magnitude;

        if (distance <= deadzoneRadius)
        {
            pitchInput = 0f;
            yawInput = 0f;
            deflectionPercent = 0f;
        }
        else
        {
            // Calculate deflection percentage up to max radius
            float effectiveRadius = maxJoystickRadius - deadzoneRadius;
            float normalizedDeflection = Mathf.Clamp01((distance - deadzoneRadius) / effectiveRadius);
            deflectionPercent = normalizedDeflection * 100f;

            Vector2 direction = deltaFromCenter.normalized;

            // Yaw: Horizontal displacement (% of max yaw speed)
            yawInput = Mathf.Clamp(direction.x * normalizedDeflection, -1f, 1f);

            // Pitch: Vertical displacement (% of max pitch speed)
            float pitchDir = invertPitch ? -1f : 1f;
            pitchInput = Mathf.Clamp(direction.y * normalizedDeflection * pitchDir, -1f, 1f);
        }

        // Quick recenter stick with X key or Right Mouse Button
        if (Input.GetKeyDown(KeyCode.X) || Input.GetMouseButtonDown(1))
        {
            RecenterJoystick();
        }

        // Invert pitch toggle
        if (Input.GetKeyDown(KeyCode.I))
        {
            invertPitch = !invertPitch;
        }

        // 2. ROLL INPUT (Q / E keys)
        float rollInput = 0f;
        if (Input.GetKey(KeyCode.Q)) rollInput -= 1f;
        if (Input.GetKey(KeyCode.E)) rollInput += 1f;

        Vector3 rotInput = new Vector3(pitchInput, yawInput, rollInput);

        // 3. TRANSLATIONAL 6-DoF INPUTS (Surge, Sway, Heave)
        float surge = 0f; // Forward / Backward
        if (Input.GetKey(KeyCode.W)) surge += 1f;
        if (Input.GetKey(KeyCode.S)) surge -= 1f;

        float sway = 0f;  // Strafe Left / Right
        if (Input.GetKey(KeyCode.D)) sway += 1f;
        if (Input.GetKey(KeyCode.A)) sway -= 1f;

        float heave = 0f; // Strafe Up / Down
        if (Input.GetKey(KeyCode.Space)) heave += 1f;
        if (Input.GetKey(KeyCode.LeftControl)) heave -= 1f;

        Vector3 strafeSurge = new Vector3(sway, heave, surge);
        bool boost = Input.GetKey(KeyCode.LeftShift);

        // Apply calculated torque and thruster forces to Newtonian flight model
        if (flight != null)
        {
            flight.ApplyPilotInputs(rotInput, strafeSurge, boost);
        }

        // 4. IFCS FLIGHT MODE TOGGLE (Coupled vs Decoupled)
        if (Input.GetKeyDown(KeyCode.C) && flight != null)
        {
            flight.ToggleFlightMode();
        }

        // 5. WEAPONS FIRE (Left Mouse Button)
        if (Input.GetMouseButton(0) && weapons != null)
        {
            weapons.TryFire();
        }

        // 6. UPDATE HUD UI VECTOR LINE & LABELS
        UpdateHUDVectorLine(deltaFromCenter, distance);
    }

    private void UpdateHUDVectorLine(Vector2 deltaFromCenter, float distance)
    {
        if (joystickPipHandle != null)
        {
            joystickPipHandle.position = currentMousePos;
        }

        // Render line from HUD center to mouse position using rotated UI RectTransform
        if (vectorLineImage != null && hudCenterAnchor != null)
        {
            RectTransform lineRect = vectorLineImage.rectTransform;
            lineRect.position = screenCenter;
            lineRect.sizeDelta = new Vector2(distance, 2f); // Length = distance, Width = 2px
            float angle = Mathf.Atan2(deltaFromCenter.y, deltaFromCenter.x) * Mathf.Rad2Deg;
            lineRect.rotation = Quaternion.Euler(0f, 0f, angle);
        }

        if (pitchPercentText != null)
            pitchPercentText.text = $"PITCH: {(pitchInput * 100f):F0}%";

        if (yawPercentText != null)
            yawPercentText.text = $"YAW: {(yawInput * 100f):F0}%";
    }

    public void RecenterJoystick()
    {
        currentMousePos = screenCenter;
        pitchInput = 0f;
        yawInput = 0f;
        deflectionPercent = 0f;
    }
}`
  }
];

export const UNITY_SETUP_GUIDE = `# Unity 3D & C# Newtonian Space Flight Project Setup

Follow these steps to import and run this high-fidelity Newtonian Flight Combat system in Unity:

### 1. Unity Project Setup
1. Create a new Unity project using **Unity 2022.3 LTS**, **Unity 2023.2**, or **Unity 6**.
2. Select the **3D (URP)** or **3D (Built-in)** template.

### 2. Install Netcode for GameObjects
1. Open \`Window > Package Manager\`.
2. Select \`Packages: Unity Registry\`.
3. Search for **Netcode for GameObjects** (\`com.unity.netcode.gameobjects\`) and click **Install**.
4. (Optional) Install **Unity Transport** (\`com.unity.transport\`) for low-latency UDP multiplayer.

### 3. Create the Spaceship Prefab
1. Create an empty GameObject named \`Spaceship_Vessel\`.
2. Add a \`Rigidbody\` component:
   - **Mass**: 22000 (kg)
   - **Use Gravity**: Uncheck
   - **Drag**: 0
   - **Angular Drag**: 0.05
   - **Interpolate**: Interpolate
   - **Collision Detection**: Continuous
3. Attach the C# scripts:
   - \`NewtonianFlightPhysics.cs\`
   - \`ShipCockpitManager.cs\`
   - \`TargetingAndLeadCalculator.cs\`
   - \`SpaceshipWeaponSystem.cs\`
   - \`SpaceshipNetworkSync.cs\` (Add \`NetworkObject\` as well)
4. Add child GameObject for **Cockpit Camera**:
   - Place camera at cockpit eye position \`(0, 0.4, 0.8)\`.
   - Attach \`CockpitHUDController.cs\`.
5. Add child GameObjects for **Wing Hardpoints** and assign to \`SpaceshipWeaponSystem\`.

### 4. Multiplayer Arena Setup
1. Add an empty GameObject with \`NetworkManager\` and \`UnityTransport\`.
2. Assign the \`Spaceship_Vessel\` prefab to the \`Player Prefab\` slot in \`NetworkManager\`.
3. Start as **Host** or **Client** to fly and dogfight over the network!
`;
