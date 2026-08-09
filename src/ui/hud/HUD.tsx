import { memo, useState, useEffect, useRef } from 'react';
import type { GameState } from '../../types';
import { GamePhase, FlightPhase } from '../../types';
import { globalEventBus } from '../../game/core/EventBus';
import { CombatFeed } from './CombatFeed';
import './HUD.css';

/**
 * HUD — Heads-Up Display overlay.
 *
 * PERF (Task 23): High-Frequency Event Architecture
 *  - Global `GameState` via props is only used for low-frequency data (health, phase, score, weapons).
 *  - High-frequency data (speed, altitude, pitch, roll, screen projections) bypasses GamePage 
 *    reconciliation entirely. Individual sub-components subscribe directly to `globalEventBus` 
 *    and manage local state to achieve smooth 60 FPS updates without GC stutter.
 */

interface HUDProps {
  gameState: GameState;
  fps?: number;
}

// ── Heading compass labels ────────────────────────────────────────────────────
function headingLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

// ── Heading compass ribbon tape (Event Driven 60 Hz) ─────────────────────────
const CompassRibbon = memo(function CompassRibbon() {
  const [headingDeg, setHeadingDeg] = useState(0);

  useEffect(() => {
    let lastHeading = -1;
    const onTelemetry = (data: any) => {
      const h = Math.round(data.heading);
      if (h !== lastHeading) {
        lastHeading = h;
        setHeadingDeg(h);
      }
    };
    globalEventBus.on('HUD_TELEMETRY_UPDATE', onTelemetry);
    return () => globalEventBus.off('HUD_TELEMETRY_UPDATE', onTelemetry);
  }, []);

  const cardinalMap: Record<number, string> = {
    0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW', 360: 'N'
  };

  const ticks = [];
  for (let i = -90; i <= 90; i += 15) {
    const angle   = (headingDeg + i + 360) % 360;
    const rounded = Math.round(angle / 15) * 15;
    const label   = cardinalMap[rounded] ?? `${String(rounded).padStart(3, '0')}°`;
    ticks.push({ offset: i, label });
  }

  return (
    <div className="hud-compass-ribbon">
      <div className="hud-compass-center-indicator">▼</div>
      <div className="hud-compass-tape">
        {ticks.map((t, idx) => (
          <div
            key={idx}
            className="hud-compass-tick"
            style={{ transform: `translateX(${t.offset * 2.8}px)` }}
          >
            <span className="hud-compass-mark">|</span>
            <span className="hud-compass-text">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Pitch Ladder & Artificial Horizon (Event Driven 60 Hz) ───────────────────
const PitchLadder = memo(function PitchLadder() {
  const [pitchDeg, setPitchDeg] = useState(0);
  const [rollDeg, setRollDeg] = useState(0);

  useEffect(() => {
    let lastP = 0, lastR = 0;
    const onTelemetry = (data: any) => {
      if (Math.abs(data.pitch - lastP) > 0.009 || Math.abs(data.roll - lastR) > 0.009) {
        lastP = data.pitch;
        lastR = data.roll;
        setPitchDeg(Math.round((data.pitch * 180) / Math.PI));
        setRollDeg(Math.round((data.roll * 180) / Math.PI));
      }
    };
    globalEventBus.on('HUD_TELEMETRY_UPDATE', onTelemetry);
    return () => globalEventBus.off('HUD_TELEMETRY_UPDATE', onTelemetry);
  }, []);

  return (
    <div className="hud-pitch-container" style={{ transform: `rotate(${-rollDeg}deg)` }}>
      <svg width="240" height="240" viewBox="-120 -120 240 240" className="hud-pitch-svg">
        <line x1="-90" y1={pitchDeg * 2.2} x2="-25" y2={pitchDeg * 2.2} stroke="rgba(0,255,136,0.7)" strokeWidth="1.5" />
        <line x1="25"  y1={pitchDeg * 2.2} x2="90"  y2={pitchDeg * 2.2} stroke="rgba(0,255,136,0.7)" strokeWidth="1.5" />
        <line x1="-50" y1={(pitchDeg - 15) * 2.2} x2="-20" y2={(pitchDeg - 15) * 2.2} stroke="rgba(0,255,136,0.5)" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="20"  y1={(pitchDeg - 15) * 2.2} x2="50"  y2={(pitchDeg - 15) * 2.2} stroke="rgba(0,255,136,0.5)" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="-50" y1={(pitchDeg + 15) * 2.2} x2="-20" y2={(pitchDeg + 15) * 2.2} stroke="rgba(0,255,136,0.5)" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="20"  y1={(pitchDeg + 15) * 2.2} x2="50"  y2={(pitchDeg + 15) * 2.2} stroke="rgba(0,255,136,0.5)" strokeWidth="1" strokeDasharray="4 2" />
        <circle cx="0" cy="0" r="7" stroke="rgba(0,255,200,0.9)" strokeWidth="1.5" fill="none" />
        <line x1="-14" y1="0"   x2="-7" y2="0"   stroke="rgba(0,255,200,0.9)" strokeWidth="1.5" />
        <line x1="7"   y1="0"   x2="14" y2="0"   stroke="rgba(0,255,200,0.9)" strokeWidth="1.5" />
        <line x1="0"   y1="-14" x2="0"  y2="-7"  stroke="rgba(0,255,200,0.9)" strokeWidth="1.5" />
      </svg>
    </div>
  );
});

// ── Target Screen-Space Tracking Reticle (Event Driven 60 Hz) ──────────────────
// ── Target Screen-Space Tracking Reticle ───────────────────────────────────────
const TargetTrackingReticle = memo(function TargetTrackingReticle() {
  const [lState, setLState] = useState<any>(null);

  useEffect(() => {
    const onTargetUpdate = (data: any) => setLState(data);
    globalEventBus.on('HUD_TARGET_UPDATE', onTargetUpdate);
    return () => globalEventBus.off('HUD_TARGET_UPDATE', onTargetUpdate);
  }, []);

  if (!lState || !lState.screenPos || lState.screenPos.isBehind) return null;

  const { x, y }  = lState.screenPos;
  const isLocked  = lState.lockState === 'locked';
  const isLocking = lState.lockState === 'locking';
  const distanceM = lState.distance !== undefined ? Math.round(lState.distance) : undefined;
  const lockPct   = Math.round((lState.lockProgress ?? 0) * 100);

  return (
    <div
      className={`hud-target-reticle ${isLocked ? 'hud-target-reticle--locked' : ''}`}
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <div className="hud-target-box">
        <div className="target-corner corner-tl" />
        <div className="target-corner corner-tr" />
        <div className="target-corner corner-bl" />
        <div className="target-corner corner-br" />
      </div>

      <div className="hud-target-label-box">
        <span className="target-name">{lState.targetName ?? 'TARGET'}</span>
        {lState.health !== undefined && lState.maxHealth !== undefined && (
          <div style={{ width: '100%', height: '3px', background: 'rgba(255, 255, 255, 0.2)', marginTop: '2px', marginBottom: '2px' }}>
            <div style={{
              width: `${Math.max(0, (lState.health / lState.maxHealth) * 100)}%`,
              height: '100%',
              background: (lState.health / lState.maxHealth) > 0.5 ? '#00ff88' : (lState.health / lState.maxHealth) > 0.25 ? '#ffb400' : '#ff3737',
              transition: 'width 0.1s ease-out'
            }} />
          </div>
        )}
        {distanceM !== undefined && <span className="target-dist">{distanceM} M</span>}
        {isLocking && <span className="target-lock-pct">LOCK {lockPct}%</span>}
        {isLocked  && <span className="target-locked-text">LOCKED</span>}
      </div>
    </div>
  );
});

// ── Flight Instruments ────────────────────────────────────────────────────────
const FlightInstruments = memo(function FlightInstruments() {
  const [telemetry, setTelemetry] = useState({ speed: 0, altitude: 0, heading: 0, throttle: 0 });

  useEffect(() => {
    const onTelemetry = (data: any) => {
      setTelemetry({
        speed: data.speed ?? 0,
        altitude: data.altitude ?? 0,
        heading: data.heading ?? 0,
        throttle: data.throttle ?? 0,
      });
    };
    globalEventBus.on('HUD_TELEMETRY_UPDATE', onTelemetry);
    return () => globalEventBus.off('HUD_TELEMETRY_UPDATE', onTelemetry);
  }, []);

  const speedKmh   = Math.round(telemetry.speed * 3.6);
  const speedKts   = Math.round(telemetry.speed * 1.94384);
  const altM       = Math.round(telemetry.altitude);
  const altFt      = Math.round(telemetry.altitude * 3.28084);
  const headingDeg = Math.round(telemetry.heading);
  const throttle   = Math.min(1, Math.max(0, telemetry.throttle));
  const isBoosting = telemetry.speed > 350;
  const isBraking  = telemetry.speed < 80 && throttle < 0.15;

  return (
    <div className="hud-section hud-bottom-center">
      <span className="hud-instrument">
        <span className="hud-label">SPD</span>
        <span className={`hud-value hud-value--large ${isBoosting ? 'hud-value--boost' : ''}`}>
          {speedKmh ? String(speedKmh) : '000'}
        </span>
        <span className="hud-unit">km/h ({speedKts} kts)</span>
      </span>

      <span className="hud-instrument-divider" />

      <span className="hud-instrument">
        <span className="hud-label">ALT</span>
        <span className="hud-value hud-value--large">{altM.toLocaleString() || '000'}</span>
        <span className="hud-unit">m ({altFt} ft)</span>
      </span>

      <span className="hud-instrument-divider" />

      <span className="hud-instrument">
        <span className="hud-label">HDG</span>
        <span className="hud-value hud-value--large">
          {`${String(headingDeg).padStart(3, '0')}°`}
        </span>
        <span className="hud-unit">{headingLabel(headingDeg)}</span>
      </span>

      <span className="hud-instrument-divider" />
      <span className="hud-instrument">
        <span className="hud-label">THR</span>
        <div className="hud-throttle-track">
          <div
            className={`hud-throttle-fill ${isBoosting ? 'hud-throttle-fill--boost' : ''}`}
            style={{ height: `${throttle * 100}%` }}
          />
        </div>
        {isBoosting && <span className="hud-status-tag hud-status-tag--boost">BOOST</span>}
        {isBraking  && <span className="hud-status-tag hud-status-tag--brake">BRAKE</span>}
      </span>
    </div>
  );
});

// ── Weapon / Lock Panel (Event Driven 60 Hz for lock, Props for Weapons) ─────
const WeaponPanel = memo(function WeaponPanel({
  weaponState,
  isTouch,
}: {
  weaponState: GameState['weaponState'];
  isTouch: boolean;
}) {
  const [lState, setLState] = useState<any>(null);

  useEffect(() => {
    const onTargetUpdate = (data: any) => setLState(data);
    globalEventBus.on('HUD_TARGET_UPDATE', onTargetUpdate);
    return () => globalEventBus.off('HUD_TARGET_UPDATE', onTargetUpdate);
  }, []);

  const wState    = weaponState;
  const wName     = wState?.name ?? 'M61 VULCAN 20MM';
  const ammoText  = wState ? `${wState.ammo} / ${wState.maxAmmo}` : '500 / 500';
  const heatPct   = Math.min(100, Math.max(0, Math.round((wState?.heat ?? 0) * 100)));
  const isOverheated = wState?.isOverheated ?? false;
  const isLocked  = lState?.lockState === 'locked';
  const isLocking = lState?.lockState === 'locking';

  const heatColor =
    isOverheated || heatPct > 85 ? 'rgba(255, 50, 50, 0.95)'
    : heatPct > 50 ? 'rgba(255, 170, 0, 0.9)'
    : 'rgba(0, 255, 136, 0.85)';

  return (
    <div className={`hud-section hud-bottom-right ${isTouch ? 'hud-bottom-right--touch' : ''}`}>
      {isLocked && (
        <div className="hud-status-tag" style={{ background: 'rgba(255, 35, 35, 0.95)', color: '#fff', fontSize: 11, fontWeight: 'bold', padding: '4px 8px', borderRadius: 3, marginBottom: 6, letterSpacing: 2, textAlign: 'center', boxShadow: '0 0 12px rgba(255, 0, 0, 0.8)' }}>
          🎯 LOCKED: {lState?.targetName ?? 'TARGET'}
        </div>
      )}
      {isLocking && (
        <div className="hud-status-tag" style={{ background: 'rgba(255, 180, 0, 0.9)', color: '#000', fontSize: 10, fontWeight: 'bold', padding: '3px 6px', borderRadius: 3, marginBottom: 6, letterSpacing: 1.5, textAlign: 'center' }}>
          LOCKING {Math.round((lState?.lockProgress ?? 0) * 100)}%
        </div>
      )}

      <div className="hud-row">
        <span className="hud-label">GUN</span>
        <span className="hud-value hud-value--green">{wName}</span>
      </div>
      <div className="hud-row" style={{ marginTop: 2 }}>
        <span className="hud-label">AMMO</span>
        <span className="hud-value">{ammoText}</span>
      </div>
      <div className="hud-row" style={{ marginTop: 4, alignItems: 'center' }}>
        <span className="hud-label" style={{ fontSize: 9 }}>HEAT</span>
        <div className="hud-bar-track" style={{ width: 75, height: 5, marginLeft: 8 }}>
          <div
            className="hud-bar-fill"
            style={{ width: `${heatPct}%`, background: heatColor, transition: 'width 0.05s ease' }}
          />
        </div>
      </div>
      {isOverheated && (
        <div className="hud-status-tag hud-status-tag--brake" style={{ marginTop: 4, background: 'rgba(255, 30, 30, 0.9)', color: '#fff' }}>
          ⚠ OVERHEAT LOCKOUT
        </div>
      )}

      <div className="hud-row" style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(0, 255, 136, 0.2)' }}>
        <span className="hud-label">MISSILE</span>
        <span className="hud-value" style={{ color: isLocked ? '#ff4444' : '#00ff88' }}>
          AIM-9 (6/6)
        </span>
      </div>
    </div>
  );
});

// ── Takeoff Overlay (Event Driven 60 Hz) ────────────────────────────────────
const TakeoffOverlay = memo(function TakeoffOverlay() {
  const [phase, setPhase] = useState<FlightPhase>(FlightPhase.Airborne);
  const [gear, setGear] = useState(false);
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    const onTelemetry = (data: any) => {
      setPhase(data.flightPhase ?? FlightPhase.Airborne);
      setGear(data.gearDown ?? false);
      setSpeed(data.speed);
    };
    globalEventBus.on('HUD_TELEMETRY_UPDATE', onTelemetry);
    return () => globalEventBus.off('HUD_TELEMETRY_UPDATE', onTelemetry);
  }, []);

  if (phase === FlightPhase.Airborne && !gear) return null;

  const speedKts = Math.round(speed * 1.94384);

  return (
    <div className="hud-takeoff-overlay">
      {phase === FlightPhase.Parked && (
        <>
          <div className="takeoff-title">READY FOR TAKEOFF</div>
          <div className="takeoff-sub">RUNWAY 09</div>
          <div className="takeoff-hint">RELEASE BRAKES (SHIFT) TO ROLL</div>
        </>
      )}
      {phase === FlightPhase.TakeoffRoll && (
        <>
          <div className="takeoff-title">TAKEOFF ROLL</div>
          <div className="takeoff-sub">ROTATION SPEED: 155 kts</div>
          <div className="takeoff-hint">SPEED: {speedKts} kts</div>
        </>
      )}
      {phase === FlightPhase.Rotation && (
        <>
          <div className="takeoff-title takeoff-title--highlight">ROTATE</div>
          <div className="takeoff-sub">ROTATION SPEED REACHED</div>
          <div className="takeoff-hint">PULL UP (MOUSE DOWN)</div>
        </>
      )}
      {phase === FlightPhase.Airborne && gear && (
        <>
          <div className="takeoff-title takeoff-title--highlight">AIRBORNE</div>
          <div className="takeoff-hint">PRESS G TO RAISE GEAR</div>
        </>
      )}
    </div>
  );
});

// ── Main HUD component ────────────────────────────────────────────────────────
function HUD({ gameState, fps = 0 }: HUDProps) {
  // ── Controls auto-hide (15 seconds) ──────────────────────────────────────
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    hideTimerRef.current = setTimeout(() => setShowControls(false), 15000);
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  if (gameState.phase !== GamePhase.Playing) return null;

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const forceTouch = urlParams?.get('touch') === 'true' || urlParams?.get('mobile') === 'true';

  const isTouch =
    forceTouch ||
    (typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0));

  const aircraft   = gameState.playerAircraft;
  const healthPct  = aircraft ? Math.max(0, aircraft.health / aircraft.maxHealth) : 1;
  const boostPct   = aircraft ? Math.max(0, aircraft.boostFuel / 100) : 1;

  const fpsColor =
    fps >= 50 ? 'rgba(0,255,136,0.9)'
    : fps >= 30 ? 'rgba(255,200,0,0.9)'
    : 'rgba(255,60,60,0.9)';

  const healthColor =
    healthPct > 0.55 ? 'rgba(0,255,136,0.85)'
    : healthPct > 0.25 ? 'rgba(255,180,0,0.90)'
    : 'rgba(255,55,55,0.95)';

  const boostColor = 'rgba(0,180,255,0.9)';

  const threatState          = gameState.threatState;
  const isRadarDetected      = threatState?.isRadarDetected ?? false;
  const samLockState         = threatState?.samLockState ?? 'none';
  const incomingMissileCount = threatState?.incomingMissileCount ?? 0;

  return (
    <div id="hud-overlay" className="hud-overlay">
      {/* Low Health Flashing Vignette */}
      {healthPct <= 0.25 && <div className="hud-low-health-vignette" />}

      {/* Dynamic Heading Compass Tape — Event-driven 60 Hz */}
      <CompassRibbon />

      {/* Artificial Horizon — Event-driven 60 Hz */}
      <PitchLadder />

      {/* 2D Target Tracking Reticle — Event-driven 60 Hz */}
      <TargetTrackingReticle />

      {/* ── Top-left: System status ─────────────────────────────────── */}
      <div className="hud-section hud-top-left">
        <div className="hud-row">
          <span className="hud-label">STATUS</span>
          <span className="hud-value hud-value--green">ACTIVE</span>
        </div>

        <div className="hud-row" style={{ marginTop: 8 }}>
          <span className="hud-label">HEALTH</span>
          <span className="hud-value" style={{ color: healthColor }}>
            {Math.round(healthPct * 100)}%
          </span>
        </div>
        <div className="hud-bar-track" style={{ marginTop: 4 }}>
          <div className="hud-bar-fill" style={{ width: `${healthPct * 100}%`, background: healthColor }} />
        </div>

        <div className="hud-row" style={{ marginTop: 8 }}>
          <span className="hud-label">BOOST</span>
          <span className="hud-value" style={{ color: boostColor }}>
            {Math.round(boostPct * 100)}%
          </span>
        </div>
        <div className="hud-bar-track" style={{ marginTop: 4 }}>
          <div className="hud-bar-fill" style={{ width: `${boostPct * 100}%`, background: boostColor }} />
        </div>
      </div>

      {/* ── Centre: Critical Damage & Threat Warnings ─────────────── */}
      {healthPct <= 0.25 && healthPct > 0 && (
        <div className="hud-critical-warning">WARNING: CRITICAL DAMAGE</div>
      )}

      {(samLockState === 'inbound' || incomingMissileCount > 0) ? (
        <div className="hud-threat-warning hud-threat-warning--inbound">
          ⚠️ MISSILE INBOUND ({incomingMissileCount})
        </div>
      ) : (samLockState === 'locking' || samLockState === 'locked') ? (
        <div className="hud-threat-warning hud-threat-warning--sam">⚠️ SAM LOCK WARNING</div>
      ) : isRadarDetected ? (
        <div className="hud-threat-warning hud-threat-warning--radar">⚠️ RADAR DETECTED</div>
      ) : null}

      {/* ── Top-centre: FPS ─────────────────────────────────────────── */}
      <div className="hud-fps" style={{ color: fpsColor }}>
        {fps > 0 ? `${fps} FPS` : '-- FPS'}
      </div>

      {/* ── Top-right: Mission Objectives ───────────────────────────── */}
      <div className="hud-section hud-top-right">
        <div className="hud-row">
          <span className="hud-label">SCORE</span>
          <span className="hud-value">{gameState.score.toLocaleString()}</span>
        </div>

        {gameState.currentMission && (
          <div className="hud-mission-tracker" style={{ marginTop: 8 }}>
            <div className="hud-mission-name">{gameState.currentMission.name.toUpperCase()}</div>
            <div className="hud-objectives-list">
              {gameState.currentMission.objectives.map((obj) => (
                <div key={obj.id} className={`hud-obj-item ${obj.isCompleted ? 'hud-obj-item--completed' : ''}`}>
                  <span className="hud-obj-check">{obj.isCompleted ? '✓' : '◇'}</span>
                  <span className="hud-obj-desc">{obj.description}</span>
                  {obj.requiredProgress !== undefined && (
                    <span className="hud-obj-prog"> ({obj.currentProgress ?? 0}/{obj.requiredProgress})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Centre: Takeoff Overlay ─────────────────────────────────── */}
      <TakeoffOverlay />

      {/* ── Centre: Crosshair ──────────────────────────────────────── */}
      <div className="hud-crosshair">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" stroke="rgba(0,0,0,0.35)" strokeWidth="2" fill="none" />
          <circle cx="24" cy="24" r="5"  stroke="rgba(0,0,0,0.40)" strokeWidth="2" fill="none" />
          <line x1="24" y1="0"  x2="24" y2="13" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          <line x1="24" y1="35" x2="24" y2="48" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          <line x1="0"  y1="24" x2="13" y2="24" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          <line x1="35" y1="24" x2="48" y2="24" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          
          <circle cx="24" cy="24" r="20" stroke="rgba(0,255,136,0.50)" strokeWidth="0.8" fill="none" />
          <circle cx="24" cy="24" r="5"  stroke="rgba(0,255,136,0.80)" strokeWidth="1"   fill="none" />
          <line x1="24" y1="0"  x2="24" y2="13" stroke="rgba(0,255,136,0.65)" strokeWidth="1" />
          <line x1="24" y1="35" x2="24" y2="48" stroke="rgba(0,255,136,0.65)" strokeWidth="1" />
          <line x1="0"  y1="24" x2="13" y2="24" stroke="rgba(0,255,136,0.65)" strokeWidth="1" />
          <line x1="35" y1="24" x2="48" y2="24" stroke="rgba(0,255,136,0.65)" strokeWidth="1" />
        </svg>
      </div>

      {/* ── Bottom-left: Controls hint (auto-hides after 15s) ──── */}
      {!isTouch && showControls && (
        <div className="hud-section hud-bottom-left hud-controls">
          <div className="hud-controls-title">CONTROLS</div>
          <div className="hud-controls-grid">
            <span className="hud-key">W/S</span>   <span className="hud-act">Throttle</span>
            <span className="hud-key">A/D</span>   <span className="hud-act">Roll</span>
            <span className="hud-key">MOUSE</span> <span className="hud-act">Aim</span>
            <span className="hud-key">SHIFT</span> <span className="hud-act">Brake</span>
            <span className="hud-key">SPACE</span> <span className="hud-act hud-boost-text">Boost</span>
            <span className="hud-key">F</span>     <span className="hud-act">Camera</span>
            <span className="hud-key">G</span>     <span className="hud-act">Gear</span>
            <span className="hud-key">TAB</span>   <span className="hud-act">Look back</span>
          </div>
        </div>
      )}

      {/* ── Bottom-centre: Flight instruments (Event-driven 60 Hz) ── */}
      <FlightInstruments />

      {/* ── Live 2-second combat event log feed ── */}
      <CombatFeed />

      {/* ── Bottom-right: Weapon & Lock ───────────────────────────── */}
      <WeaponPanel weaponState={gameState.weaponState} isTouch={isTouch} />
    </div>
  );
}

export default HUD;
