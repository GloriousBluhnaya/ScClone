/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { NewtonianFlightEngine, DEFAULT_SPECS } from './physics/newtonianEngine';
import { CockpitCanvas } from './components/CockpitCanvas';
import { CockpitHUD } from './components/CockpitHUD';
import { UnityCodeStudio } from './components/UnityCodeStudio';
import { FlightControlsGuide } from './components/FlightControlsGuide';
import { DedicatedServerModal } from './components/DedicatedServerModal';
import { sounds } from './audio/soundFX';
import {
  ShipPhysicsState,
  ThrusterInputs,
  TargetInfo,
  LaserBolt,
  ExplosionEffect,
  RemoteShip,
  DuelRoomState,
  TVIInfo,
  KeyBindingsMap,
  KeyBindingItem,
  InputDeviceMode,
  FlightStickConfig,
} from './types';
import {
  loadKeybindings,
  saveKeybindings,
  resetKeybindings,
  doesCodeMatchAction,
} from './utils/keybindings';
import {
  loadInputDeviceMode,
  saveInputDeviceMode,
  loadFlightStickConfig,
  saveFlightStickConfig,
  DEFAULT_FLIGHT_STICK_CONFIG,
  readFlightStickInputs,
} from './utils/flightStickConfig';
import { normalizeShip, normalizeVector3D, normalizeQuaternionD } from './utils/shipNormalization';
import { Code2, HelpCircle, Users, Volume2, VolumeX, RotateCcw, Gamepad, Keyboard, Trophy, Swords, Copy, Check, Server, Wifi, Globe } from 'lucide-react';

export default function App() {
  // Subsystem instances
  const engineRef = useRef(new NewtonianFlightEngine(DEFAULT_SPECS));

  // Ship Physics & Controls State
  const [physicsState, setPhysicsState] = useState<ShipPhysicsState>(() =>
    engineRef.current.initShip({ x: 0, y: 0, z: 0 })
  );
  const physicsStateRef = useRef(physicsState);
  physicsStateRef.current = physicsState;

  // Pilot Input State
  const inputsRef = useRef<ThrusterInputs>({
    pitch: 0,
    yaw: 0,
    roll: 0,
    surge: 0,
    sway: 0,
    heave: 0,
    boost: false,
    primaryFire: false,
  });

  const mouseStick = useRef({ x: 0, y: 0 });
  const isPointerLocked = useRef(false);

  // Targets & 2-Ship Multiplayer State
  const [remoteShips, setRemoteShips] = useState<RemoteShip[]>([
    {
      id: 'ship-2',
      callsign: 'GLADIUS-BRAVO (P2)',
      isAI: false,
      position: { x: 200, y: 0, z: -400 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: -0.7071, z: 0, w: 0.7071 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      hull: 120,
      maxHull: 120,
      shield: 200,
      maxShield: 200,
      lastHit: 0,
      score: 0,
      targetId: null,
    },
  ]);
  const remoteShipsRef = useRef(remoteShips);
  remoteShipsRef.current = remoteShips;

  const [connectedPilotsCount, setConnectedPilotsCount] = useState(1);
  const [copiedLink, setCopiedLink] = useState(false);

  const [currentTargetId, setCurrentTargetId] = useState<string | null>(null);
  const [targetInfo, setTargetInfo] = useState<TargetInfo | null>(null);
  const [tviInfo, setTviInfo] = useState<TVIInfo | null>(null);

  // Virtual Joystick State
  const [virtualJoystick, setVirtualJoystick] = useState<{
    centerX: number;
    centerY: number;
    mouseX: number;
    mouseY: number;
    pitchPercent: number;
    yawPercent: number;
    deflectionPercent: number;
    pitchInput: number;
    yawInput: number;
    maxRadius: number;
    deadzoneRadius: number;
    circleOpacity: number;
    isActive: boolean;
    isInverted: boolean;
  }>(() => ({
    centerX: typeof window !== 'undefined' ? window.innerWidth / 2 : 600,
    centerY: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
    mouseX: typeof window !== 'undefined' ? window.innerWidth / 2 : 600,
    mouseY: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
    pitchPercent: 0,
    yawPercent: 0,
    deflectionPercent: 0,
    pitchInput: 0,
    yawInput: 0,
    maxRadius: 180,
    deadzoneRadius: 18,
    circleOpacity: 0.3,
    isActive: true,
    isInverted: false,
  }));
  const vjoyRef = useRef(virtualJoystick);
  vjoyRef.current = virtualJoystick;

  // Weapons & Particles
  const [localLasers, setLocalLasers] = useState<LaserBolt[]>([]);
  const [remoteLasers, setRemoteLasers] = useState<LaserBolt[]>([]);
  const [explosions, setExplosions] = useState<ExplosionEffect[]>([]);
  const [hitConfirmed, setHitConfirmed] = useState(false);

  // Player Stats
  const [playerHull, setPlayerHull] = useState(120);
  const [playerShield, setPlayerShield] = useState(200);
  const playerLastHitRef = useRef(0);
  const [playerIsDead, setPlayerIsDead] = useState(false);
  const playerIsDeadRef = useRef(false);
  playerIsDeadRef.current = playerIsDead;
  const [respawnCountdown, setRespawnCountdown] = useState(0);
  const [score, setScore] = useState(0);
  const [weaponCapacitor, setWeaponCapacitor] = useState(75);
  const weaponCapacitorRef = useRef(75);
  const weaponRechargingRef = useRef(false);

  // Networking & Modals
  const [localPlayerId, setLocalPlayerId] = useState<string>('pilot-local');
  const localPlayerIdRef = useRef(localPlayerId);
  localPlayerIdRef.current = localPlayerId;

  const [callsign, setCallsign] = useState<string>('GLADIUS-ALPHA');
  const [ping, setPing] = useState(14);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [isUnityModalOpen, setIsUnityModalOpen] = useState(false);
  const [isControlsModalOpen, setIsControlsModalOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const serverParam = urlParams.get('server');
      if (serverParam && serverParam.trim().length > 0) {
        localStorage.setItem('custom_ws_server', serverParam.trim());
        return serverParam.trim();
      }
      return localStorage.getItem('custom_ws_server') || '';
    }
    return '';
  });
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const isAudioMutedRef = useRef(isAudioMuted);
  isAudioMutedRef.current = isAudioMuted;

  // Keybindings & Peripheral Mode
  const [inputDeviceMode, setInputDeviceMode] = useState<InputDeviceMode>(() => loadInputDeviceMode());
  const inputDeviceModeRef = useRef(inputDeviceMode);
  inputDeviceModeRef.current = inputDeviceMode;

  const [flightStickConfig, setFlightStickConfig] = useState<FlightStickConfig>(() => loadFlightStickConfig());
  const flightStickConfigRef = useRef(flightStickConfig);
  flightStickConfigRef.current = flightStickConfig;

  const lastStickButtonsRef = useRef<{ toggleDecoupled: boolean; cycleTarget: boolean }>({
    toggleDecoupled: false,
    cycleTarget: false,
  });

  const [keybindings, setKeybindings] = useState<KeyBindingsMap>(() => loadKeybindings());
  const keybindingsRef = useRef(keybindings);
  keybindingsRef.current = keybindings;

  const isAnyModalOpenRef = useRef(false);
  isAnyModalOpenRef.current = isControlsModalOpen || isUnityModalOpen;

  // Active input codes (keys and mouse buttons physically pressed)
  const activeInputCodes = useRef<Set<string>>(new Set());
  // Tracks the most recently pressed direction for dual-axis actions (last-input priority / SOCD resolution)
  // This completely eliminates delays or 0-glitches when alternating strafes (Left/Right, Up/Down, Forward/Reverse)
  const lastAxisDirection = useRef<{
    sway: number;
    heave: number;
    surge: number;
    roll: number;
  }>({
    sway: 0,
    heave: 0,
    surge: 0,
    roll: 0,
  });
  const wheelSurgeActive = useRef<number>(0);
  const wheelTimeoutRef = useRef<number | null>(null);

  const recalculateContinuousInputs = useCallback(() => {
    const kb = keybindingsRef.current;
    const pressed = activeInputCodes.current;

    const isActionPressed = (action: KeyBindingItem | undefined) => {
      if (!action) return false;
      return (
        (!!action.primary && action.primary !== 'NONE' && pressed.has(action.primary)) ||
        (!!action.secondary && action.secondary !== 'NONE' && pressed.has(action.secondary))
      );
    };

    // 1. Lateral Strafe (Sway): Left / Right
    const rightActive = isActionPressed(kb.strafeRight);
    const leftActive = isActionPressed(kb.strafeLeft);
    if (rightActive && leftActive) {
      inputsRef.current.sway = lastAxisDirection.current.sway || 1;
    } else if (rightActive) {
      inputsRef.current.sway = 1;
      lastAxisDirection.current.sway = 1;
    } else if (leftActive) {
      inputsRef.current.sway = -1;
      lastAxisDirection.current.sway = -1;
    } else {
      inputsRef.current.sway = 0;
    }

    // 2. Vertical Strafe (Heave): Up / Down
    const upActive = isActionPressed(kb.strafeUp);
    const downActive = isActionPressed(kb.strafeDown);
    if (upActive && downActive) {
      inputsRef.current.heave = lastAxisDirection.current.heave || 1;
    } else if (upActive) {
      inputsRef.current.heave = 1;
      lastAxisDirection.current.heave = 1;
    } else if (downActive) {
      inputsRef.current.heave = -1;
      lastAxisDirection.current.heave = -1;
    } else {
      inputsRef.current.heave = 0;
    }

    // 3. Surge (Throttle Forward / Reverse)
    const fwdActive = isActionPressed(kb.throttleForward);
    const revActive = isActionPressed(kb.throttleReverse);
    if (fwdActive && revActive) {
      inputsRef.current.surge = lastAxisDirection.current.surge || 1;
    } else if (fwdActive) {
      inputsRef.current.surge = 1;
      lastAxisDirection.current.surge = 1;
    } else if (revActive) {
      inputsRef.current.surge = -1;
      lastAxisDirection.current.surge = -1;
    } else if (wheelSurgeActive.current !== 0) {
      inputsRef.current.surge = wheelSurgeActive.current;
    } else {
      inputsRef.current.surge = 0;
    }

    // 4. Roll (Left / Right)
    const rollRightActive = isActionPressed(kb.rollRight);
    const rollLeftActive = isActionPressed(kb.rollLeft);
    if (rollRightActive && rollLeftActive) {
      inputsRef.current.roll = lastAxisDirection.current.roll || 1;
    } else if (rollRightActive) {
      inputsRef.current.roll = 1;
      lastAxisDirection.current.roll = 1;
    } else if (rollLeftActive) {
      inputsRef.current.roll = -1;
      lastAxisDirection.current.roll = -1;
    } else {
      inputsRef.current.roll = 0;
    }

    // 5. Boost
    inputsRef.current.boost = isActionPressed(kb.boost);

    // 6. Primary Fire
    const isMouse0BoundToMovement =
      doesCodeMatchAction(kb.throttleForward, 'Mouse0') ||
      doesCodeMatchAction(kb.throttleReverse, 'Mouse0') ||
      doesCodeMatchAction(kb.strafeLeft, 'Mouse0') ||
      doesCodeMatchAction(kb.strafeRight, 'Mouse0') ||
      doesCodeMatchAction(kb.recenterVJoy, 'Mouse0');
      
    const isPrimaryFirePressed = isActionPressed(kb.primaryFire) || (pressed.has('Mouse0') && !isMouse0BoundToMovement);
    inputsRef.current.primaryFire = isPrimaryFirePressed;
  }, []);

  const handleSelectInputDeviceMode = useCallback((mode: InputDeviceMode) => {
    setInputDeviceMode(mode);
    inputDeviceModeRef.current = mode;
    saveInputDeviceMode(mode);
    // Clear active keys when switching modes
    activeInputCodes.current.clear();
    wheelSurgeActive.current = 0;
    if (mode === 'keyboard_mouse') {
      recalculateContinuousInputs();
    }
  }, [recalculateContinuousInputs]);

  const handleUpdateFlightStickConfig = useCallback((newConfig: FlightStickConfig) => {
    setFlightStickConfig(newConfig);
    flightStickConfigRef.current = newConfig;
    saveFlightStickConfig(newConfig);
  }, []);

  const handleResetFlightStickConfig = useCallback(() => {
    const defaults = { ...DEFAULT_FLIGHT_STICK_CONFIG };
    setFlightStickConfig(defaults);
    flightStickConfigRef.current = defaults;
    saveFlightStickConfig(defaults);
  }, []);

  const handleCopyLink = useCallback(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      let roomId = urlParams.get('room');
      if (!roomId) {
        roomId = 'duel-' + Math.random().toString(36).substring(2, 8);
      }
      const shareUrl = new URL(window.location.origin + window.location.pathname);
      shareUrl.searchParams.set('room', roomId);
      if (customServerUrl && customServerUrl.trim().length > 0) {
        shareUrl.searchParams.set('server', customServerUrl.trim());
      }
      navigator.clipboard.writeText(shareUrl.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, [customServerUrl]);

  const handleUpdateKeybindings = useCallback((newBindings: KeyBindingsMap) => {
    setKeybindings(newBindings);
    keybindingsRef.current = newBindings;
    saveKeybindings(newBindings);
    recalculateContinuousInputs();
  }, [recalculateContinuousInputs]);

  const handleResetKeybindings = useCallback(() => {
    const defaults = resetKeybindings();
    setKeybindings(defaults);
    keybindingsRef.current = defaults;
    recalculateContinuousInputs();
  }, [recalculateContinuousInputs]);

  useEffect(() => {
    if (isControlsModalOpen || isUnityModalOpen) {
      activeInputCodes.current.clear();
      wheelSurgeActive.current = 0;
      recalculateContinuousInputs();
    }
  }, [isControlsModalOpen, isUnityModalOpen, recalculateContinuousInputs]);

  // Auto-target connected opponent
  useEffect(() => {
    if (remoteShips.length > 0) {
      if (!currentTargetId || !remoteShips.some((s) => s.id === currentTargetId)) {
        setCurrentTargetId(remoteShips[0].id);
      }
    } else {
      setCurrentTargetId(null);
    }
  }, [remoteShips, currentTargetId]);

  const wsRef = useRef<WebSocket | null>(null);
  const lastFireTime = useRef(0);

  // 1. WEBSOCKET MULTIPLAYER SETUP
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    const serverParam = urlParams.get('server');

    if (serverParam && serverParam.trim().length > 0) {
      localStorage.setItem('custom_ws_server', serverParam.trim());
    }

    // Railway is the default multiplayer server in production.
    // A URL from the `server` query parameter or the Dedicated Server setting
    // still takes precedence, which preserves manual/custom-server support.
    const configuredServer =
      import.meta.env.VITE_GAME_SERVER_URL?.trim() ||
      (typeof window !== 'undefined' ? localStorage.getItem('custom_ws_server')?.trim() : null) ||
      '';

    const effectiveCustomServer = serverParam?.trim() || customServerUrl?.trim() || configuredServer;

    if (!roomId) {
      roomId = 'duel-' + Math.random().toString(36).substring(2, 8);
    }

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('room', roomId);
    if (effectiveCustomServer && effectiveCustomServer.trim().length > 0) {
      newUrl.searchParams.set('server', effectiveCustomServer.trim());
    } else {
      newUrl.searchParams.delete('server');
    }
    window.history.replaceState({}, '', newUrl.toString());

    let wsUrl = '';
    if (effectiveCustomServer && effectiveCustomServer.trim().length > 0) {
      const baseUrl = effectiveCustomServer.trim().replace(/\/+$/, '');
      const hasQuery = baseUrl.includes('?');
      wsUrl = `${baseUrl}${hasQuery ? '&' : '?'}room=${encodeURIComponent(roomId)}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}?room=${encodeURIComponent(roomId)}`;
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setCombatLog((prev) => ['Connected to 1v1 Space Duel Arena...', ...prev.slice(0, 15)]);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'init') {
          if (msg.playerId) {
            localPlayerIdRef.current = msg.playerId;
            setLocalPlayerId(msg.playerId);

            // Set local ship spawn position & rotation in 3D world
            if (msg.playerId === 'ship-1') {
              physicsStateRef.current = {
                ...physicsStateRef.current,
                position: { x: -200, y: 0, z: -400 },
                rotation: { x: 0, y: 0.7071, z: 0, w: 0.7071 },
              };
              setPhysicsState((prev) => ({
                ...prev,
                position: { x: -200, y: 0, z: -400 },
                rotation: { x: 0, y: 0.7071, z: 0, w: 0.7071 },
              }));
            } else if (msg.playerId === 'ship-2') {
              physicsStateRef.current = {
                ...physicsStateRef.current,
                position: { x: 200, y: 0, z: -400 },
                rotation: { x: 0, y: -0.7071, z: 0, w: 0.7071 },
              };
              setPhysicsState((prev) => ({
                ...prev,
                position: { x: 200, y: 0, z: -400 },
                rotation: { x: 0, y: -0.7071, z: 0, w: 0.7071 },
              }));
            }
          }
          if (msg.ships) {
            const activeLocalId = msg.playerId || localPlayerIdRef.current;
            const normalized = msg.ships
              .map(normalizeShip)
              .filter((s: RemoteShip) => s.id !== activeLocalId);
            setRemoteShips(normalized);
            setConnectedPilotsCount(msg.ships.filter((s: any) => s.isControlled).length || 1);
          }
        } else if (msg.type === 'ship:sync') {
          if (msg.ship && msg.ship.id !== localPlayerIdRef.current) {
            const normShip = normalizeShip(msg.ship);
            setRemoteShips((prev) => {
              const idx = prev.findIndex((s) => s.id === normShip.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...normShip };
                return updated;
              }
              return [...prev, normShip];
            });
          }
        } else if (msg.type === 'arena:snapshot') {
          if (msg.ships) {
            const normalized = msg.ships
              .map(normalizeShip)
              .filter((s: RemoteShip) => s.id !== localPlayerIdRef.current);
            setRemoteShips(normalized);
            setConnectedPilotsCount(msg.ships.filter((s: any) => s.isControlled).length || 1);
          }
        } else if (msg.type === 'weapon:fired') {
          if (msg.laser && msg.laser.shooterId !== localPlayerIdRef.current) {
            const origin = normalizeVector3D(msg.laser.origin);
            const velocity = normalizeVector3D(msg.laser.velocity);
            setRemoteLasers((prev) => [
              ...prev.filter((l) => Date.now() - l.createdAt < 2500),
              {
                id: msg.laser.id || 'lzr-' + Math.random(),
                shooterId: msg.laser.shooterId,
                position: origin,
                velocity: velocity,
                color: msg.laser.color || '#f59e0b',
                createdAt: Date.now(),
                lifeTime: 2.5,
              },
            ]);
            if (!isAudioMutedRef.current) sounds.playLaserFire(false);
          }
        } else if (msg.type === 'combat:damaged') {
          if (msg.hitPoint) {
            const hit = normalizeVector3D(msg.hitPoint);
            setExplosions((prev) => [
              ...prev.slice(-10),
              {
                id: 'exp-' + Math.random(),
                position: hit,
                color: msg.shield > 0 ? '#38bdf8' : '#ef4444',
                startTime: Date.now(),
                duration: 0.3,
                scale: 1.1,
              },
            ]);
          }

          if (msg.targetId === localPlayerIdRef.current) {
            playerLastHitRef.current = Date.now();
            setPlayerShield(msg.shield);
            setPlayerHull(msg.hull);
            setCombatLog((prev) => ['Warning: Taking hit from opponent!', ...prev.slice(0, 15)]);
          }

          if (msg.destroyed) {
            if (!isAudioMutedRef.current) sounds.playExplosion();
            setCombatLog((prev) => [`Ship destroyed in dogfight!`, ...prev.slice(0, 15)]);
          }
        } else if (msg.type === 'ship:respawned') {
          if (msg.ship) {
            const respawned = normalizeShip(msg.ship);
            setRemoteShips((prev) => {
              const idx = prev.findIndex((s) => s.id === respawned.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = respawned;
                return updated;
              }
              return [...prev, respawned];
            });
          }
        } else if (msg.type === 'pong' && typeof msg.t === 'number') {
          const rtt = Math.max(1, Date.now() - msg.t);
          setPing(rtt);
        } else if (msg.type === 'player:left') {
          setRemoteShips((prev) => prev.filter((s) => s.id !== msg.playerId));
          setCombatLog((prev) => ['Opponent disconnected from lobby', ...prev.slice(0, 15)]);
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    };

    // Real RTT Ping Measurement
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      }
    }, 1200);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, []);

  // Periodic network state sync to server (45Hz high-frequency telemetry)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const p = physicsStateRef.current;
        wsRef.current.send(
          JSON.stringify({
            type: 'player:update',
            position: [p.position.x, p.position.y, p.position.z],
            velocity: [p.velocity.x, p.velocity.y, p.velocity.z],
            rotation: [p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w],
            angularVelocity: [p.angularVelocity.x, p.angularVelocity.y, p.angularVelocity.z],
            throttle: p.throttle,
            boost: p.boostActive,
            decoupled: p.ifcsMode === 'decoupled',
            targetId: currentTargetId,
          })
        );
      }
    }, 22);

    return () => clearInterval(syncInterval);
  }, [currentTargetId]);

  // 2. LASER FIRING LOGIC
  const fireLaser = useCallback(() => {
    const now = Date.now();
    lastFireTime.current = now;

    if (!isAudioMuted) {
      sounds.playLaserFire(true);
    }

    const p = physicsStateRef.current;
    const shipRot = new THREE.Quaternion(p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRot);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shipRot);

    // Muzzle speed in m/s
    const muzzleSpeed = 1250;

    // Wing hardpoints (left & right)
    const offset = Math.random() > 0.5 ? 2.5 : -2.5;
    const origin = new THREE.Vector3(p.position.x, p.position.y, p.position.z)
      .addScaledVector(right, offset)
      .addScaledVector(forward, 2.0);

    // Newtonian Velocity Inheritance: V_bolt = V_ship + (Forward * muzzleSpeed)
    const boltVel = new THREE.Vector3(p.velocity.x, p.velocity.y, p.velocity.z).addScaledVector(
      forward,
      muzzleSpeed
    );

    const laserId = 'lzr-' + Math.random().toString(36).substring(2, 9);
    const newBolt: LaserBolt = {
      id: laserId,
      shooterId: localPlayerId,
      position: { x: origin.x, y: origin.y, z: origin.z },
      velocity: { x: boltVel.x, y: boltVel.y, z: boltVel.z },
      color: '#00f0ff',
      createdAt: now,
      lifeTime: 2.5,
    };

    setLocalLasers((prev) => [...prev.slice(-25), newBolt]);

    // Send to multiplayer server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'weapon:fire',
          origin: [origin.x, origin.y, origin.z],
          velocity: [boltVel.x, boltVel.y, boltVel.z],
          color: '#00f0ff',
        })
      );
    }
  }, [localPlayerId, isAudioMuted]);

  // Target Cycling helper
  const cycleTarget = useCallback(() => {
    if (!isAudioMuted) sounds.playTargetLock();
    setRemoteShips((targets) => {
      if (targets.length === 0) return targets;
      const currentIndex = targets.findIndex((t) => t.id === currentTargetId);
      const nextIndex = (currentIndex + 1) % targets.length;
      setCurrentTargetId(targets[nextIndex].id);
      return targets;
    });
  }, [currentTargetId, isAudioMuted]);

  // 3. KEYBOARD & VIRTUAL JOYSTICK MOUSE FLIGHT CONTROLS
  const handleRecenterJoystick = useCallback(() => {
    const cx = vjoyRef.current.centerX;
    const cy = vjoyRef.current.centerY;
    inputsRef.current.yaw = 0;
    inputsRef.current.pitch = 0;
    mouseStick.current = { x: 0, y: 0 };
    setVirtualJoystick((prev) => ({
      ...prev,
      mouseX: cx,
      mouseY: cy,
      pitchInput: 0,
      yawInput: 0,
      pitchPercent: 0,
      yawPercent: 0,
      deflectionPercent: 0,
    }));
  }, []);

  const handleToggleInvertPitch = useCallback(() => {
    setVirtualJoystick((prev) => {
      const nextInverted = !prev.isInverted;
      const cx = prev.centerX;
      const cy = prev.centerY;
      const dx = prev.mouseX - cx;
      const dy = prev.mouseY - cy;
      const dist = Math.hypot(dx, dy);
      let pitch = 0;
      if (dist > prev.deadzoneRadius) {
        const effRadius = prev.maxRadius - prev.deadzoneRadius;
        const f = Math.min(1.0, (dist - prev.deadzoneRadius) / effRadius);
        const uy = dy / dist;
        const pitchDir = nextInverted ? 1 : -1;
        pitch = Math.max(-1, Math.min(1, uy * f * pitchDir));
      }
      inputsRef.current.pitch = pitch;
      mouseStick.current.y = pitch;
      return {
        ...prev,
        isInverted: nextInverted,
        pitchInput: pitch,
        pitchPercent: Math.round(pitch * 100),
      };
    });
  }, []);

  // Update center coordinates on screen resize
  useEffect(() => {
    const handleResize = () => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setVirtualJoystick((prev) => {
        const dx = prev.mouseX - prev.centerX;
        const dy = prev.mouseY - prev.centerY;
        return {
          ...prev,
          centerX: cx,
          centerY: cy,
          mouseX: cx + dx,
          mouseY: cy + dy,
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture inputs if typing inside an input field or any modal is open
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (isAnyModalOpenRef.current) return;

      sounds.initEngineHum();
      const kb = keybindingsRef.current;
      activeInputCodes.current.add(e.code);

      // Track directional intent immediately for dual-axis actions
      if (doesCodeMatchAction(kb.strafeRight, e.code)) {
        lastAxisDirection.current.sway = 1;
      } else if (doesCodeMatchAction(kb.strafeLeft, e.code)) {
        lastAxisDirection.current.sway = -1;
      }

      if (doesCodeMatchAction(kb.strafeUp, e.code)) {
        lastAxisDirection.current.heave = 1;
      } else if (doesCodeMatchAction(kb.strafeDown, e.code)) {
        lastAxisDirection.current.heave = -1;
      }

      if (doesCodeMatchAction(kb.throttleForward, e.code)) {
        lastAxisDirection.current.surge = 1;
      } else if (doesCodeMatchAction(kb.throttleReverse, e.code)) {
        lastAxisDirection.current.surge = -1;
      }

      if (doesCodeMatchAction(kb.rollRight, e.code)) {
        lastAxisDirection.current.roll = 1;
      } else if (doesCodeMatchAction(kb.rollLeft, e.code)) {
        lastAxisDirection.current.roll = -1;
      }

      // Re-evaluate continuous inputs instantly on keydown
      recalculateContinuousInputs();

      // Discrete single-shot or toggle actions
      if (!e.repeat) {
        if (doesCodeMatchAction(kb.toggleDecoupled, e.code)) {
          setPhysicsState((prev) => ({
            ...prev,
            ifcsMode: prev.ifcsMode === 'coupled' ? 'decoupled' : 'coupled',
          }));
        }

        if (doesCodeMatchAction(kb.cycleTarget, e.code)) {
          cycleTarget();
        }

        if (doesCodeMatchAction(kb.recenterVJoy, e.code)) {
          handleRecenterJoystick();
        }

        if (doesCodeMatchAction(kb.invertPitch, e.code)) {
          handleToggleInvertPitch();
        }
      }

      if (doesCodeMatchAction(kb.primaryFire, e.code)) {
        fireLaser();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeInputCodes.current.delete(e.code);
      recalculateContinuousInputs();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (inputDeviceModeRef.current !== 'keyboard_mouse') return;

      const current = vjoyRef.current;
      const cx = current.centerX;
      const cy = current.centerY;
      const mx = e.clientX;
      const my = e.clientY;

      const dx = mx - cx;
      const dy = my - cy;
      const dist = Math.hypot(dx, dy);

      let pitch = 0;
      let yaw = 0;
      let deflection = 0;

      if (dist > current.deadzoneRadius) {
        const effRadius = current.maxRadius - current.deadzoneRadius;
        const f = Math.min(1.0, (dist - current.deadzoneRadius) / effRadius);
        const ux = dx / dist;
        const uy = dy / dist;

        yaw = Math.max(-1, Math.min(1, ux * f));
        // Moving mouse up (dy < 0) gives positive pitch / nose up when not inverted
        const pitchDir = current.isInverted ? 1 : -1;
        pitch = Math.max(-1, Math.min(1, uy * f * pitchDir));
        deflection = f;
      }

      inputsRef.current.yaw = yaw;
      inputsRef.current.pitch = pitch;
      mouseStick.current = { x: yaw, y: pitch };

      setVirtualJoystick((prev) => ({
        ...prev,
        mouseX: mx,
        mouseY: my,
        pitchInput: pitch,
        yawInput: yaw,
        pitchPercent: Math.round(pitch * 100),
        yawPercent: Math.round(yaw * 100),
        deflectionPercent: Math.round(deflection * 100),
      }));
    };

    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) {
        return;
      }
      if (isAnyModalOpenRef.current) return;

      // Prevent default navigation for thumb buttons (Mouse3 / Mouse4)
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
      }

      const kb = keybindingsRef.current;
      const mouseCode = `Mouse${e.button}`;
      activeInputCodes.current.add(mouseCode);

      sounds.initEngineHum();

      if (doesCodeMatchAction(kb.strafeRight, mouseCode)) {
        lastAxisDirection.current.sway = 1;
      } else if (doesCodeMatchAction(kb.strafeLeft, mouseCode)) {
        lastAxisDirection.current.sway = -1;
      }

      if (doesCodeMatchAction(kb.strafeUp, mouseCode)) {
        lastAxisDirection.current.heave = 1;
      } else if (doesCodeMatchAction(kb.strafeDown, mouseCode)) {
        lastAxisDirection.current.heave = -1;
      }

      if (doesCodeMatchAction(kb.throttleForward, mouseCode)) {
        lastAxisDirection.current.surge = 1;
      } else if (doesCodeMatchAction(kb.throttleReverse, mouseCode)) {
        lastAxisDirection.current.surge = -1;
      }

      if (doesCodeMatchAction(kb.rollRight, mouseCode)) {
        lastAxisDirection.current.roll = 1;
      } else if (doesCodeMatchAction(kb.rollLeft, mouseCode)) {
        lastAxisDirection.current.roll = -1;
      }

      recalculateContinuousInputs();

      // Toggle IFCS Decoupled
      if (doesCodeMatchAction(kb.toggleDecoupled, mouseCode)) {
        setPhysicsState((prev) => ({
          ...prev,
          ifcsMode: prev.ifcsMode === 'coupled' ? 'decoupled' : 'coupled',
        }));
      }

      // Cycle Target
      if (doesCodeMatchAction(kb.cycleTarget, mouseCode)) {
        cycleTarget();
      }

      // Invert Pitch
      if (doesCodeMatchAction(kb.invertPitch, mouseCode)) {
        handleToggleInvertPitch();
      }

      // Primary Fire handled continuously in physics loop
      const isMouse0BoundToMovement =
        doesCodeMatchAction(kb.throttleForward, 'Mouse0') ||
        doesCodeMatchAction(kb.throttleReverse, 'Mouse0') ||
        doesCodeMatchAction(kb.strafeLeft, 'Mouse0') ||
        doesCodeMatchAction(kb.strafeRight, 'Mouse0') ||
        doesCodeMatchAction(kb.recenterVJoy, 'Mouse0');

      // Recenter Virtual Joystick: if matched, or if default Right Click and not bound to movement
      const isMouse2BoundToMovement =
        doesCodeMatchAction(kb.throttleForward, 'Mouse2') ||
        doesCodeMatchAction(kb.throttleReverse, 'Mouse2') ||
        doesCodeMatchAction(kb.strafeLeft, 'Mouse2') ||
        doesCodeMatchAction(kb.strafeRight, 'Mouse2') ||
        doesCodeMatchAction(kb.primaryFire, 'Mouse2');

      if (doesCodeMatchAction(kb.recenterVJoy, mouseCode) || (e.button === 2 && !isMouse2BoundToMovement)) {
        handleRecenterJoystick();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const mouseCode = `Mouse${e.button}`;
      activeInputCodes.current.delete(mouseCode);
      recalculateContinuousInputs();
    };

    const handleWheel = (e: WheelEvent) => {
      if (isAnyModalOpenRef.current) return;
      const kb = keybindingsRef.current;
      const wheelCode = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';

      if (doesCodeMatchAction(kb.throttleForward, wheelCode)) {
        wheelSurgeActive.current = 1;
        recalculateContinuousInputs();
        sounds.initEngineHum();
        if (wheelTimeoutRef.current) window.clearTimeout(wheelTimeoutRef.current);
        wheelTimeoutRef.current = window.setTimeout(() => {
          wheelSurgeActive.current = 0;
          recalculateContinuousInputs();
        }, 180);
      } else if (doesCodeMatchAction(kb.throttleReverse, wheelCode)) {
        wheelSurgeActive.current = -1;
        recalculateContinuousInputs();
        sounds.initEngineHum();
        if (wheelTimeoutRef.current) window.clearTimeout(wheelTimeoutRef.current);
        wheelTimeoutRef.current = window.setTimeout(() => {
          wheelSurgeActive.current = 0;
          recalculateContinuousInputs();
        }, 180);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent browser right click menu to allow clean right-click recentering or reverse/forward flight
      e.preventDefault();
    };

    const handleBlur = () => {
      activeInputCodes.current.clear();
      wheelSurgeActive.current = 0;
      recalculateContinuousInputs();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleBlur);
      if (wheelTimeoutRef.current) window.clearTimeout(wheelTimeoutRef.current);
    };
  }, [fireLaser, cycleTarget, handleRecenterJoystick, handleToggleInvertPitch, keybindings, recalculateContinuousInputs]);

  // 4. PHYSICS UPDATE LOOP (60 Hz)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);
      const now = Date.now();
      const dt = Math.min((time - lastTime) / 1000, 0.08);
      lastTime = time;

      // Poll Flight Stick / Gamepad Inputs if active
      if (inputDeviceModeRef.current === 'flight_stick') {
        const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
        const stick = readFlightStickInputs(flightStickConfigRef.current, gamepads);

        inputsRef.current.pitch = stick.pitch;
        inputsRef.current.yaw = stick.yaw;
        inputsRef.current.roll = stick.roll;
        inputsRef.current.surge = stick.surge;
        inputsRef.current.sway = stick.sway;
        inputsRef.current.heave = stick.heave;
        inputsRef.current.boost = stick.boost;

        // Synchronize HUD Virtual Joystick deflection representation
        const currentVJoy = vjoyRef.current;
        const maxR = currentVJoy.maxRadius;
        const defl = Math.sqrt(stick.yaw * stick.yaw + stick.pitch * stick.pitch);
        const deflPct = Math.min(100, Math.round(defl * 100));
        const pPct = Math.round(stick.pitch * 100);
        const yPct = Math.round(stick.yaw * 100);
        const mx = currentVJoy.centerX + stick.yaw * maxR;
        const my = currentVJoy.centerY - stick.pitch * maxR * (currentVJoy.isInverted ? -1 : 1);

        setVirtualJoystick((prev) => ({
          ...prev,
          mouseX: mx,
          mouseY: my,
          pitchInput: stick.pitch,
          yawInput: stick.yaw,
          pitchPercent: pPct,
          yawPercent: yPct,
          deflectionPercent: deflPct,
        }));

        // Primary fire trigger
        inputsRef.current.primaryFire = stick.primaryFire;

        // Toggle decoupled (rising edge trigger)
        if (stick.toggleDecoupled && !lastStickButtonsRef.current.toggleDecoupled) {
          setPhysicsState((prev) => ({
            ...prev,
            ifcsMode: prev.ifcsMode === 'coupled' ? 'decoupled' : 'coupled',
          }));
        }

        // Cycle target (rising edge trigger)
        if (stick.cycleTarget && !lastStickButtonsRef.current.cycleTarget) {
          cycleTarget();
        }

        lastStickButtonsRef.current = {
          toggleDecoupled: stick.toggleDecoupled,
          cycleTarget: stick.cycleTarget,
        };
      }

      // Update engine hum sound
      if (!isAudioMuted) {
        sounds.updateEngineSound(physicsStateRef.current.throttle, inputsRef.current.boost);
      }

      // Weapon Firing & Capacitor Recharging Logic
      const fireDelayMs = 1000 / (250 / 60); // 250 RPM = 240ms delay
      const capacitorMax = 75;
      const rechargeRate = 25; // Shots recharged per second
      const rechargeDelayMs = 500; // Time before recharge starts

      if (inputsRef.current.primaryFire && !isAnyModalOpenRef.current && !weaponRechargingRef.current && weaponCapacitorRef.current > 0) {
        if (now - lastFireTime.current >= fireDelayMs) {
          fireLaser();
          weaponCapacitorRef.current -= 1;
          
          if (weaponCapacitorRef.current <= 0) {
            weaponRechargingRef.current = true;
          }
          
          const newFloor = Math.floor(weaponCapacitorRef.current);
          setWeaponCapacitor((prev) => (prev !== newFloor ? newFloor : prev));
        }
      } else {
        // Recharging logic
        if (now - lastFireTime.current > rechargeDelayMs) {
          if (weaponCapacitorRef.current < capacitorMax) {
            weaponCapacitorRef.current = Math.min(capacitorMax, weaponCapacitorRef.current + rechargeRate * dt);
            
            if (weaponCapacitorRef.current >= capacitorMax) {
              weaponRechargingRef.current = false;
            }

            const newFloor = Math.floor(weaponCapacitorRef.current);
            setWeaponCapacitor((prev) => (prev !== newFloor ? newFloor : prev));
          }
        }
      }

      // 6-DoF Newtonian physics integration
      setPhysicsState((prev) => {
        const next = engineRef.current.update(prev, inputsRef.current, dt);
        physicsStateRef.current = next;
        return next;
      });

      // Local player shield regeneration
      if (!playerIsDeadRef.current) {
        const timeSinceLastHit = now - playerLastHitRef.current;
        setPlayerShield((prev) => {
          if (prev >= 200) return prev;
          
          if (prev > 0) {
            // Still has shields: recharge after 3 seconds at 20HP per second
            if (timeSinceLastHit > 3000) {
              return Math.min(200, prev + 20 * dt);
            }
          } else {
            // Shields are fully down: recharge after 5 seconds at 20HP per second
            if (timeSinceLastHit > 5000) {
              return Math.min(200, prev + 20 * dt);
            }
          }
          return prev;
        });
      }

      // Continuously dead-reckon remote ships between server snapshot intervals
      setRemoteShips((prevShips) =>
        prevShips.map((s) => {
          const nextPos = {
            x: s.position.x + s.velocity.x * dt,
            y: s.position.y + s.velocity.y * dt,
            z: s.position.z + s.velocity.z * dt,
          };

          // Apply matching shield recharge rules to enemy ships if they are alive
          let nextShield = s.shield;
          if (s.hull > 0) {
            const timeSinceLastHit = now - s.lastHit;
            if (s.shield < 200) {
              if (s.shield > 0) {
                // Still has shields: recharge after 3 seconds at 20HP per second
                if (timeSinceLastHit > 3000) {
                  nextShield = Math.min(200, s.shield + 20 * dt);
                }
              } else {
                // Shields are fully down: recharge after 5 seconds at 20HP per second
                if (timeSinceLastHit > 5000) {
                  nextShield = Math.min(200, s.shield + 20 * dt);
                }
              }
            }
          }

          return {
            ...s,
            position: nextPos,
            shield: nextShield,
          };
        })
      );

      // Advance remote laser bolts & detect hits on player vessel
      setRemoteLasers((prevLasers) => {
        if (prevLasers.length === 0) return prevLasers;
        const now = Date.now();
        const p = physicsStateRef.current;
        const remainingLasers: LaserBolt[] = [];

        prevLasers.forEach((laser) => {
          const age = (now - laser.createdAt) / 1000;
          if (age > laser.lifeTime) return;

          const nextPos = {
            x: laser.position.x + laser.velocity.x * dt,
            y: laser.position.y + laser.velocity.y * dt,
            z: laser.position.z + laser.velocity.z * dt,
          };

          const distToPlayer = Math.hypot(
            nextPos.x - p.position.x,
            nextPos.y - p.position.y,
            nextPos.z - p.position.z
          );

          if (distToPlayer < 5.0) {
            // Local ship hit by remote / AI laser!
            if (!isAudioMuted) sounds.playHitConfirm();
            playerLastHitRef.current = Date.now();
            setPlayerShield((curShield) => {
              const dmg = 10;
              if (curShield >= dmg) {
                return curShield - dmg;
              } else {
                const rem = dmg - curShield;
                setPlayerHull((curHull) => Math.max(0, curHull - rem));
                return 0;
              }
            });

            setExplosions((prevExp) => [
              ...prevExp.slice(-10),
              {
                id: 'exp-' + Math.random(),
                position: nextPos,
                color: '#ef4444',
                startTime: Date.now(),
                duration: 0.3,
                scale: 1.1,
              },
            ]);
          } else {
            remainingLasers.push({ ...laser, position: nextPos });
          }
        });

        return remainingLasers;
      });

      // Advance local laser projectiles and compute hit detection
      setLocalLasers((currentLasers) => {
        if (currentLasers.length === 0) return currentLasers;
        const targets = remoteShipsRef.current;
        const now = Date.now();
        const updatedLasers: LaserBolt[] = [];

        currentLasers.forEach((laser) => {
          const age = (now - laser.createdAt) / 1000;
          if (age > laser.lifeTime) return;

          // Projectile displacement
          const nextPos = {
            x: laser.position.x + laser.velocity.x * dt,
            y: laser.position.y + laser.velocity.y * dt,
            z: laser.position.z + laser.velocity.z * dt,
          };

          // Check hit against remote/AI ships (6.5 meter radius collision sphere)
          // Use line-segment distance to prevent fast-moving lasers from tunneling through targets
          let hit = false;
          for (const target of targets) {
            if (target.hull <= 0) continue; // Do not hit already destroyed ships

            // Vector from segment start to target
            const L = {
              x: target.position.x - laser.position.x,
              y: target.position.y - laser.position.y,
              z: target.position.z - laser.position.z,
            };
            // Segment vector
            const D = {
              x: nextPos.x - laser.position.x,
              y: nextPos.y - laser.position.y,
              z: nextPos.z - laser.position.z,
            };
            const lenSq = D.x * D.x + D.y * D.y + D.z * D.z;
            
            let closestDistSq = 0;
            if (lenSq === 0) {
              closestDistSq = L.x * L.x + L.y * L.y + L.z * L.z;
            } else {
              let t = (L.x * D.x + L.y * D.y + L.z * D.z) / lenSq;
              t = Math.max(0, Math.min(1, t)); // clamp to segment
              
              const proj = {
                x: laser.position.x + t * D.x,
                y: laser.position.y + t * D.y,
                z: laser.position.z + t * D.z,
              };
              
              closestDistSq = Math.pow(target.position.x - proj.x, 2) + Math.pow(target.position.y - proj.y, 2) + Math.pow(target.position.z - proj.z, 2);
            }

            if (closestDistSq < 6.5 * 6.5) {
              hit = true;
              // Hit confirmed!
              if (!isAudioMuted) sounds.playHitConfirm();
              setHitConfirmed(true);
              setTimeout(() => setHitConfirmed(false), 120);

              // Small hit impact VFX
              setExplosions((prevExp) => [
                ...prevExp.slice(-10),
                {
                  id: 'exp-' + Math.random(),
                  position: nextPos,
                  color: target.shield > 0 ? '#00f0ff' : '#f97316',
                  startTime: Date.now(),
                  duration: 0.3,
                  scale: 1.0,
                },
              ]);

              // Notify server of hit
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'combat:hit',
                    targetId: target.id,
                    hitPoint: [nextPos.x, nextPos.y, nextPos.z],
                    damage: 15,
                  })
                );
              } else {
                // Local singleplayer damage application
                setRemoteShips((prevShips) =>
                  prevShips.map((s) => {
                    if (s.id === target.id) {
                      let sld = s.shield;
                      let hll = s.hull;
                      const dmg = 15;
                      if (sld >= dmg) {
                        sld -= dmg;
                      } else {
                        const rem = dmg - sld;
                        sld = 0;
                        hll = Math.max(0, hll - rem);
                      }

                      if (hll <= 0 && s.hull > 0) {
                        // Target destroyed explosion!
                        if (!isAudioMuted) sounds.playExplosion();
                        setScore((sc) => sc + 100);
                        setExplosions((prevExp) => [
                          ...prevExp.slice(-10),
                          {
                            id: 'exp-die-' + Math.random(),
                            position: nextPos,
                            color: '#f97316',
                            startTime: Date.now(),
                            duration: 1.5,
                            scale: 5.5,
                          },
                          {
                            id: 'exp-ring-' + Math.random(),
                            position: nextPos,
                            color: '#00f0ff',
                            startTime: Date.now(),
                            duration: 1.2,
                            scale: 4.0,
                          },
                        ]);

                        setCombatLog((prevLog) => [
                          `TARGET DESTROYED: [${s.callsign}] eliminated! (+100 PTS) Respawning in 5s...`,
                          ...prevLog.slice(0, 15),
                        ]);

                        // Schedule 5-second respawn
                        const targetIdToRespawn = target.id;
                        setTimeout(() => {
                          setRemoteShips((curShips) =>
                            curShips.map((rs) => {
                              if (rs.id === targetIdToRespawn) {
                                return {
                                  ...rs,
                                  hull: 120,
                                  maxHull: 120,
                                  shield: 200,
                                  maxShield: 200,
                                  position: {
                                    x: (Math.random() - 0.5) * 300 + 150,
                                    y: (Math.random() - 0.5) * 100,
                                    z: -400,
                                  },
                                  velocity: { x: 0, y: 0, z: 0 },
                                };
                              }
                              return rs;
                            })
                          );
                          setCombatLog((prevLog) => [
                            `TARGET RE-ENTERED ARENA: [${s.callsign}] has respawned.`,
                            ...prevLog.slice(0, 15),
                          ]);
                        }, 5000);
                      }

                      return { ...s, shield: sld, hull: hll, lastHit: Date.now() };
                    }
                    return s;
                  })
                );
              }

              setScore((s) => s + 25);
              break;
            }
          }

          if (!hit) {
            updatedLasers.push({
              ...laser,
              position: nextPos,
            });
          }
        });

        return updatedLasers;
      });

      // Periodically prune expired explosion effects from state
      setExplosions((prevExp) => {
        if (prevExp.length === 0) return prevExp;
        const nowMs = Date.now();
        const active = prevExp.filter((e) => (nowMs - e.startTime) / 1000 < e.duration + 0.1);
        return active.length === prevExp.length ? prevExp : active;
      });
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isAudioMuted]);

  // Reset ship position helper
  const handleResetPosition = useCallback(() => {
    setPhysicsState((prev) => ({
      ...prev,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      currentSpeed: 0,
    }));
  }, []);

  // Player destruction & 5-second respawn logic
  const triggerPlayerDeath = useCallback(() => {
    if (playerIsDeadRef.current) return;
    playerIsDeadRef.current = true;
    setPlayerIsDead(true);
    setRespawnCountdown(5);

    if (!isAudioMutedRef.current) sounds.playExplosion();

    setExplosions((prev) => [
      ...prev.slice(-10),
      {
        id: 'p-die-' + Math.random(),
        position: { ...physicsStateRef.current.position },
        color: '#ef4444',
        startTime: Date.now(),
        duration: 1.5,
        scale: 6.0,
      },
      {
        id: 'p-ring-' + Math.random(),
        position: { ...physicsStateRef.current.position },
        color: '#f97316',
        startTime: Date.now(),
        duration: 1.2,
        scale: 4.5,
      },
    ]);

    setCombatLog((prev) => [
      'CRITICAL FAILURE: Hull Integrity Zero! Ship destroyed. Respawning in 5s...',
      ...prev.slice(0, 15),
    ]);

    let secRemaining = 5;
    const interval = setInterval(() => {
      secRemaining -= 1;
      setRespawnCountdown(secRemaining);
      if (secRemaining <= 0) {
        clearInterval(interval);
        setPlayerHull(120);
        setPlayerShield(200);
        handleResetPosition();
        setPlayerIsDead(false);
        playerIsDeadRef.current = false;
        setCombatLog((prev) => ['GLADIUS SYSTEMS RESTORED // Ship re-deployed to arena.', ...prev.slice(0, 15)]);
      }
    }, 1000);
  }, [handleResetPosition]);

  useEffect(() => {
    if (playerHull <= 0 && !playerIsDeadRef.current) {
      triggerPlayerDeath();
    }
  }, [playerHull, triggerPlayerDeath]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-['Chakra_Petch',sans-serif] cursor-crosshair"
      onClick={() => sounds.initEngineHum()}
    >
      {/* 1. 3D COCKPIT SIMULATION CANVAS (Three.js WebGL) */}
      <div className="absolute inset-0 z-0">
        <CockpitCanvas
          physicsState={physicsState}
          targets={remoteShips}
          currentTargetId={currentTargetId}
          onTargetSelect={setCurrentTargetId}
          localLasers={localLasers}
          remoteLasers={remoteLasers}
          explosions={explosions}
          isLockedLook={false}
          mouseVirtualStick={{ x: virtualJoystick.yawInput, y: virtualJoystick.pitchInput }}
          onLeadPipCalculated={setTargetInfo}
          onTviCalculated={setTviInfo}
        />
      </div>

      {/* 2. STAR CITIZEN STYLE COCKPIT HUD OVERLAY WITH VIRTUAL JOYSTICK */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <CockpitHUD
          physicsState={physicsState}
          targetInfo={targetInfo}
          tviInfo={tviInfo}
          keybindings={keybindings}
          virtualJoystick={virtualJoystick}
          playerHull={playerHull}
          playerShield={playerShield}
          playerIsDead={playerIsDead}
          respawnCountdown={respawnCountdown}
          weaponCapacitor={weaponCapacitor}
          hitConfirmed={hitConfirmed}
          score={score}
          ping={ping}
          connectedPilotsCount={remoteShips.length + 1}
          onToggleDecoupled={() =>
            setPhysicsState((prev) => ({
              ...prev,
              ifcsMode: prev.ifcsMode === 'coupled' ? 'decoupled' : 'coupled',
            }))
          }
          onCycleTarget={cycleTarget}
          onRecenterJoystick={handleRecenterJoystick}
          onToggleInvertPitch={handleToggleInvertPitch}
        />
      </div>

      {/* 3. TOP NAVIGATION / ACTION BAR */}
      <header className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto z-40 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-full shadow-2xl">
        {/* Unity & C# Architecture Studio Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsUnityModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full cursor-pointer transition-all shadow-md active:scale-95"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Unity & C# Source Code</span>
        </button>

        {/* Flight Controls & Peripherals Guide */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsControlsModalOpen(true);
          }}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors border ${
            inputDeviceMode === 'flight_stick'
              ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title="Configure Keyboard, Mouse & Flight Stick Peripherals"
        >
          {inputDeviceMode === 'flight_stick' ? (
            <Gamepad className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          ) : (
            <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span>Controls ({inputDeviceMode === 'flight_stick' ? 'STICK' : 'KBM'})</span>
        </button>

        {/* Multiplayer Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all ${
            connectedPilotsCount >= 2
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'bg-amber-950/90 border-amber-500/60 text-amber-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full animate-pulse ${
              connectedPilotsCount >= 2 ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span>
            {connectedPilotsCount >= 2 ? '2/2 PLAYERS CONNECTED' : '1/2 PLAYERS (AWAITING P2)'}
          </span>
        </div>

        {/* Dedicated Server Settings Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsServerModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 border border-indigo-500/50 text-indigo-300 text-xs font-mono font-bold px-3 py-1.5 rounded-full cursor-pointer transition-colors shadow-md"
          title="Configure Dedicated Server Node or Host Your Own"
        >
          <Server className="w-3.5 h-3.5 text-indigo-400" />
          <span>{customServerUrl ? 'Dedicated VPS' : 'Cloud Server'}</span>
        </button>

        {/* Copy Game Link Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopyLink();
          }}
          className="flex items-center gap-1.5 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold px-3 py-1.5 rounded-full cursor-pointer transition-colors shadow-md"
          title="Copy Link to invite Player 2 to this duel"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedLink ? 'Link Copied!' : 'Copy Game Link'}</span>
        </button>

        {/* Audio Mute Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAudioMuted(!isAudioMuted);
          }}
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
        </button>

        {/* Reset Position */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleResetPosition();
          }}
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Reset Vessel Coordinates"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* 4. MODALS & PANELS */}
      <UnityCodeStudio isOpen={isUnityModalOpen} onClose={() => setIsUnityModalOpen(false)} />
      <FlightControlsGuide
        isOpen={isControlsModalOpen}
        onClose={() => setIsControlsModalOpen(false)}
        keybindings={keybindings}
        onUpdateKeybindings={handleUpdateKeybindings}
        onResetDefaults={handleResetKeybindings}
        inputDeviceMode={inputDeviceMode}
        onSelectInputDeviceMode={handleSelectInputDeviceMode}
        flightStickConfig={flightStickConfig}
        onUpdateFlightStickConfig={handleUpdateFlightStickConfig}
        onResetFlightStickDefaults={handleResetFlightStickConfig}
        virtualJoystick={virtualJoystick}
        onUpdateVirtualJoystick={setVirtualJoystick}
      />
      <DedicatedServerModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        customServerUrl={customServerUrl}
        onSaveCustomServer={(url) => {
          setCustomServerUrl(url);
          if (url) {
            localStorage.setItem('custom_ws_server', url);
          } else {
            localStorage.removeItem('custom_ws_server');
          }
        }}
        currentPing={ping}
      />
    </div>
  );
}
