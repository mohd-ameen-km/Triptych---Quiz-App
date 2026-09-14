'use client';

/**
 * QuestionScreen — active question view for the quiz.
 *
 * Theme: White and Gold with Teal.
 * Strictly implements:
 * - Question text in black text on pure white background.
 * - Answer text in black text on pure white background.
 * - Stately Teal navigation, buttons, and accents.
 * - Polished Gold borders, timer indicators, and highlights.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '@/components/GameProvider';
import Scoreboard from '@/components/Scoreboard';
import Logo from '@/components/Logo';
import type { Question } from '@/types';
import { COLUMN_LABELS } from '@/types';

export default function QuestionScreen() {
  const { state, dispatch } = useGame();
  const { currentQuestion, topics, players, mysteryBags } = state;
  const directSeconds = state.directSeconds ?? 25;
  const passSeconds = state.passSeconds ?? 20;

  // ── Find active topic and question ───────────────────────────────────
  const topic = useMemo(
    () => topics.find((t) => t.id === currentQuestion?.topicId),
    [topics, currentQuestion?.topicId],
  );

  const question: Question | undefined = useMemo(() => {
    if (!topic || currentQuestion === null) return undefined;
    return topic.questions[currentQuestion.questionIndex];
  }, [topic, currentQuestion]);

  // ── Active answering player ─────────────────────────────────────────
  const activePlayer = useMemo(
    () => players.find((p) => p.id === currentQuestion?.whoseTurn),
    [players, currentQuestion?.whoseTurn],
  );

  // ── Check if topic or mystery bag has more questions after this one ──
  const hasMoreQuestions = useMemo(() => {
    if (!topic || !currentQuestion) return false;
    const currQ = topic.questions[currentQuestion.questionIndex];
    if (currQ?.isMysteryQuestion) {
      const colBag = mysteryBags[topic.column] ?? [];
      return colBag.some(
        (e) => !e.taken && e.id !== currentQuestion.mysteryBagId,
      );
    }
    return topic.questions.some(
      (q, idx) => idx > currentQuestion.questionIndex && !q.isMysteryQuestion,
    );
  }, [topic, currentQuestion, mysteryBags]);

  // Mystery bag question sequence index within this column's bag
  const mysteryBagInfo = useMemo(() => {
    if (!topic || !currentQuestion?.mysteryBagId) return null;
    const colBag = mysteryBags[topic.column] ?? [];
    const idx = colBag.findIndex((e) => e.id === currentQuestion.mysteryBagId);
    return {
      index: idx !== -1 ? idx + 1 : 1,
      total: colBag.length,
    };
  }, [topic, currentQuestion?.mysteryBagId, mysteryBags]);

  // ── Question completion state ──────────────────────────────────────
  const isComplete = currentQuestion?.isComplete ?? false;

  // ── Is this the direct attempt (first shown to picking player)? ─────
  const isDirect = (currentQuestion?.playersAttempted.length ?? 0) === 0;

  // ── Timer State ─────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(
    isDirect ? directSeconds : passSeconds,
  );
  const [timerRunning, setTimerRunning] = useState(false);

  // Reset timer if question or whoseTurn changes:
  // - Direct attempt: stopped at directSeconds, requiring manual "Start Timer" click
  // - Pass attempt: auto-starts at passSeconds
  useEffect(() => {
    if (isDirect) {
      setTimeLeft(directSeconds);
      setTimerRunning(false);
    } else {
      setTimeLeft(passSeconds);
      setTimerRunning(true);
    }
  }, [
    currentQuestion?.topicId,
    currentQuestion?.questionIndex,
    currentQuestion?.whoseTurn,
    isDirect,
    directSeconds,
    passSeconds,
  ]);

  // Timer interval — pauses if timerRunning is false, time is up, or question is completed
  useEffect(() => {
    if (!timerRunning || timeLeft <= 0 || isComplete) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerRunning, timeLeft, isComplete]);

  // ── Button Handlers ─────────────────────────────────────────────────
  const handleRevealAnswer = useCallback(() => {
    dispatch({ type: 'REVEAL_ANSWER' });
  }, [dispatch]);

  const handleMarkCorrect = useCallback(() => {
    dispatch({ type: 'MARK_CORRECT' });
  }, [dispatch]);

  const handleMarkWrong = useCallback(() => {
    dispatch({ type: 'MARK_WRONG' });
  }, [dispatch]);

  const handlePass = useCallback(() => {
    dispatch({ type: 'PASS' });
  }, [dispatch]);

  const canUndo = (state.history?.length ?? 0) > 0;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    dispatch({ type: 'UNDO' });
  }, [canUndo, dispatch]);

  const handleNextQuestion = useCallback(() => {
    dispatch({ type: 'NEXT_QUESTION' });
  }, [dispatch]);

  const handleGoToBoard = useCallback(() => {
    dispatch({ type: 'GO_TO_BOARD' });
  }, [dispatch]);

  if (!currentQuestion || !topic || !question) {
    return (
      <main className="bg-game flex min-h-screen items-center justify-center p-6 text-center">
        <div className="glass-card max-w-md p-8">
          <p className="text-lg text-slate-700 mb-4 font-semibold">
            No active question found.
          </p>
          <button onClick={handleGoToBoard} className="btn-primary">
            Return to Topics Board
          </button>
        </div>
      </main>
    );
  }

  const isRevealed = currentQuestion.revealed;
  const isTimeExpired = timeLeft === 0;
  const allAttempted =
    currentQuestion.playersAttempted.length >= players.length;

  return (
    <main className="bg-game min-h-screen flex flex-col">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 py-3 sm:px-6 sticky top-0 z-20 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Logo size="sm" />
            <span className="h-5 w-px bg-slate-200 hidden sm:inline-block" />
            <button
              onClick={handleGoToBoard}
              className="text-xs font-bold text-[#0D5C58] hover:text-[#083D3A] transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0D5C58]/30 bg-[#EBF5F4] hover:bg-[#D7EAE8]"
              title="Return to board without resetting topic"
            >
              <span>←</span>
              <span>Board</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-[#0D5C58]">
                  {question.isMysteryQuestion
                    ? `${COLUMN_LABELS[topic.column]} Mystery Bag`
                    : topic.name}
                </span>
                <span className="text-slate-300 text-xs">•</span>
                <span className="text-xs text-slate-500 font-medium">
                  {question.isMysteryQuestion
                    ? mysteryBagInfo && mysteryBagInfo.total > 1
                      ? `Mystery Question (${mysteryBagInfo.index} of ${mysteryBagInfo.total})`
                      : 'Mystery Question'
                    : `Question #${question.questionNumber}`}
                </span>
              </div>
              {activePlayer && !isComplete && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-[#C5A059] animate-pulse" />
                  <span>
                    Current turn:{' '}
                    <strong className="text-[#0D5C58] font-bold">
                      {activePlayer.name}
                    </strong>
                  </span>
                </p>
              )}
              {isComplete && !hasMoreQuestions && (
                <p className="text-xs text-[#0D5C58] font-bold flex items-center gap-1.5 mt-0.5">
                  <span>
                    ✓{' '}
                    {question.isMysteryQuestion
                      ? 'This mystery bag is done'
                      : 'This topic is done'}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page Layout: Left Vertical Sidebar + Right Main Area ────── */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 flex flex-col md:flex-row items-start gap-6">
        {/* ── Left Sidebar (Scoreboard, Fixed-width & Sticky) ──────── */}
        <aside
          className="w-full md:w-64 lg:w-72 shrink-0 md:sticky md:top-20 z-10"
          aria-label="Scoreboard sidebar"
        >
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col gap-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-[#0D5C58]">
                Leaderboard
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Scores
              </span>
            </div>
            <Scoreboard
              activePlayerId={isComplete ? null : currentQuestion.whoseTurn}
              layout="vertical"
            />
          </div>
        </aside>

        {/* ── Right Main Question Area ──────────────────────────────── */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          {/* Active Turn Banner - Stately Teal with Polished Gold Accents */}
          {activePlayer && !isComplete && (
            <div
              className="w-full rounded-2xl bg-gradient-to-r from-[#0D5C58] to-[#083D3A] border-2 border-[#C5A059] px-6 py-4 flex items-center justify-between shadow-lg shadow-[#0D5C58]/15 animate-fade-in-up"
              role="region"
              aria-label="Active player turn"
            >
              <div className="flex items-center gap-3.5">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C5A059] opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#C5A059]" />
                </span>
                <div>
                  <span className="text-[11px] uppercase font-black tracking-widest text-[#FBF6EA]">
                    {currentQuestion.directPlayer === activePlayer.id
                      ? 'Direct Question'
                      : 'Passed Question'}
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {activePlayer.name}{' '}
                    <span className="text-sm font-bold text-[#C5A059]">
                      ({activePlayer.score} pt
                      {activePlayer.score !== 1 ? 's' : ''})
                    </span>
                  </p>
                </div>
              </div>

              <span className="rounded-xl bg-[#C5A059] px-3.5 py-1 text-xs font-black uppercase text-slate-900 tracking-wider shadow">
                ANSWERING
              </span>
            </div>
          )}

          {/* Timer Bar */}
          <div className="flex items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 shadow-xs px-5 py-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl font-mono text-xl font-black transition-all ${
                  isTimeExpired
                    ? 'bg-rose-50 text-rose-700 border-2 border-rose-400 animate-pulse'
                    : timeLeft <= 5
                      ? 'bg-amber-50 text-amber-700 border-2 border-amber-400'
                      : 'bg-slate-50 text-slate-900 border border-slate-300'
                }`}
              >
                {timeLeft}
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span>{isTimeExpired ? "Time's Up!" : 'Timer'}</span>
                  {!timerRunning && !isTimeExpired && !isComplete && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Stopped
                    </span>
                  )}
                  {timerRunning && !isComplete && (
                    <span className="text-[10px] font-bold text-[#0D5C58] bg-[#EBF5F4] px-1.5 py-0.5 rounded border border-[#0D5C58]/30">
                      Running
                    </span>
                  )}
                </span>
                <p className="text-xs text-slate-400 font-medium">
                  {isTimeExpired
                    ? 'Visual pacing expired (actions still active)'
                    : isDirect
                      ? `${timeLeft}s direct time (${directSeconds}s allocation)`
                      : `${timeLeft}s pass time (${passSeconds}s allocation)`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!timerRunning && isDirect && timeLeft === directSeconds ? (
                <button
                  onClick={() => setTimerRunning(true)}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-[#0D5C58] hover:bg-[#083D3A] text-white transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                  id="start-timer-btn"
                >
                  <span>Start Timer</span>
                </button>
              ) : (
                <button
                  onClick={() => setTimerRunning((prev) => !prev)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  id="toggle-timer-btn"
                >
                  {timerRunning ? 'Pause' : 'Resume'}
                </button>
              )}
              <button
                onClick={() => {
                  const targetSec = isDirect ? directSeconds : passSeconds;
                  setTimeLeft(targetSec);
                  setTimerRunning(!isDirect);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                id="reset-timer-btn"
              >
                Reset {isDirect ? directSeconds : passSeconds}s
              </button>
            </div>
          </div>

          {/* ── Question Card (Pure White Background, Black Question Text) ── */}
          <section className="bg-white rounded-2xl p-6 sm:p-9 space-y-6 border border-slate-200 shadow-sm relative overflow-hidden">
            {/* Subtle top gold accent hairline */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0D5C58] via-[#C5A059] to-[#0D5C58]" />

            <div className="space-y-2 pt-1">
              <span className="text-xs uppercase tracking-widest font-black text-[#0D5C58]">
                Question
              </span>
              <h2 className="text-lg sm:text-2xl font-bold text-slate-900 leading-snug text-left tracking-tight">
                {question.questionText}
              </h2>
            </div>

            {/* Question Media (Whichever is present) */}
            {(question.questionImage ||
              question.questionVideo ||
              question.questionAudio) && (
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-4 items-start">
                {question.questionImage && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-96 shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={question.questionImage}
                      alt="Question visual media"
                      className="max-h-96 max-w-full object-contain rounded-xl"
                    />
                  </div>
                )}

                {question.questionVideo && (
                  <div className="w-full max-w-2xl rounded-xl overflow-hidden border border-slate-200 bg-black">
                    <video
                      src={question.questionVideo}
                      controls
                      className="w-full max-h-96 rounded-xl"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {question.questionAudio && (
                  <div className="w-full max-w-md p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <audio
                      src={question.questionAudio}
                      controls
                      className="w-full"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Answer Section (Rendered when revealed) ── */}
          {isRevealed && (
            <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden animate-fade-in-up">
              <div className="space-y-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#EBF5F4] border border-[#0D5C58]/30 px-4 py-1 text-xs font-bold text-[#0D5C58]">
                  <span>Correct Answer</span>
                </div>

                {/* Black answer text on pure white card */}
                <div className="py-3">
                  <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-wide text-center leading-snug">
                    {question.answerText}
                  </p>
                </div>

                {/* Answer Media Below Centered */}
                {(question.answerImage ||
                  question.answerVideo ||
                  question.answerAudio) && (
                  <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-4">
                    {question.answerImage && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-96 shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={question.answerImage}
                          alt="Answer visual media"
                          className="max-h-96 max-w-full object-contain rounded-xl mx-auto"
                        />
                      </div>
                    )}

                    {question.answerVideo && (
                      <div className="w-full max-w-2xl rounded-xl overflow-hidden border border-slate-200 bg-black mx-auto">
                        <video
                          src={question.answerVideo}
                          controls
                          className="w-full max-h-96 rounded-xl"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}

                    {question.answerAudio && (
                      <div className="w-full max-w-md p-3.5 rounded-xl bg-slate-50 border border-slate-200 mx-auto">
                        <audio
                          src={question.answerAudio}
                          controls
                          className="w-full"
                        >
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Completion & Navigation Banner (when question is complete) ── */}
          {isComplete && (
            <section className="bg-[#F0F9F8] rounded-2xl p-5 border border-[#0D5C58]/30 animate-fade-in-up flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="text-center sm:text-left">
                {!hasMoreQuestions && (
                  <p className="text-sm font-bold text-slate-900">
                    {question.isMysteryQuestion
                      ? 'This mystery bag is done'
                      : 'This topic is done'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 ml-auto">
                {!hasMoreQuestions ? (
                  /* "Go to Topics" button that appears once the topic's questions are exhausted */
                  <button
                    onClick={handleGoToBoard}
                    className="btn-primary text-sm py-2.5 px-6 rounded-xl shadow-md flex items-center gap-2 font-bold"
                    id="go-to-topics-btn"
                  >
                    <span>Go to Topics</span>
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className="btn-primary text-sm py-2.5 px-6 rounded-xl shadow-md flex items-center gap-2 font-bold"
                    id="next-question-btn"
                  >
                    <span>Next Question</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ── Action Buttons Bar ──────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Primary gameplay actions: all five in one row */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={handleMarkCorrect}
                  disabled={isComplete}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-xs active:scale-95 ${
                    isComplete
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-[#0D5C58] hover:bg-[#083D3A] text-white border border-[#0D5C58]'
                  }`}
                  id="mark-correct-btn"
                >
                  Correct
                </button>

                <button
                  onClick={handleMarkWrong}
                  disabled={isComplete || allAttempted}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-xs active:scale-95 ${
                    isComplete || allAttempted
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                  id="mark-wrong-btn"
                >
                  Wrong
                </button>

                <button
                  onClick={handlePass}
                  disabled={isComplete || allAttempted}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-xs active:scale-95 ${
                    isComplete || allAttempted
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                  id="pass-btn"
                >
                  Pass
                </button>

                <button
                  onClick={handleRevealAnswer}
                  disabled={isRevealed}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-xs active:scale-95 ${
                    isRevealed
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-[#FBF6EA] hover:bg-[#F5ECD5] border border-[#C5A059] text-[#8A6B29]'
                  }`}
                  id="reveal-answer-btn"
                >
                  Reveal Answer
                </button>

                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-xs active:scale-95 ${
                    !canUndo
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                  }`}
                  id="undo-btn"
                  title={
                    canUndo
                      ? 'Undo last action on this question'
                      : 'No actions to undo on this question'
                  }
                >
                  Undo
                </button>
              </div>

              {/* Utility & Navigation Actions */}
              <div className="flex items-center gap-2 ml-auto">
                {!isComplete && (
                  <button
                    onClick={handleGoToBoard}
                    className="rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs py-2 px-3 text-slate-600 hover:text-slate-900 flex items-center gap-1 font-semibold transition-all"
                    title="Return to board without completing"
                  >
                    <span>Board →</span>
                  </button>
                )}
              </div>
            </div>

            {/* Attempted Status Bar */}
            {currentQuestion.playersAttempted.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold">Attempted:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentQuestion.playersAttempted.map((pid) => {
                    const p = players.find((pl) => pl.id === pid);
                    return (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200"
                      >
                        <span>✕</span>
                        <span>{p?.name ?? pid}</span>
                      </span>
                    );
                  })}
                </div>
                {allAttempted && (
                  <span className="text-amber-700 font-bold ml-2">
                    (All 3 players attempted — no points awarded)
                  </span>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
