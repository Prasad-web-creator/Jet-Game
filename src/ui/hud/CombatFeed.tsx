/**
 * CombatFeed — live event log HUD overlay.
 *
 * Displays action notifications (player joined, spawned, gun fired, missile launched,
 * damage dealt, destroyed) for exactly 2 seconds before auto-dismissing.
 */
import { useState, useEffect } from 'react';
import { globalEventBus } from '../../game/core/EventBus';

export interface CombatLogItem {
  id:        string;
  text:      string;
  type:      'join' | 'spawn' | 'gun' | 'missile' | 'hit' | 'death' | 'info';
  timestamp: number;
}

export function CombatFeed() {
  const [logs, setLogs] = useState<CombatLogItem[]>([]);

  useEffect(() => {
    const handleLog = (payload: { text: string; type?: CombatLogItem['type'] }) => {
      const newItem: CombatLogItem = {
        id:        `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        text:      payload.text,
        type:      payload.type ?? 'info',
        timestamp: Date.now(),
      };

      setLogs((prev) => [...prev.slice(-4), newItem]); // Keep max 5 recent logs

      // Auto-remove message after 2.0 seconds
      setTimeout(() => {
        setLogs((current) => current.filter((item) => item.id !== newItem.id));
      }, 2000);
    };

    globalEventBus.on('COMBAT_LOG_EVENT', handleLog);
    return () => globalEventBus.off('COMBAT_LOG_EVENT', handleLog);
  }, []);

  if (logs.length === 0) return null;

  return (
    <div
      id="hud-combat-feed"
      style={{
        position: 'absolute',
        top: 80,
        left: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 220,
        pointerEvents: 'none',
        fontFamily: "'Orbitron', monospace",
      }}
    >
      {logs.map((log) => {
        const color =
          log.type === 'join' || log.type === 'spawn'
            ? '#00ff88'
            : log.type === 'gun' || log.type === 'missile'
            ? '#ffaa00'
            : log.type === 'death'
            ? '#ff4444'
            : '#00b4ff';

        return (
          <div
            key={log.id}
            style={{
              background: 'rgba(6, 16, 32, 0.88)',
              borderLeft: `4px solid ${color}`,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              padding: '6px 14px',
              borderRadius: '0 4px 4px 0',
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: 1,
              backdropFilter: 'blur(8px)',
              boxShadow: `0 0 10px ${color}44`,
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            <span style={{ color, marginRight: 6 }}>●</span>
            {log.text}
          </div>
        );
      })}
    </div>
  );
}
