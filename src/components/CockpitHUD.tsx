import React from 'react';
import { ShipPhysicsState, TargetInfo, VirtualJoystickState, TVIInfo, KeyBindingsMap } from '../types';
import { Shield, Crosshair, Zap, Compass, AlertTriangle, Radio, RotateCcw, ArrowUpDown, Navigation } from 'lucide-react';
import { formatKeyLabel } from '../utils/keybindings';

interface CockpitHUDProps {
  physicsState: ShipPhysicsState;
  targetInfo: TargetInfo | null;
  tviInfo?: TVIInfo | null;
  keybindings?: KeyBindingsMap;
  virtualJoystick: VirtualJoystickState;
  playerHull: number;
  playerShield: number;
  playerIsDead?: boolean;
  respawnCountdown?: number;
  weaponCapacitor: number;
  hitConfirmed: boolean;
  score: number;
  ping: number;
  connectedPilotsCount: number;
  onToggleDecoupled: () => void;
  onCycleTarget: () => void;
  onRecenterJoystick: () => void;
  onToggleInvertPitch: () => void;
}

export const CockpitHUD: React.FC<CockpitHUDProps> = ({
  physicsState,
  targetInfo,
  tviInfo,
  keybindings,
  virtualJoystick,
  playerHull,
  playerShield,
  playerIsDead,
  respawnCountdown,
  weaponCapacitor,
  hitConfirmed,
  score,
  ping,
  connectedPilotsCount,
  onToggleDecoupled,
  onCycleTarget,
  onRecenterJoystick,
  onToggleInvertPitch,
}) => {
  const isDecoupled = physicsState.ifcsMode === 'decoupled';
  const speed = Math.round(physicsState.currentSpeed);
  const throttlePercent = Math.round(physicsState.throttle * 100);
  const gForce = physicsState.gForce.toFixed(1);

  const cycleKeyLabel = keybindings ? formatKeyLabel(keybindings.cycleTarget.primary) : 'T';
  const decoupledKeyLabel = keybindings ? formatKeyLabel(keybindings.toggleDecoupled.primary) : 'C';
  const recenterKeyLabel = keybindings ? formatKeyLabel(keybindings.recenterVJoy.primary) : 'X';
  const invertKeyLabel = keybindings ? formatKeyLabel(keybindings.invertPitch.primary) : 'I';

  const { centerX, centerY, mouseX, mouseY, maxRadius, deadzoneRadius, deflectionPercent, pitchPercent, yawPercent, circleOpacity = 0.3 } = virtualJoystick;

  // Compute vector color based on deflection percentage
  let vectorColor = '#38bdf8'; // Cyan
  if (deflectionPercent > 88) {
    vectorColor = '#ef4444'; // Red
  } else if (deflectionPercent > 60) {
    vectorColor = '#f59e0b'; // Amber
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-['Chakra_Petch',sans-serif] text-cyan-400 overflow-hidden">
      {/* 1. HIT CONFIRMATION FLASH RETICLE */}
      {hitConfirmed && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center animate-ping">
          <div className="w-8 h-8 border-2 border-red-500 rotate-45" />
        </div>
      )}

      {/* 2. VIRTUAL JOYSTICK VECTOR HUD DISPLAY (Center of HUD) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <g opacity={circleOpacity}>
          {/* Outer Max Range Circle (100% pitch/yaw boundary) */}
          <circle
            cx={centerX}
            cy={centerY}
            r={maxRadius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="4 6"
            opacity="0.5"
          />

          {/* 50% Mid-Range Deflection Reference Ring */}
          <circle
            cx={centerX}
            cy={centerY}
            r={maxRadius * 0.5}
            fill="none"
            stroke="#0284c7"
            strokeWidth="1"
            strokeDasharray="2 6"
            opacity="0.3"
          />

          {/* Inner Deadzone Circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={deadzoneRadius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            opacity="0.45"
          />

          {/* Horizontal and Vertical Crosshair Axis Guides */}
          <line
            x1={centerX - maxRadius - 15}
            y1={centerY}
            x2={centerX - deadzoneRadius}
            y2={centerY}
            stroke="#0284c7"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1={centerX + deadzoneRadius}
            y1={centerY}
            x2={centerX + maxRadius + 15}
            y2={centerY}
            stroke="#0284c7"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1={centerX}
            y1={centerY - maxRadius - 15}
            x2={centerX}
            y2={centerY - deadzoneRadius}
            stroke="#0284c7"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1={centerX}
            y1={centerY + deadzoneRadius}
            x2={centerX}
            y2={centerY + maxRadius + 15}
            stroke="#0284c7"
            strokeWidth="1"
            opacity="0.4"
          />

          {/* Quadrant Tick Notches on Boundary */}
          <circle cx={centerX - maxRadius} cy={centerY} r="2.5" fill="#38bdf8" opacity="0.8" />
          <circle cx={centerX + maxRadius} cy={centerY} r="2.5" fill="#38bdf8" opacity="0.8" />
          <circle cx={centerX} cy={centerY - maxRadius} r="2.5" fill="#38bdf8" opacity="0.8" />
          <circle cx={centerX} cy={centerY + maxRadius} r="2.5" fill="#38bdf8" opacity="0.8" />
        </g>

        {/* THE VIRTUAL JOYSTICK LINE (From HUD Center to Mouse Position) */}
        <line
          x1={centerX}
          y1={centerY}
          x2={mouseX}
          y2={mouseY}
          stroke={vectorColor}
          strokeWidth={deflectionPercent > 0 ? "2.5" : "1.2"}
          strokeDasharray={deflectionPercent === 0 ? "2 2" : "none"}
          opacity={deflectionPercent === 0 ? "0.3" : "0.9"}
        />

        {/* TOTAL VECTOR INDICATOR (TVI) DRIFT LINE (From Center Boresight to TVI) */}
        {tviInfo && tviInfo.tvi && tviInfo.tvi.isOnScreen && tviInfo.driftAngleDeg > 1.2 && (
          <line
            x1={centerX}
            y1={centerY}
            x2={tviInfo.tvi.screenX}
            y2={tviInfo.tvi.screenY}
            stroke="#22d3ee"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.6"
          />
        )}
      </svg>

      {/* Virtual Joystick Center Anchor Marker */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: `${centerX}px`, top: `${centerY}px` }}
      >
        <div className="relative w-7 h-7 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-cyan-400/80" />
          <div className="absolute w-4 h-4 border border-cyan-400/50 rounded-full" />
        </div>
      </div>

      {/* VIRTUAL JOYSTICK MOUSE PIP (Handle with live percentage tag) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75"
        style={{ left: `${mouseX}px`, top: `${mouseY}px` }}
      >
        <div className="relative flex items-center justify-center">
          {/* Outer Pip Diamond */}
          <div
            className="w-5 h-5 border-2 rotate-45 flex items-center justify-center shadow-lg transition-colors"
            style={{ borderColor: vectorColor, boxShadow: `0 0 10px ${vectorColor}` }}
          >
            {/* Center Core */}
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>

          {/* Floating Telemetry Box Next to Pip */}
          <div className="absolute left-6 -top-3 whitespace-nowrap bg-transparent border border-slate-700/40 px-2 py-1 rounded-md text-[10px] font-mono shadow-xl flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">STICK:</span>
              <span className="font-bold font-mono" style={{ color: vectorColor }}>
                {deflectionPercent}% MAX
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className={pitchPercent >= 0 ? 'text-cyan-300' : 'text-blue-400'}>
                PITCH: {pitchPercent >= 0 ? `▲ +${pitchPercent}%` : `▼ ${pitchPercent}%`}
              </span>
              <span className="text-slate-600">|</span>
              <span className={yawPercent >= 0 ? 'text-amber-300' : 'text-orange-400'}>
                YAW: {yawPercent >= 0 ? `▶ +${yawPercent}%` : `◀ ${yawPercent}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TARGET BRACKET & BALLISTIC LEAD PIP */}
      {targetInfo && targetInfo.screenPos && targetInfo.screenPos.visible && (
        <>
          {/* Target Physical Bracket */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${targetInfo.screenPos.x}px`,
              top: `${targetInfo.screenPos.y}px`,
            }}
          >
            {/* Corner Brackets */}
            <div className="relative w-16 h-16">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-amber-400" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-amber-400" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-amber-400" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-amber-400" />

              {/* Target Data Tag */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-transparent px-1.5 py-0.5 rounded text-[10px] tracking-wider text-amber-400 border border-amber-400/30">
                {targetInfo.callsign}
              </div>

              {/* Target Shield & Hull Bars */}
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 w-20 flex flex-col gap-0.5 bg-transparent p-1 rounded border border-slate-700/60">
                <div className="flex items-center justify-between text-[9px] text-cyan-300">
                  <span>SHD</span>
                  <span>{Math.round(targetInfo.shieldPercent)}%</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-100"
                    style={{ width: `${targetInfo.shieldPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-red-400">
                  <span>HUL</span>
                  <span>{Math.round(targetInfo.hullPercent)}%</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-100"
                    style={{ width: `${targetInfo.hullPercent}%` }}
                  />
                </div>
              </div>

              {/* Range Readout */}
              <div className="absolute left-18 top-2 whitespace-nowrap text-xs text-amber-300 font-mono">
                {Math.round(targetInfo.distance)}m
              </div>
            </div>
          </div>

          {/* Ballistic Lead PIP (Predicted Impact Point) */}
          {targetInfo.leadScreenPos && targetInfo.leadScreenPos.visible && (
            <>
              {/* Connector line between target and lead PIP */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <line
                  x1={targetInfo.screenPos.x}
                  y1={targetInfo.screenPos.y}
                  x2={targetInfo.leadScreenPos.x}
                  y2={targetInfo.leadScreenPos.y}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.6"
                />
              </svg>

              {/* Lead PIP Reticle */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${targetInfo.leadScreenPos.x}px`,
                  top: `${targetInfo.leadScreenPos.y}px`,
                }}
              >
                <div className="relative w-5 h-5 flex items-center justify-center">
                  {/* Outer Diamond */}
                  <div className="w-3.5 h-3.5 border border-cyan-300 rotate-45 shadow-[0_0_4px_rgba(56,189,248,0.5)] flex items-center justify-center">
                    {/* Inner Pip */}
                    <div className="w-1 h-1 bg-red-400 rounded-full animate-pulse" />
                  </div>
                  <span className="absolute -top-3.5 text-[8px] font-mono tracking-widest text-cyan-300/80 uppercase">
                    PIP
                  </span>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* 3.4. OFF-SCREEN TARGET INDICATOR */}
      {targetInfo && targetInfo.offScreen && !targetInfo.offScreen.isOnScreen && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
          style={{
            left: `${targetInfo.offScreen.edgeX}px`,
            top: `${targetInfo.offScreen.edgeY}px`,
          }}
        >
          <div className="relative flex flex-col items-center justify-center">
            {/* Flashing target locked guiding arrow */}
            <div
              className="w-10 h-10 flex items-center justify-center animate-pulse"
              style={{ transform: `rotate(${targetInfo.offScreen.edgeAngle}rad)` }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" className="filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                <polygon points="22,12 8,4 12,12 8,20" fill="#f59e0b" stroke="#ef4444" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Floating telemetry tag for off-screen target */}
            <div className="absolute top-8 whitespace-nowrap bg-transparent border border-red-500/80 px-2 py-1 rounded-md text-[10px] font-mono text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)] flex flex-col items-center gap-0.5">
              <span className="font-extrabold text-amber-400 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                {targetInfo.callsign}
              </span>
              <div className="flex items-center gap-2 text-[9px] text-slate-300">
                <span className="font-bold text-red-400">{Math.round(targetInfo.distance)}m</span>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-400">{Math.round(targetInfo.shieldPercent)}% SHD</span>
                <span className="text-slate-600">|</span>
                <span className="text-emerald-400 font-bold">{targetInfo.offScreen.offNoseDegrees}° OFF-NOSE</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3.5. TOTAL VECTOR INDICATOR (TVI) & ANTI-TVI RETICLES */}
      {tviInfo && tviInfo.speed > 0.4 && (
        <>
          {/* TVI (Prograde Flight Path Marker) - ON SCREEN */}
          {tviInfo.tvi && tviInfo.tvi.isOnScreen && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75 ease-out z-20"
              style={{
                left: `${tviInfo.tvi.screenX}px`,
                top: `${tviInfo.tvi.screenY}px`,
              }}
            >
              <div className="relative flex flex-col items-center justify-center">
                {/* Authentic Aerospace / Space-Sim Flight Path Marker */}
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 36 36"
                  className="overflow-visible filter drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                >
                  {/* Central Flight Vector Ring */}
                  <circle
                    cx="18"
                    cy="18"
                    r="7"
                    fill="rgba(6, 182, 212, 0.15)"
                    stroke="#22d3ee"
                    strokeWidth="1.6"
                  />
                  {/* Center Dot */}
                  <circle cx="18" cy="18" r="1.5" fill="#ffffff" />
                  {/* Left Horizontal Wing */}
                  <line x1="2" y1="18" x2="11" y2="18" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />
                  {/* Right Horizontal Wing */}
                  <line x1="25" y1="18" x2="34" y2="18" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />
                  {/* Top Vertical Fin */}
                  <line x1="18" y1="2" x2="18" y2="11" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />
                </svg>

                {/* TVI Telemetry Data Tag */}
                <div className="absolute top-9 whitespace-nowrap bg-transparent border border-cyan-500/60 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider text-cyan-300 shadow-lg flex items-center gap-1">
                  <span className="font-bold text-cyan-400">TVI</span>
                  <span className="text-white">{Math.round(tviInfo.speed)}M/S</span>
                  {tviInfo.driftAngleDeg >= 2 && (
                    <span className="text-amber-400 font-semibold">∠{tviInfo.driftAngleDeg}°</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TVI (Prograde Flight Path Marker) - OFF-SCREEN EDGE CHEVRON */}
          {tviInfo.tvi && !tviInfo.tvi.isOnScreen && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
              style={{
                left: `${tviInfo.tvi.edgeX}px`,
                top: `${tviInfo.tvi.edgeY}px`,
              }}
            >
              <div className="relative flex items-center justify-center">
                {/* Directional arrow rotated toward travel vector */}
                <div
                  className="w-8 h-8 flex items-center justify-center"
                  style={{ transform: `rotate(${tviInfo.tvi.edgeAngle}rad)` }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" className="filter drop-shadow-[0_0_8px_#22d3ee]">
                    <polygon points="20,12 6,4 11,12 6,20" fill="#22d3ee" stroke="#38bdf8" strokeWidth="1" />
                  </svg>
                </div>
                {/* Off-screen TVI label */}
                <div className="absolute top-6 whitespace-nowrap bg-transparent border border-cyan-400/60 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 shadow-xl flex items-center gap-1">
                  <span className="font-bold text-cyan-400">TVI</span>
                  <span className="text-amber-400 font-semibold">{tviInfo.driftAngleDeg}° DRIFT</span>
                </div>
              </div>
            </div>
          )}

          {/* ANTI-TVI (Retrograde / Reverse Vector Marker) - ON SCREEN */}
          {tviInfo.antiTvi && tviInfo.antiTvi.isOnScreen && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75 ease-out z-20"
              style={{
                left: `${tviInfo.antiTvi.screenX}px`,
                top: `${tviInfo.antiTvi.screenY}px`,
              }}
            >
              <div className="relative flex flex-col items-center justify-center">
                {/* Retrograde Marker SVG */}
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 36 36"
                  className="overflow-visible filter drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                >
                  {/* Central Ring */}
                  <circle
                    cx="18"
                    cy="18"
                    r="7"
                    fill="rgba(245, 158, 11, 0.12)"
                    stroke="#f59e0b"
                    strokeWidth="1.6"
                  />
                  {/* Center Cross 'X' */}
                  <line x1="14" y1="14" x2="22" y2="22" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="22" y1="14" x2="14" y2="22" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
                  {/* Left Wing */}
                  <line x1="2" y1="18" x2="11" y2="18" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
                  {/* Right Wing */}
                  <line x1="25" y1="18" x2="34" y2="18" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
                  {/* Bottom Vertical Fin */}
                  <line x1="18" y1="25" x2="18" y2="34" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
                </svg>

                {/* ATVI Telemetry Tag */}
                <div className="absolute top-9 whitespace-nowrap bg-transparent border border-amber-500/60 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider text-amber-300 shadow-lg flex items-center gap-1">
                  <span className="font-bold text-amber-400">ATVI</span>
                  <span className="text-slate-300">RETRO</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 4. TOP STATUS BAR: SENSORS & ARENA STATUS */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3 bg-transparent border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-slate-400">NETWORK ARENA:</span>
          {connectedPilotsCount >= 2 ? (
            <span className="text-emerald-400 font-semibold">{connectedPilotsCount} PILOTS CONNECTED (1v1 ACTIVE)</span>
          ) : (
            <span className="text-amber-400 font-semibold">1 PILOT (AWAITING OPPONENT)</span>
          )}
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">PING:</span>
          <span className="text-cyan-300 font-mono">{ping}ms</span>
        </div>

        {/* Center Compass / Heading */}
        <div className="flex items-center gap-2 bg-transparent border border-cyan-500/30 px-4 py-1 rounded-lg text-xs tracking-widest">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300">350° NNE // DEEP SPACE ARENA</span>
        </div>

        {/* Score & Target Cycle Button */}
        <div className="flex items-center gap-3">
          <div className="bg-transparent border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400 mr-2">COMBAT SCORE:</span>
            <span className="text-amber-400 font-mono font-bold text-sm">{score}</span>
          </div>

          <button
            onClick={onCycleTarget}
            className="flex items-center gap-1.5 bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors active:scale-95"
            title={`Cycle Next Target (Press ${cycleKeyLabel})`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>CYCLE TARGET [{cycleKeyLabel}]</span>
          </button>
        </div>
      </div>

      {/* 5. LEFT MFD: THROTTLE, SPEEDOMETER & V-JOYSTICK CONTROLS */}
      <div className="absolute bottom-8 left-8 bg-transparent border border-cyan-500/30 p-4 rounded-xl w-60 flex flex-col gap-2.5 shadow-xl">
        <div className="flex items-center justify-between text-xs tracking-wider border-b border-cyan-500/20 pb-1 text-slate-400">
          <span>VELOCITY & SCM</span>
          <span className="text-cyan-400 font-mono">6-DoF</span>
        </div>

        {/* Speed Digit Readout */}
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-bold font-mono tracking-tight text-white">
            {speed}
            <span className="text-xs text-cyan-400 font-normal ml-1">M/S</span>
          </div>
          <div className="text-right text-xs">
            <div className="text-slate-400 flex items-center justify-end gap-1">
              <span>LIMIT</span>
              {speed > 320 && !physicsState.boostActive && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/20 px-1 rounded animate-pulse" title="Speed exceeds 320m/s. Boost required to accelerate along travel vector.">
                  OVER SCM
                </span>
              )}
            </div>
            <div className={`font-mono font-semibold ${physicsState.boostActive ? 'text-amber-300' : 'text-cyan-300'}`}>
              {physicsState.speedLimit} M/S
            </div>
          </div>
        </div>

        {/* Speed Bar with SCM (320 m/s) and Boost (500 m/s) markers */}
        <div className="relative w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
          {/* SCM 320 m/s threshold tick (64%) */}
          <div className="absolute top-0 bottom-0 left-[64%] w-0.5 bg-cyan-400/50 z-10" title="SCM Limit: 320 m/s" />
          <div
            className={`h-full transition-all duration-100 ${
              physicsState.boostActive
                ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                : speed > 320
                ? 'bg-amber-500/80 shadow-[0_0_6px_#f59e0b]'
                : 'bg-cyan-400'
            }`}
            style={{ width: `${Math.min(100, (speed / 500) * 100)}%` }}
          />
        </div>

        {/* Throttle & G-Force */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800">
          <div>
            <div className="text-slate-500 text-[10px]">THROTTLE</div>
            <div className="text-cyan-300 font-mono font-medium">{throttlePercent}%</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">G-LOAD</div>
            <div className="text-amber-400 font-mono font-medium">{gForce} G</div>
          </div>
        </div>

        {/* TVI Vector & Drift Readout */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${tviInfo && tviInfo.speed > 0.4 ? 'bg-cyan-400 animate-pulse shadow-[0_0_6px_#22d3ee]' : 'bg-slate-600'}`} />
            <span className="text-slate-400 text-[10px] tracking-wider">TVI VECTOR</span>
          </div>
          <div className="font-mono text-[11px]">
            {tviInfo && tviInfo.speed > 0.4 ? (
              <span className={tviInfo.driftAngleDeg > 15 ? 'text-amber-400 font-bold' : 'text-cyan-300'}>
                {tviInfo.driftAngleDeg}° DRIFT {tviInfo.tvi?.isOnScreen ? '· ON-HUD' : '· OFF-SCREEN'}
              </span>
            ) : (
              <span className="text-slate-500 font-mono text-[10px]">PARKED</span>
            )}
          </div>
        </div>

        {/* IFCS Mode Switcher */}
        <button
          onClick={onToggleDecoupled}
          className={`pointer-events-auto mt-0.5 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wider cursor-pointer border transition-colors ${
            isDecoupled
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
              : 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 hover:bg-cyan-900/40'
          }`}
          title={`Toggle Coupled / Decoupled Mode (Press ${decoupledKeyLabel})`}
        >
          {isDecoupled ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>IFCS: DECOUPLED (DRIFT)</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>IFCS: COUPLED [{decoupledKeyLabel}]</span>
            </>
          )}
        </button>

        {/* Virtual Joystick Quick Controls */}
        <div className="pointer-events-auto pt-2 border-t border-slate-800 flex gap-2">
          <button
            onClick={onRecenterJoystick}
            className="flex-1 py-1 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-mono flex items-center justify-center gap-1 cursor-pointer transition-colors"
            title={`Recenter Stick to (0,0) (Press ${recenterKeyLabel} or Right Click)`}
          >
            <RotateCcw className="w-3 h-3 text-cyan-400" />
            <span>CENTER [{recenterKeyLabel}]</span>
          </button>
          <button
            onClick={onToggleInvertPitch}
            className={`py-1 px-2 border rounded text-[11px] font-mono flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              virtualJoystick.isInverted
                ? 'bg-amber-950/50 border-amber-500 text-amber-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title={`Toggle Pitch Inversion (Press ${invertKeyLabel})`}
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>{virtualJoystick.isInverted ? `INV [${invertKeyLabel}]` : 'NORM'}</span>
          </button>
        </div>
      </div>

      {/* 6. RIGHT MFD: SHIELD & HULL INTEGRITY */}
      <div className="absolute bottom-8 right-8 bg-transparent border border-cyan-500/30 p-4 rounded-xl w-60 flex flex-col gap-2.5 shadow-xl">
        <div className="flex items-center justify-between text-xs tracking-wider border-b border-cyan-500/20 pb-1 text-slate-400">
          <span>DEFENSE & WEAPONS</span>
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
        </div>

        {/* Shield Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-cyan-400">SHIELDS</span>
            <span className="font-mono text-cyan-300">
              {Math.min(100, Math.max(0, Math.round((playerShield / 200) * 100)))}% ({Math.round(playerShield)}/200 HP)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(0, (playerShield / 200) * 100))}%` }}
            />
          </div>
        </div>

        {/* Hull Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-red-400">HULL INTEGRITY</span>
            <span className="font-mono text-red-300">
              {Math.min(100, Math.max(0, Math.round((playerHull / 120) * 100)))}% ({Math.round(playerHull)}/120 HP)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(0, (playerHull / 120) * 100))}%` }}
            />
          </div>
        </div>

        {/* Weapon Capacitor Bar */}
        <div className="pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-amber-400 flex items-center gap-1"><Zap className="w-3 h-3" /> CAPACITOR</span>
            <span className="font-mono text-amber-300">{Math.round(weaponCapacitor)}/75</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${weaponCapacitor > 15 ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`}
              style={{ width: `${(weaponCapacitor / 75) * 100}%` }}
            />
          </div>
        </div>

        {/* Virtual Joystick Telemetry Summary */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[10px] font-mono">
          <div className="text-slate-400 font-bold uppercase flex justify-between">
            <span>V-JOYSTICK PITCH</span>
            <span className="text-cyan-300">{pitchPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all duration-75"
              style={{
                width: `${Math.abs(pitchPercent) / 2}%`,
                marginLeft: pitchPercent < 0 ? `${50 - Math.abs(pitchPercent) / 2}%` : '50%',
              }}
            />
          </div>

          <div className="text-slate-400 font-bold uppercase flex justify-between pt-1">
            <span>V-JOYSTICK YAW</span>
            <span className="text-amber-300">{yawPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-amber-400 transition-all duration-75"
              style={{
                width: `${Math.abs(yawPercent) / 2}%`,
                marginLeft: yawPercent < 0 ? `${50 - Math.abs(yawPercent) / 2}%` : '50%',
              }}
            />
          </div>
        </div>
      </div>

      {/* 7. SHIP DESTRUCTION & 5-SECOND RESPAWN OVERLAY */}
      {(playerIsDead || playerHull <= 0) && (
        <div className="absolute inset-0 bg-red-950/60 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-6 animate-fade-in pointer-events-auto">
          <div className="bg-slate-950/95 border-2 border-red-500 p-8 rounded-2xl max-w-lg shadow-[0_0_80px_rgba(239,68,68,0.6)] flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)]">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-widest text-red-500 uppercase font-mono">
                CRITICAL SYSTEM FAILURE
              </h2>
              <p className="text-slate-300 text-sm mt-1 tracking-wider font-mono">
                HULL INTEGRITY COMPROMISED // SHIP DESTROYED
              </p>
            </div>
            <div className="w-full bg-slate-900 border border-red-500/50 py-4 px-6 rounded-xl flex items-center justify-between shadow-inner">
              <span className="text-xs text-slate-400 font-mono tracking-widest">EMERGENCY RESPAWN:</span>
              <span className="text-3xl font-bold font-mono text-amber-400 animate-pulse">
                {respawnCountdown && respawnCountdown > 0 ? `${respawnCountdown} SECONDS` : 'RE-DEPLOYING...'}
              </span>
            </div>
            <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-amber-400 transition-all duration-1000"
                style={{ width: `${((respawnCountdown || 0) / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
