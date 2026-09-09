'use client';

/**
 * Scoreboard — displays player names, scores, and active turn indicator.
 *
 * Theme: White and Gold with Teal.
 * Crisp white surfaces, deep teal & rich gold accents, and high-contrast typography.
 */

import React from 'react';
import { useGame } from '@/components/GameProvider';

const PLAYER_AVATARS = [
  'from-[#0D5C58] to-[#083D3A]', // Stately Deep Teal
  'from-[#C5A059] to-[#996515]', // Polished Antique Gold
  'from-[#14746F] to-[#0A4743]', // Royal Teal
];

interface ScoreboardProps {
  /** Optional: highlight the player whose turn it is. */
  activePlayerId?: string | null;
  /** Layout direction. Defaults to 'horizontal'. */
  layout?: 'horizontal' | 'vertical';
}

export default function Scoreboard({
  activePlayerId = null,
  layout = 'horizontal',
}: ScoreboardProps) {
  const { state } = useGame();
  const { players } = state;

  return (
    <div
      className={`flex gap-3 ${
        layout === 'vertical' ? 'flex-col' : 'flex-row'
      }`}
    >
      {players.map((player, i) => {
        const isActive = player.id === activePlayerId;
        const avatarGradient = PLAYER_AVATARS[i % PLAYER_AVATARS.length];

        return (
          <div
            key={player.id}
            className={`scoreboard-card flex items-center gap-3 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 transition-all duration-200 relative ${
              isActive
                ? 'scoreboard-card-active bg-[#FDFBF7] border-2 border-[#C5A059]'
                : 'bg-white border border-slate-200'
            }`}
            style={{
              flex: layout === 'horizontal' ? '1' : undefined,
            }}
          >
            {/* Avatar */}
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarGradient} text-base font-extrabold text-white shadow-sm border border-white/20`}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>

            {/* Name + score */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p
                  className={`truncate text-sm sm:text-base font-bold ${
                    isActive ? 'text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {player.name}
                </p>
                {isActive && (
                  <span className="rounded-md bg-[#C5A059] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-xs shrink-0">
                    TURN
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <p
                  className={`text-xl sm:text-2xl font-black tabular-nums ${
                    isActive ? 'text-[#0D5C58]' : 'text-slate-900'
                  }`}
                >
                  {player.score}
                </p>
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  pts
                </span>
              </div>
            </div>

            {/* Turn indicator pulse dot */}
            {isActive && (
              <div className="flex-shrink-0 flex items-center justify-center">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C5A059] opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#C5A059]" />
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
