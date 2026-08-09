import './MatchResultsScreen.css';
import type { LiveScore } from '../../firebase/multiplayer/networkTypes';

export interface MatchEndResult {
  winnerUid:       string;
  winnerCallsign:  string;
  scoreboard:      LiveScore[];
  durationSeconds: number;
}

interface MatchResultsScreenProps {
  result:      MatchEndResult;
  localUid:    string;
  onPlayAgain: () => void;
  onMainMenu:  () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PLACEMENT_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function MatchResultsScreen({
  result,
  localUid,
  onPlayAgain,
  onMainMenu,
}: MatchResultsScreenProps) {
  const xpPerKill    = 50;
  const winnerBonus  = 300;

  return (
    <div className="results-screen">
      <div className="results-panel">
        {/* Header — winner callout */}
        <div className="results-header">
          <div className="results-winner-label">MATCH WINNER</div>
          <div className="results-winner-name">{result.winnerCallsign}</div>
          <div className="results-duration">
            MATCH DURATION — {formatTime(result.durationSeconds)}
          </div>
        </div>

        {/* Scoreboard */}
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>#</th>
                <th>PILOT</th>
                <th>KILLS</th>
                <th>DEATHS</th>
                <th>SCORE</th>
                <th>XP EARNED</th>
              </tr>
            </thead>
            <tbody>
              {result.scoreboard.map((player, index) => {
                const placement  = index + 1;
                const isWinner   = player.uid === result.winnerUid;
                const isLocal    = player.uid === localUid;
                const xpEarned   = player.kills * xpPerKill + (isWinner ? winnerBonus : 0);
                const score      = player.kills * 100;

                return (
                  <tr
                    key={player.uid}
                    className={`results-row-${placement <= 3 ? placement : ''}`}
                  >
                    <td>
                      <span className={`results-placement p${placement}`}>
                        {PLACEMENT_ICONS[placement] ?? `#${placement}`}
                      </span>
                    </td>
                    <td>
                      <span className={`results-callsign ${isLocal ? 'results-you' : ''}`}>
                        {player.callsign} {isLocal && '(YOU)'}
                      </span>
                    </td>
                    <td className="kd-kills">{player.kills}</td>
                    <td className="kd-deaths">{player.deaths}</td>
                    <td>{score.toLocaleString()}</td>
                    <td>
                      <span className="results-xp-badge">+{xpEarned} XP</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="results-footer">
          <button id="btn-play-again" className="results-btn results-btn-lobby" onClick={onPlayAgain}>
            PLAY AGAIN
          </button>
          <button id="btn-main-menu-results" className="results-btn results-btn-menu" onClick={onMainMenu}>
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
