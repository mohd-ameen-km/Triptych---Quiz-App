'use client';

/**
 * SetupScreen — the home / setup page for the quiz game.
 *
 * Theme: White and Gold with Teal.
 * Handles:
 *  - TSV file upload via drag-and-drop or file picker
 *  - Parsing + validation feedback with loading & empty states
 *  - 3 player name inputs
 *  - Randomize order checkbox
 *  - Start Game button (disabled until valid)
 */

import React, { useCallback, useId, useRef, useState } from 'react';
import { parseTsv } from '@/lib/tsv-parser';
import { useGame } from '@/components/GameProvider';
import Logo from '@/components/Logo';
import type { Topic, MysteryBag } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParseState {
  status: 'idle' | 'loading' | 'success' | 'error';
  fileName: string;
  topicCount: number;
  errors: string[];
  topics: Topic[];
  mysteryBag: MysteryBag;
}

const INITIAL_PARSE: ParseState = {
  status: 'idle',
  fileName: '',
  topicCount: 0,
  errors: [],
  topics: [],
  mysteryBag: { left: [], center: [], right: [] },
};

const PLAYER_BADGES = [
  'bg-[#0D5C58] text-white', // Deep Teal
  'bg-[#C5A059] text-white', // Polished Gold
  'bg-[#14746F] text-white', // Royal Teal
];

const PLAYER_LABELS = ['Player 1', 'Player 2', 'Player 3'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SetupScreen() {
  const { dispatch } = useGame();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  // ── Local state ─────────────────────────────────────────────────────
  const [parseState, setParseState] = useState<ParseState>(INITIAL_PARSE);
  const [playerNames, setPlayerNames] = useState(['', '', '']);
  const [randomize, setRandomize] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [directSeconds, setDirectSeconds] = useState<number>(25);
  const [passSeconds, setPassSeconds] = useState<number>(20);

  // ── Derived ─────────────────────────────────────────────────────────
  const allNamesEntered = playerNames.every((n) => n.trim().length > 0);
  const tsvValid = parseState.status === 'success';
  const timerSettingsValid =
    !isNaN(directSeconds) &&
    directSeconds > 0 &&
    !isNaN(passSeconds) &&
    passSeconds > 0;
  const canStart = tsvValid && allNamesEntered && timerSettingsValid;

  // ── File handling ───────────────────────────────────────────────────
  const handleFile = useCallback(
    (file: File) => {
      // Empty file guard
      if (!file || file.size === 0) {
        setParseState({
          status: 'error',
          fileName: file ? file.name : 'Unknown file',
          topicCount: 0,
          errors: [
            'Uploaded file is empty (0 bytes). Please upload a valid TSV file.',
          ],
          topics: [],
          mysteryBag: { left: [], center: [], right: [] },
        });
        return;
      }

      setParseState({
        status: 'loading',
        fileName: file.name,
        topicCount: 0,
        errors: [],
        topics: [],
        mysteryBag: { left: [], center: [], right: [] },
      });

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== 'string' || !text.trim()) {
          setParseState({
            status: 'error',
            fileName: file.name,
            topicCount: 0,
            errors: ['The uploaded file contains no data or only whitespace.'],
            topics: [],
            mysteryBag: { left: [], center: [], right: [] },
          });
          return;
        }

        const result = parseTsv(text);

        if (result.errors.length > 0) {
          setParseState({
            status: 'error',
            fileName: file.name,
            topicCount: result.topics.length,
            errors: result.errors,
            topics: [],
            mysteryBag: { left: [], center: [], right: [] },
          });
        } else {
          setParseState({
            status: 'success',
            fileName: file.name,
            topicCount: result.topics.length,
            errors: [],
            topics: result.topics,
            mysteryBag: result.mysteryBag,
          });
          // Eagerly load topics into global state
          dispatch({
            type: 'LOAD_TOPICS',
            payload: { topics: result.topics, mysteryBag: result.mysteryBag },
          });
        }
      };

      reader.onerror = () => {
        setParseState({
          status: 'error',
          fileName: file.name,
          topicCount: 0,
          errors: ['Failed to read file from disk.'],
          topics: [],
          mysteryBag: { left: [], center: [], right: [] },
        });
      };

      reader.readAsText(file);
    },
    [dispatch],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // ── Player name helpers ─────────────────────────────────────────────
  const setPlayerName = useCallback((index: number, value: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // ── Start game ─────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (!canStart) return;

    // Build player list, optionally randomised
    let players = playerNames.map((name, i) => ({
      id: `player-${i + 1}`,
      name: name.trim(),
    }));

    if (randomize) {
      // Fisher-Yates shuffle
      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
      }
      // Re-assign ids after shuffle to keep them sequential
      players = players.map((p, i) => ({ ...p, id: `player-${i + 1}` }));
    }

    dispatch({ type: 'SET_PLAYERS', payload: { players } });
    dispatch({
      type: 'START_GAME',
      payload: {
        starterPlayerId: players[0].id,
        direction: 1,
        directSeconds,
        passSeconds,
      },
    });
  }, [canStart, playerNames, randomize, directSeconds, passSeconds, dispatch]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <main className="bg-game flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg animate-fade-in-up">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="inline-flex items-center justify-center mb-4">
            <span className="rounded-full bg-[#FBF6EA] border border-[#C5A059] px-3.5 py-1 text-xs font-black uppercase tracking-widest text-[#8A6B29]">
              Three-Player Quiz
            </span>
          </div>
          <div className="mb-3">
            <Logo size="lg" />
          </div>
          <p className="text-sm font-medium text-slate-500">
            Upload your quiz TSV file and name your players to begin
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-7 relative overflow-hidden">
          {/* Subtle top gold accent hairline */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0D5C58] via-[#C5A059] to-[#0D5C58]" />

          {/* ── TSV Upload ──────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#0D5C58]">
              1. Quiz Data (.tsv)
            </h2>

            <div
              className={`drop-zone flex cursor-pointer flex-col items-center gap-3 p-8 text-center transition-all ${
                dragOver ? 'drag-over' : ''
              } ${parseState.status === 'success' ? 'has-file' : ''} ${
                parseState.status === 'error' ? 'has-error' : ''
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload TSV file"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".tsv,.txt,.csv"
                className="hidden"
                onChange={onFileChange}
                id={`${formId}-file`}
              />

              {parseState.status === 'idle' && (
                <>
                  <UploadIcon />
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Drop your{' '}
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono border border-slate-200">
                        .tsv
                      </code>{' '}
                      file here
                    </p>
                    <p className="mt-1 text-xs text-slate-400 font-medium">
                      or click to browse from device
                    </p>
                  </div>
                </>
              )}

              {parseState.status === 'loading' && (
                <>
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#0D5C58] border-t-transparent my-1" />
                  <div>
                    <p className="text-sm font-bold text-[#0D5C58]">
                      Reading & validating TSV…
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {parseState.fileName}
                    </p>
                  </div>
                </>
              )}

              {parseState.status === 'success' && (
                <>
                  <SuccessIcon />
                  <div>
                    <p className="text-sm font-black text-[#0D5C58]">
                      ✓ {parseState.topicCount} topics loaded successfully
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 font-medium">
                      {parseState.fileName}
                    </p>
                    <p className="mt-2 text-xs text-[#0D5C58] font-bold">
                      Click or drop to replace
                    </p>
                  </div>
                </>
              )}

              {parseState.status === 'error' && (
                <>
                  <ErrorIcon />
                  <div>
                    <p className="text-sm font-bold text-rose-600">
                      Validation failed
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {parseState.fileName}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Click or drop another file to retry
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Error list */}
            {parseState.status === 'error' && parseState.errors.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-rose-50 border border-rose-200 p-3.5">
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-rose-700">
                  {parseState.errors.length} validation issue
                  {parseState.errors.length !== 1 ? 's' : ''} found:
                </p>
                <ul className="space-y-1.5">
                  {parseState.errors.map((err, i) => (
                    <li
                      key={i}
                      className="animate-slide-in flex items-start gap-2 text-xs text-rose-800 font-medium"
                      style={{
                        animationDelay: `${i * 30}ms`,
                        animationFillMode: 'backwards',
                      }}
                    >
                      <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" />
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── Divider ─────────────────────────────────────────────── */}
          <div className="h-px bg-slate-200" />

          {/* ── Player Names ────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#0D5C58]">
              2. Players
            </h2>
            <div className="space-y-3">
              {PLAYER_LABELS.map((label, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl font-extrabold text-xs shadow-xs ${PLAYER_BADGES[i]}`}
                  >
                    {i + 1}
                  </div>
                  <input
                    type="text"
                    className="game-input"
                    placeholder={`Enter ${label} Name`}
                    value={playerNames[i]}
                    onChange={(e) => setPlayerName(i, e.target.value)}
                    maxLength={30}
                    id={`${formId}-player-${i}`}
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── Options ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={randomize}
              onChange={(e) => setRandomize(e.target.checked)}
              id={`${formId}-randomize`}
            />
            <label
              htmlFor={`${formId}-randomize`}
              className="cursor-pointer select-none text-sm font-semibold text-slate-700"
            >
              Randomize player seating order
            </label>
          </div>

          {/* ── Divider ─────────────────────────────────────────────── */}
          <div className="h-px bg-slate-200" />

          {/* ── Timer Settings ───────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#0D5C58]">
              3. Timer Settings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor={`${formId}-direct-seconds`}
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Seconds on Direct
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className="game-input pr-12 font-bold"
                    value={directSeconds || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setDirectSeconds(isNaN(val) ? 0 : val);
                    }}
                    id={`${formId}-direct-seconds`}
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    sec
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${formId}-pass-seconds`}
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Seconds on Pass
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className="game-input pr-12 font-bold"
                    value={passSeconds || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setPassSeconds(isNaN(val) ? 0 : val);
                    }}
                    id={`${formId}-pass-seconds`}
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    sec
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Start Button ────────────────────────────────────────── */}
          <button
            className="btn-primary w-full py-3.5 text-base font-bold shadow-lg"
            disabled={!canStart}
            onClick={handleStart}
            id="start-game-btn"
          >
            {canStart ? 'Start Game →' : 'Complete Setup to Start'}
          </button>

          {/* Readiness hints */}
          {!canStart && (
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              {!tsvValid && (
                <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs text-slate-500 font-medium">
                  {parseState.status === 'error'
                    ? 'Fix TSV validation issues'
                    : 'Upload valid .tsv file'}
                </span>
              )}
              {!allNamesEntered && (
                <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs text-slate-500 font-medium">
                  Enter all 3 player names
                </span>
              )}
              {!timerSettingsValid && (
                <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs text-slate-500 font-medium">
                  Enter valid timer seconds
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVGs to avoid external deps)
// ---------------------------------------------------------------------------

function UploadIcon() {
  return (
    <svg
      className="h-10 w-10 text-[#0D5C58]/50"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg
      className="h-10 w-10 text-[#0D5C58]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="h-10 w-10 text-rose-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}
