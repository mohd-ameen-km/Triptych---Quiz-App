'use client';

/**
 * TopicsScreen — the main 15-topic board view.
 *
 * Theme: White and Gold with Teal.
 * Strictly no emojis, no mystery badges on board cards, no column headers,
 * no question count subtitles, and no helper text on mystery bags.
 *
 * Mystery bags have no sub-topic modal; clicking an unlocked mystery bag
 * goes directly to its first unanswered question.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useGame } from '@/components/GameProvider';
import Scoreboard from '@/components/Scoreboard';
import ResetConfirmationModal from '@/components/ResetConfirmationModal';
import Logo from '@/components/Logo';
import type { Column, GameMysteryBagEntry, GameTopic } from '@/types';
import { COLUMNS, COLUMN_LABELS } from '@/types';

// Helper to look up a player's display name
function playerName(
  players: { id: string; name: string }[],
  id: string | null | undefined,
): string {
  if (!id) return '';
  return players.find((p) => p.id === id)?.name ?? id;
}

export default function TopicsScreen() {
  const { state, dispatch } = useGame();
  const { topics, players, mysteryBags, turnOrder } = state;

  // Topic or mystery bag queued for reset confirmation
  const [resetTarget, setResetTarget] = useState<
    | { type: 'topic'; topic: GameTopic }
    | {
        type: 'bag';
        topic: GameTopic;
        bagEntry: GameMysteryBagEntry;
        col: Column;
      }
    | null
  >(null);

  // End game confirmation state
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);

  // Group topics by column, preserving order
  const columns = useMemo(() => {
    const grouped: Record<Column, GameTopic[]> = {
      left: [],
      center: [],
      right: [],
    };
    for (const t of topics) {
      grouped[t.column].push(t);
    }
    return grouped;
  }, [topics]);

  // Are all board topics taken? (unlocks mystery bags)
  const allTopicsTaken = useMemo(() => {
    if (topics.length === 0) return false;
    const boardTopics = topics.filter((t) =>
      t.questions.some((q) => !q.isMysteryQuestion),
    );
    // If all topics in the game are pure mystery topics, unlock bags immediately
    return boardTopics.length === 0 || boardTopics.every((t) => t.taken);
  }, [topics]);

  // Whose turn is it to pick? (use the starter from turnOrder)
  const activePickerId = turnOrder?.starterPlayerId ?? null;
  const activePicker = players.find((p) => p.id === activePickerId);

  const canUndo = (state.history?.length ?? 0) > 0;

  // ── Select a topic from the board ───────────────────────────────────
  const handleSelectTopic = useCallback(
    (topic: GameTopic) => {
      if (topic.taken) return;

      // Select the first non-mystery question, or index 0 if it only has mystery questions
      const nonMysteryIdx = topic.questions.findIndex(
        (q) => !q.isMysteryQuestion,
      );
      const qIdx = nonMysteryIdx !== -1 ? nonMysteryIdx : 0;

      dispatch({
        type: 'SELECT_TOPIC',
        payload: { topicId: topic.id, questionIndex: qIdx },
      });
    },
    [dispatch],
  );

  // ── Select a mystery bag: goes directly to first unanswered question ──
  const handleSelectMysteryBag = useCallback(
    (col: Column) => {
      if (!allTopicsTaken) return;
      const bagEntries = mysteryBags[col] ?? [];
      const firstUnanswered = bagEntries.find((e) => !e.taken);
      if (!firstUnanswered) return;

      const topic = topics.find((t) => t.name === firstUnanswered.topicName);
      if (!topic) return;

      const qIdx = topic.questions.findIndex((q) => q.isMysteryQuestion);
      const targetQIdx = qIdx !== -1 ? qIdx : 0;

      dispatch({
        type: 'SELECT_TOPIC',
        payload: {
          topicId: topic.id,
          questionIndex: targetQIdx,
          mysteryBagId: firstUnanswered.id,
        },
      });
    },
    [allTopicsTaken, mysteryBags, topics, dispatch],
  );

  // ── Prompt reset topic confirmation handlers ────────────────────────
  const handlePromptResetTopic = useCallback(
    (topic: GameTopic, e: React.MouseEvent) => {
      e.stopPropagation();
      setResetTarget({ type: 'topic', topic });
    },
    [],
  );

  // ── Prompt reset for a taken mystery bag ─────────────────────────────
  const handlePromptResetMysteryBag = useCallback(
    (col: Column, e: React.MouseEvent) => {
      e.stopPropagation();
      const bagEntries = mysteryBags[col] ?? [];
      const lastTakenEntry = [...bagEntries].reverse().find((e) => e.taken);
      if (!lastTakenEntry) return;

      const topic = topics.find((t) => t.name === lastTakenEntry.topicName);
      if (topic) {
        setResetTarget({
          type: 'bag',
          topic,
          bagEntry: lastTakenEntry,
          col,
        });
      }
    },
    [mysteryBags, topics],
  );

  const handleConfirmReset = useCallback(() => {
    if (!resetTarget) return;
    if (resetTarget.type === 'topic') {
      dispatch({
        type: 'RESET_TOPIC',
        payload: { topicId: resetTarget.topic.id },
      });
    } else {
      const qIdx = resetTarget.topic.questions.findIndex(
        (q) => q.isMysteryQuestion,
      );
      dispatch({
        type: 'RESET_TOPIC',
        payload: {
          topicId: resetTarget.topic.id,
          questionIndex: qIdx !== -1 ? qIdx : 0,
          mysteryBagId: resetTarget.bagEntry.id,
        },
      });
    }
    setResetTarget(null);
  }, [resetTarget, dispatch]);

  const handleCancelReset = useCallback(() => {
    setResetTarget(null);
  }, []);

  // Points awarded on the target queued for reset
  const pointsOnTargetToReset = useMemo(() => {
    if (!resetTarget) return 0;
    if (resetTarget.type === 'topic') {
      const mysteryQIdx = resetTarget.topic.questions.findIndex(
        (q) => q.isMysteryQuestion,
      );
      return (state.scoreEvents ?? [])
        .filter(
          (e) =>
            e.topicId === resetTarget.topic.id &&
            (mysteryQIdx === -1 || e.questionIndex !== mysteryQIdx),
        )
        .reduce((sum, e) => sum + e.points, 0);
    } else {
      const mysteryQIdx = resetTarget.topic.questions.findIndex(
        (q) => q.isMysteryQuestion,
      );
      const targetQIdx = mysteryQIdx !== -1 ? mysteryQIdx : 0;
      return (state.scoreEvents ?? [])
        .filter(
          (e) =>
            e.topicId === resetTarget.topic.id &&
            e.questionIndex === targetQIdx,
        )
        .reduce((sum, e) => sum + e.points, 0);
    }
  }, [resetTarget, state.scoreEvents]);

  const resetDialogTitle = useMemo(() => {
    if (!resetTarget) return '';
    if (resetTarget.type === 'topic') return resetTarget.topic.name;
    const colCapitalized =
      resetTarget.col.charAt(0).toUpperCase() + resetTarget.col.slice(1);
    return `${colCapitalized} Mystery Bag`;
  }, [resetTarget]);

  // ── End game confirmation ───────────────────────────────────────────
  const handleConfirmEndGame = useCallback(() => {
    setShowEndGameConfirm(false);
    dispatch({ type: 'END_GAME' });
  }, [dispatch]);

  return (
    <main className="bg-game flex min-h-screen flex-col">
      {/* ── Top bar: title + scoreboard + End Game ───────────────────── */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 py-3 sm:px-6 sticky top-0 z-20 shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="flex flex-col">
              <Logo size="md" />
              {activePicker && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1 font-medium pl-0.5">
                  <span className="h-2 w-2 rounded-full bg-[#C5A059] animate-pulse" />
                  <span>
                    <strong className="text-slate-900 font-bold">
                      {activePicker.name}
                    </strong>
                    &apos;s turn to pick
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: 'UNDO' })}
                disabled={!canUndo}
                className={`text-xs px-3.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-xs font-bold ${
                  !canUndo
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                id="board-undo-btn"
                title={canUndo ? 'Undo last action' : 'No actions to undo'}
              >
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEndGameConfirm(true)}
                className="text-xs px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all flex items-center gap-1.5 shadow-xs font-bold"
                id="end-game-btn"
                title="End the game and see final results"
              >
                <span>End Game</span>
              </button>
            </div>
          </div>

          <div className="flex-1 sm:max-w-xl">
            <Scoreboard activePlayerId={activePickerId} layout="horizontal" />
          </div>
        </div>
      </header>

      {/* ── Board ───────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {COLUMNS.map((col) => (
            <div key={col} className="flex flex-col gap-3">
              {/* Topic cards */}
              {columns[col].map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  players={players}
                  onSelect={handleSelectTopic}
                  onReset={handlePromptResetTopic}
                />
              ))}

              {/* Mystery bag card */}
              {(() => {
                const bagEntries = mysteryBags[col] ?? [];
                const takenCount = bagEntries.filter((e) => e.taken).length;
                const lastTaken = [...bagEntries]
                  .reverse()
                  .find((e) => e.taken);
                const taker = playerName(players, lastTaken?.takenBy);

                return (
                  <MysteryBagCard
                    column={col}
                    entryCount={bagEntries.length}
                    takenCount={takenCount}
                    unlocked={allTopicsTaken}
                    takerName={taker}
                    onSelect={() => handleSelectMysteryBag(col)}
                    onReset={(e) => handlePromptResetMysteryBag(col, e)}
                  />
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* ── Topic / Mystery Bag Reset Confirmation Modal ─────────────── */}
      {resetTarget && (
        <ResetConfirmationModal
          topicName={resetDialogTitle}
          pointsToDeduct={pointsOnTargetToReset}
          onConfirm={handleConfirmReset}
          onCancel={handleCancelReset}
        />
      )}

      {/* ── End Game Confirmation Modal ─────────────────────────────── */}
      {showEndGameConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-game-modal-title"
        >
          <div className="bg-white w-full max-w-md p-7 rounded-2xl border border-slate-200 shadow-2xl relative">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center flex-shrink-0">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a1.5 1.5 0 001.142-1.455V4.747a1.5 1.5 0 00-1.142-1.455l-3.114.732a9 9 0 01-6.086-.71l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
                  />
                </svg>
              </div>
              <div>
                <h2
                  id="end-game-modal-title"
                  className="text-lg font-extrabold text-slate-900"
                >
                  End the Game?
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  This will finalize scores and proceed to the results podium.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-6">
              You will see the final leaderboard and can start a new game
              anytime.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEndGameConfirm(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
                id="cancel-end-game-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndGame}
                className="rounded-xl px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-md active:scale-95"
                id="confirm-end-game-btn"
              >
                End Game & View Results
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// TopicCard
// ---------------------------------------------------------------------------

interface TopicCardProps {
  topic: GameTopic;
  players: { id: string; name: string }[];
  onSelect: (topic: GameTopic) => void;
  onReset: (topic: GameTopic, e: React.MouseEvent) => void;
}

function TopicCard({ topic, players, onSelect, onReset }: TopicCardProps) {
  const isTaken = topic.taken;
  const takerName = playerName(players, topic.takenBy);

  return (
    <button
      type="button"
      className={`topic-card group relative w-full rounded-2xl px-5 py-4 text-left transition-all duration-200 ${
        isTaken ? 'topic-card-taken' : 'topic-card-available'
      }`}
      onClick={() => !isTaken && onSelect(topic)}
      disabled={isTaken}
      aria-label={
        isTaken
          ? `${topic.name} — taken by ${takerName}`
          : `Select ${topic.name}`
      }
    >
      {/* Topic name — mystery and non-mystery look 100% identical */}
      <p
        className={`text-base sm:text-lg font-bold leading-snug ${
          isTaken ? 'text-slate-400 line-through' : 'text-slate-900'
        }`}
      >
        {topic.name}
      </p>

      {/* Taken overlay */}
      {isTaken && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs sm:text-sm text-[#0D5C58] font-bold flex items-center gap-1">
            <span>✓</span>
            <span>{takerName}</span>
          </span>

          {/* Reset button */}
          <button
            type="button"
            className="reset-btn flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-200 hover:text-rose-600"
            onClick={(e) => onReset(topic, e)}
            aria-label={`Reset ${topic.name}`}
            title="Reset topic"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
          </button>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MysteryBagCard
// ---------------------------------------------------------------------------

interface MysteryBagCardProps {
  column: Column;
  entryCount: number;
  takenCount: number;
  unlocked: boolean;
  takerName?: string;
  onSelect: () => void;
  onReset: (e: React.MouseEvent) => void;
}

function MysteryBagCard({
  column,
  entryCount,
  takenCount,
  unlocked,
  takerName,
  onSelect,
  onReset,
}: MysteryBagCardProps) {
  const remaining = entryCount - takenCount;
  const isTaken = unlocked && remaining === 0;
  const isLocked = !unlocked;

  return (
    <button
      type="button"
      className={`mystery-bag-card group w-full rounded-2xl px-5 py-4 text-left transition-all duration-200 ${
        isLocked
          ? 'mystery-bag-locked cursor-not-allowed'
          : isTaken
            ? 'topic-card-taken cursor-default'
            : 'mystery-bag-unlocked cursor-pointer'
      }`}
      onClick={() => {
        if (!isLocked && !isTaken) onSelect();
      }}
      disabled={isLocked || isTaken}
      aria-label={
        isLocked
          ? `${COLUMN_LABELS[column]} Mystery Bag — locked`
          : isTaken
            ? `${COLUMN_LABELS[column]} Mystery Bag — completed`
            : `Select ${COLUMN_LABELS[column]} Mystery Bag`
      }
    >
      <div className="flex items-center justify-between">
        <p
          className={`text-base sm:text-lg font-bold leading-snug ${
            isLocked
              ? 'text-slate-400'
              : isTaken
                ? 'text-slate-400 line-through'
                : 'text-[#8A6B29]'
          }`}
        >
          {COLUMN_LABELS[column]} Mystery Bag
        </p>

        {!isLocked && !isTaken && (
          <span className="text-xs text-[#0D5C58] font-bold group-hover:translate-x-1 transition-transform">
            Open →
          </span>
        )}
      </div>

      {isTaken && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs sm:text-sm text-[#0D5C58] font-bold flex items-center gap-1">
            <span>✓</span>
            <span>{takerName || 'Completed'}</span>
          </span>

          {/* Reset button */}
          <button
            type="button"
            className="reset-btn flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-200 hover:text-rose-600"
            onClick={(e) => onReset(e)}
            aria-label={`Reset ${COLUMN_LABELS[column]} Mystery Bag`}
            title="Reset mystery bag"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
          </button>
        </div>
      )}
    </button>
  );
}
