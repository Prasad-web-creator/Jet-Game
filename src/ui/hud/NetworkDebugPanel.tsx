/**
 * NetworkDebugPanel — Development-only overlay for multiplayer diagnostics.
 *
 * Displays live RTDB status, estimated latency (ms), buffer length, FPS,
 * and remote player list.
 */
import type { ConnectionState } from '../../firebase/multiplayer/PresenceService';
import type { NetworkManager } from '../../game/network/NetworkManager';

interface NetworkDebugPanelProps {
  connectionState: ConnectionState;
  fps:             number;
  networkManager:  NetworkManager | null;
}

export function NetworkDebugPanel({
  connectionState,
  fps,
  networkManager,
}: NetworkDebugPanelProps) {
  if (!networkManager) return null;

  const remotes = networkManager.getRemoteUids();
  const interpolator = (networkManager as any)._interpolator;

  const connColor =
    connectionState === 'connected'
      ? '#00ff88'
      : connectionState === 'reconnecting'
      ? '#ffaa00'
      : '#ff4444';

  return (
    <div
      id="net-debug-panel"
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        background: 'rgba(4, 12, 24, 0.88)',
        border: '1px solid rgba(0, 180, 255, 0.3)',
        borderRadius: 6,
        padding: '12px 16px',
        fontFamily: "'Orbitron', monospace",
        fontSize: 11,
        color: '#e0f0ff',
        backdropFilter: 'blur(8px)',
        zIndex: 300,
        pointerEvents: 'none',
        lineHeight: 1.6,
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0, 180, 255, 0.6)', marginBottom: 6 }}>
        NETWORK DIAGNOSTICS (DEV)
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>STATUS:</span>
        <span style={{ color: connColor, fontWeight: 'bold' }}>{connectionState.toUpperCase()}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>LOCAL FPS:</span>
        <span style={{ color: '#00ff88' }}>{fps}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>BROADCAST HZ:</span>
        <span>20 Hz</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>REMOTE PLAYERS:</span>
        <span style={{ color: remotes.length > 0 ? '#00ff88' : '#ffaa00' }}>
          {remotes.length > 0 ? remotes.length : '0 (Waiting for pilot...)'}
        </span>
      </div>

      {remotes.map((uid) => {
        const lat = interpolator?.getEstimatedLatency(uid) ?? 0;
        const buf = interpolator?.getBufferLength(uid) ?? 0;
        return (
          <div key={uid} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4, paddingLeft: 8 }}>
            • {uid.substring(0, 6)}: {lat} ms | buf: {buf}
          </div>
        );
      })}
    </div>
  );
}
