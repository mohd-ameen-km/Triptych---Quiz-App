'use client';

/**
 * ResultScreen — Final results and scoreboard page.
 *
 * Theme: White and Gold with Teal.
 * Displays:
 * - Top-ranking winners highlighted with gold podium styling.
 * - Scoreboard sorted in descending order of score.
 * - Game summary statistics in stately teal and polished gold.
 * - "New Game" button: resets state and returns to 'setup' phase (clears localStorage).
 */

import React, { useCallback, useMemo } from 'react';
import { useGame } from '@/components/GameProvider';
import { clearState } from '@/lib/gameReducer';

const RANK_BADGES = ['1', '2', '3'];
const RANK_LABELS = ['1st Place', '2nd Place', '3rd Place'];

export default function ResultScreen() {
  const { state, dispatch } = useGame();
  const { players, topics, scoreEvents } = state;

  // Sort players descending by score
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => b.score - a.score);
  }, [players]);

  const topScore = sortedPlayers[0]?.score ?? 0;
  const winners = useMemo(() => {
    if (sortedPlayers.length === 0) return [];
    return sortedPlayers.filter((p) => p.score === topScore);
  }, [sortedPlayers, topScore]);

  const isTie = winners.length > 1;

  // Handle "New Game" click: clear localStorage and reset state to 'setup'
  const handleNewGame = useCallback(() => {
    clearState();
    dispatch({ type: 'NEW_GAME' });
  }, [dispatch]);

  // Statistics
  const totalPoints = useMemo(
    () => players.reduce((sum, p) => sum + p.score, 0),
    [players],
  );

  const takenTopicsCount = useMemo(
    () => topics.filter((t) => t.taken).length,
    [topics],
  );

  return (
    <main className="bg-game min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-3xl flex flex-col items-center gap-7 animate-fade-in-up my-auto">
        {/* ── Trophy Header ─────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <span className="rounded-full bg-[#FBF6EA] border border-[#C5A059] px-3.5 py-1 text-xs font-black uppercase tracking-widest text-[#8A6B29]">
              Tournament Complete
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#0D5C58] tracking-tight">
            Final Results
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            The quiz has concluded. Here is the final leaderboard!
          </p>
        </div>

        {/* ── Winner Highlight Podium Card ──────────────────────────── */}
        <section
          className="w-full rounded-2xl border-2 border-[#C5A059] bg-white p-6 sm:p-8 text-center shadow-xl shadow-[#C5A059]/15 relative overflow-hidden"
          aria-label="Winner podium"
        >
          {/* Subtle top gold accent hairline */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0D5C58] via-[#C5A059] to-[#0D5C58]" />

          <div className="relative z-10 space-y-3 pt-1">
            <span className="inline-block rounded-full bg-[#FBF6EA] border border-[#C5A059] px-4 py-1 text-xs font-black uppercase tracking-widest text-[#8A6B29]">
              {isTie ? 'Co-Winners' : 'Champion'}
            </span>

            <div className="py-2">
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-wide">
                {winners.map((w) => w.name).join(' & ')}
              </h2>
              <p className="text-xl font-extrabold text-[#0D5C58] mt-1">
                {topScore} point{topScore !== 1 ? 's' : ''}
              </p>
            </div>

            <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
              Congratulations on a fantastic performance across all quiz rounds!
            </p>
          </div>
        </section>

        {/* ── Sorted Leaderboard Cards ──────────────────────────────── */}
        <section className="w-full space-y-3" aria-label="Final scoreboard">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#0D5C58] px-1">
            Leaderboard
          </h3>

          <div className="space-y-3">
            {sortedPlayers.map((player, idx) => {
              const isWinner = player.score === topScore;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all ${
                    isWinner
                      ? 'border-2 border-[#C5A059] bg-[#FFFDF8] shadow-md'
                      : 'border border-slate-200 bg-white shadow-xs'
                  }`}
                >
                  {/* Left: Rank + Avatar + Name */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl border border-slate-200">
                      {RANK_BADGES[idx] ?? `#${idx + 1}`}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base sm:text-lg font-bold text-slate-900">
                          {player.name}
                        </span>
                        {isWinner && (
                          <span className="rounded-full bg-[#FBF6EA] border border-[#C5A059] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#8A6B29]">
                            Winner
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        {RANK_LABELS[idx] ?? `Rank #${idx + 1}`}
                      </span>
                    </div>
                  </div>

                  {/* Right: Score */}
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                      {player.score}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                      points
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Summary Statistics ────────────────────────────────────── */}
        <section className="w-full grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl text-center border border-slate-200 shadow-xs">
            <p className="text-xl sm:text-2xl font-black text-[#0D5C58] tabular-nums">
              {totalPoints}
            </p>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">
              Total Points
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl text-center border border-slate-200 shadow-xs">
            <p className="text-xl sm:text-2xl font-black text-[#0D5C58] tabular-nums">
              {takenTopicsCount} / {topics.length}
            </p>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">
              Topics Played
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl text-center border border-slate-200 shadow-xs">
            <p className="text-xl sm:text-2xl font-black text-[#0D5C58] tabular-nums">
              {scoreEvents?.length ?? 0}
            </p>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">
              Scored Questions
            </p>
          </div>
        </section>

        {/* ── New Game Action ───────────────────────────────────────── */}
        <div className="pt-2 flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={handleNewGame}
            className="btn-primary text-base px-9 py-3.5 rounded-2xl shadow-lg flex items-center gap-2.5 font-bold hover:scale-[1.02] active:scale-95 transition-all"
            id="new-game-btn"
          >
            <span>Start New Game</span>
          </button>
          <p className="text-xs text-slate-400 font-medium">
            Resets all players, scores, and board progress.
          </p>
        </div>
      </div>
    </main>
  );
}
