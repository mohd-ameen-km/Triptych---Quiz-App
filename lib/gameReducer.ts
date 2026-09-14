/**
 * Game state reducer.
 *
 * Central reducer that manages the entire quiz game state
 * via useReducer — scores, current question, turns, etc.
 *
 * Only LOAD_TOPICS, SET_PLAYERS, and START_GAME are fully implemented.
 * All other action handlers are TODO stubs.
 */

import type {
  GameAction,
  GameMysteryBagEntry,
  GameMysteryBags,
  GameSnapshot,
  GameState,
  GameTopic,
  MysteryBag,
  ScoreEvent,
  Topic,
} from '@/types';
import { COLUMNS } from '@/types';
import {
  getTopicPicker,
  getPickDirection,
  getPassOrder,
  getNextPlayer,
  getMysteryPickOrder,
} from '@/lib/turnOrder';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'quizapp_game_state';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialState(): GameState {
  return {
    phase: 'setup',
    players: [],
    topics: [],
    mysteryBags: { left: [], center: [], right: [] },
    currentQuestion: null,
    turnOrder: null,
    scoreEvents: [],
    directSeconds: 25,
    passSeconds: 20,
    history: [],
    topicPhaseScore: null,
  };
}

/** Create an immutable deep snapshot of the game state for global history undo. */
export function createGameSnapshot(state: GameState): GameSnapshot {
  return {
    phase: state.phase,
    players: state.players.map((p) => ({ ...p })),
    topics: state.topics.map((t) => ({
      ...t,
      questions: t.questions.map((q) => ({ ...q })),
    })),
    mysteryBags: {
      left: state.mysteryBags.left.map((e) => ({
        ...e,
        question: { ...e.question },
      })),
      center: state.mysteryBags.center.map((e) => ({
        ...e,
        question: { ...e.question },
      })),
      right: state.mysteryBags.right.map((e) => ({
        ...e,
        question: { ...e.question },
      })),
    },
    currentQuestion: state.currentQuestion
      ? {
          ...state.currentQuestion,
          playersAttempted: [...state.currentQuestion.playersAttempted],
          passOrder: [...state.currentQuestion.passOrder],
          seatingOrder: state.currentQuestion.seatingOrder
            ? [...state.currentQuestion.seatingOrder]
            : undefined,
        }
      : null,
    turnOrder: state.turnOrder
      ? {
          ...state.turnOrder,
          seatOrder: state.turnOrder.seatOrder
            ? [...state.turnOrder.seatOrder]
            : [],
        }
      : null,
    scoreEvents: state.scoreEvents.map((e) => ({ ...e })),
    directSeconds: state.directSeconds,
    passSeconds: state.passSeconds,
    topicPhaseScore: state.topicPhaseScore
      ? { ...state.topicPhaseScore }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert raw parser topics into GameTopics with play-state fields. */
function toGameTopics(topics: Topic[]): GameTopic[] {
  return topics.map((t, i) => ({
    ...t,
    id: `topic-${i}`,
    taken: false,
    takenBy: null,
  }));
}

/** Convert raw parser mystery bag into GameMysteryBags with play-state fields. */
function toGameMysteryBags(bag: MysteryBag): GameMysteryBags {
  const convert = (entries: MysteryBag['left']): GameMysteryBagEntry[] =>
    entries.map((e, i) => ({
      ...e,
      id: `mystery-bag-${e.column}-${i}`,
      taken: false,
      takenBy: null,
    }));

  return {
    left: convert(bag.left),
    center: convert(bag.center),
    right: convert(bag.right),
  };
}

// ---------------------------------------------------------------------------
// LocalStorage persistence
// ---------------------------------------------------------------------------

/** Persist the current game state to localStorage. */
export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (SSR, private browsing quota, etc.)
  }
}

/** Attempt to load persisted game state from localStorage. */
export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

/** Clear persisted game state. */
export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // ── Fully implemented ───────────────────────────────────────────

    case 'LOAD_TOPICS': {
      const { topics, mysteryBag } = action.payload;
      return {
        ...state,
        topics: toGameTopics(topics),
        mysteryBags: toGameMysteryBags(mysteryBag),
      };
    }

    case 'SET_PLAYERS': {
      const players = action.payload.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: 0,
        bonusAttempts: 0,
      }));
      return {
        ...state,
        players,
      };
    }

    case 'START_GAME': {
      // Validate that topics have been loaded
      if (state.topics.length === 0) {
        console.warn('START_GAME: No topics loaded yet.');
        return state;
      }

      // Validate that at least 2 players are present
      if (state.players.length < 2) {
        console.warn('START_GAME: Need at least 2 players.');
        return state;
      }

      const seatOrder = state.players.map((p) => p.id);
      const pickIndex = 0;
      const starterPlayerId = getTopicPicker(pickIndex, seatOrder);
      const direction = getPickDirection(pickIndex);
      const directSeconds =
        action.payload?.directSeconds ?? state.directSeconds ?? 25;
      const passSeconds =
        action.payload?.passSeconds ?? state.passSeconds ?? 20;

      return {
        ...state,
        phase: 'topics',
        players: state.players.map((p) => ({
          ...p,
          score: 0,
          bonusAttempts: 0,
        })),
        turnOrder: {
          seatOrder,
          pickIndex,
          starterPlayerId,
          direction,
        },
        currentQuestion: null,
        directSeconds,
        passSeconds,
        history: [],
        topicPhaseScore: null,
      };
    }

    case 'SELECT_TOPIC': {
      const { topicId, questionIndex, mysteryBagId } = action.payload;
      const topic = state.topics.find((t) => t.id === topicId);
      if (!topic) return state;
      if (!state.turnOrder) return state;

      const question = topic.questions[questionIndex];
      if (!question) return state;

      const isMystery = Boolean(mysteryBagId) || question.isMysteryQuestion;

      let targetBagId: string | null = null;
      if (isMystery) {
        const bagEntries = state.mysteryBags[topic.column] ?? [];
        const entry = mysteryBagId
          ? bagEntries.find((e) => e.id === mysteryBagId)
          : bagEntries.find((e) => e.topicName === topic.name && !e.taken);
        if (!entry || entry.taken) return state;
        targetBagId = entry.id;
      } else {
        if (topic.taken) return state;
      }

      const seatOrder =
        state.turnOrder.seatOrder && state.turnOrder.seatOrder.length > 0
          ? state.turnOrder.seatOrder
          : state.players.map((p) => p.id);

      let directPlayer: string;
      let direction: 'forward' | 'reverse';
      let passOrder: string[];

      if (isMystery) {
        const topicScores =
          state.topicPhaseScore ??
          Object.fromEntries(state.players.map((p) => [p.id, p.score]));
        const mysteryOrder = getMysteryPickOrder(
          state.players,
          seatOrder,
          topicScores,
        );

        // If this mystery bag was already started, preserve the player who chose it
        const existingTaker = (state.mysteryBags[topic.column] ?? []).find(
          (e) => e.taken,
        )?.takenBy;

        if (existingTaker) {
          directPlayer = existingTaker;
        } else {
          // Count columns where mystery bags have already been picked/started
          const startedOrCompletedBags = COLUMNS.filter((col) =>
            (state.mysteryBags[col] ?? []).some((e) => e.taken),
          ).length;
          const mysteryTurnIdx = Math.min(startedOrCompletedBags, 2);
          directPlayer = mysteryOrder[mysteryTurnIdx] ?? mysteryOrder[0];
        }

        direction = 'forward';
        passOrder = getPassOrder(directPlayer, direction, seatOrder);
      } else {
        const pickIndex = state.turnOrder.pickIndex ?? 0;
        directPlayer = getTopicPicker(pickIndex, seatOrder);
        direction = getPickDirection(pickIndex);
        passOrder = getPassOrder(directPlayer, direction, seatOrder);
      }

      const snapshot = createGameSnapshot(state);
      const history = [...(state.history ?? []), snapshot];

      return {
        ...state,
        phase: 'question',
        // When taking a mystery bag, DO NOT mark the named topic as taken!
        // Every other topic in its column must remain in whatever state it was actually in.
        topics: isMystery
          ? state.topics
          : state.topics.map((t) =>
              t.id === topicId
                ? {
                    ...t,
                    taken: true,
                    takenBy: t.takenBy ?? directPlayer,
                    directPlayer: t.directPlayer ?? directPlayer,
                    direction: t.direction ?? direction,
                  }
                : t,
            ),
        // When taking a mystery bag, update ONLY the single selected bag entry by its own ID!
        mysteryBags:
          isMystery && targetBagId
            ? {
                ...state.mysteryBags,
                [topic.column]: state.mysteryBags[topic.column].map((e) =>
                  e.id === targetBagId
                    ? { ...e, taken: true, takenBy: directPlayer }
                    : e,
                ),
              }
            : state.mysteryBags,
        currentQuestion: {
          topicId,
          questionIndex,
          mysteryBagId: targetBagId ?? undefined,
          whoseTurn: directPlayer,
          directPlayer,
          direction,
          passOrder,
          playersAttempted: [],
          revealed: false,
          isComplete: false,
          topicStarterPlayerId: directPlayer,
          startedAt: new Date().toISOString(),
          seatingOrder: passOrder,
        },
        history,
      };
    }

    case 'MARK_CORRECT': {
      if (!state.currentQuestion) return state;
      const winnerId = state.currentQuestion.whoseTurn;
      const { topicId, questionIndex, directPlayer } = state.currentQuestion;
      const isBonus = winnerId !== directPlayer;

      const snapshot = createGameSnapshot(state);
      const history = [...(state.history ?? []), snapshot];

      // Award 1 point to the current player; increment bonusAttempts if not direct player
      const updatedPlayers = state.players.map((p) => {
        if (p.id === winnerId) {
          return {
            ...p,
            score: p.score + 1,
            bonusAttempts: isBonus
              ? (p.bonusAttempts ?? 0) + 1
              : (p.bonusAttempts ?? 0),
          };
        }
        return p;
      });

      const newScoreEvent: ScoreEvent = {
        playerId: winnerId,
        topicId,
        questionIndex,
        points: 1,
      };

      const currentTopic = state.topics.find((t) => t.id === topicId);
      const isMystery =
        Boolean(state.currentQuestion.mysteryBagId) ||
        (currentTopic?.questions[questionIndex]?.isMysteryQuestion ?? false);

      const updatedTopicPhaseScore =
        state.topicPhaseScore && !isMystery
          ? {
              ...state.topicPhaseScore,
              [winnerId]: (state.topicPhaseScore[winnerId] ?? 0) + 1,
            }
          : state.topicPhaseScore;

      return {
        ...state,
        players: updatedPlayers,
        scoreEvents: [...(state.scoreEvents ?? []), newScoreEvent],
        topicPhaseScore: updatedTopicPhaseScore,
        history,
        currentQuestion: {
          ...state.currentQuestion,
          revealed: state.currentQuestion.revealed,
          isComplete: true,
        },
      };
    }

    case 'MARK_WRONG':
    case 'PASS': {
      if (!state.currentQuestion) return state;

      const snapshot = createGameSnapshot(state);
      const history = [...(state.history ?? []), snapshot];

      const currentTurn = state.currentQuestion.whoseTurn;
      const isWrong = action.type === 'MARK_WRONG';
      const isBonus =
        isWrong && currentTurn !== state.currentQuestion.directPlayer;

      // Update bonusAttempts if marked wrong on a pass attempt; PASS never touches BA
      const updatedPlayers = isBonus
        ? state.players.map((p) =>
            p.id === currentTurn
              ? { ...p, bonusAttempts: (p.bonusAttempts ?? 0) + 1 }
              : p,
          )
        : state.players;

      const newAttempted = state.currentQuestion.playersAttempted.includes(
        currentTurn,
      )
        ? state.currentQuestion.playersAttempted
        : [...state.currentQuestion.playersAttempted, currentTurn];

      // If all players have attempted, mark question complete with nobody scoring
      if (newAttempted.length >= updatedPlayers.length) {
        return {
          ...state,
          players: updatedPlayers,
          history,
          currentQuestion: {
            ...state.currentQuestion,
            playersAttempted: newAttempted,
            revealed: state.currentQuestion.revealed,
            isComplete: true,
          },
        };
      }

      const passOrder =
        state.currentQuestion.passOrder &&
        state.currentQuestion.passOrder.length > 0
          ? state.currentQuestion.passOrder
          : getPassOrder(
              state.currentQuestion.directPlayer,
              state.currentQuestion.direction,
              state.turnOrder?.seatOrder ?? state.players.map((p) => p.id),
            );

      const bonusAttempts = Object.fromEntries(
        updatedPlayers.map((p) => [p.id, p.bonusAttempts ?? 0]),
      );

      const nextPlayer = getNextPlayer(passOrder, newAttempted, bonusAttempts);

      if (!nextPlayer) {
        return {
          ...state,
          players: updatedPlayers,
          history,
          currentQuestion: {
            ...state.currentQuestion,
            playersAttempted: newAttempted,
            revealed: state.currentQuestion.revealed,
            isComplete: true,
          },
        };
      }

      return {
        ...state,
        players: updatedPlayers,
        history,
        currentQuestion: {
          ...state.currentQuestion,
          whoseTurn: nextPlayer,
          playersAttempted: newAttempted,
          revealed: state.currentQuestion.revealed,
          isComplete: false,
        },
      };
    }

    case 'UNDO': {
      if (!state.history || state.history.length === 0) {
        return state;
      }

      const nextHistory = [...state.history];
      const previous = nextHistory.pop()!;

      return {
        ...previous,
        history: nextHistory,
      };
    }

    case 'REVEAL_ANSWER': {
      if (!state.currentQuestion || state.currentQuestion.revealed)
        return state;
      const snapshot = createGameSnapshot(state);
      const history = [...(state.history ?? []), snapshot];
      return {
        ...state,
        history,
        currentQuestion: {
          ...state.currentQuestion,
          revealed: true,
        },
      };
    }

    case 'GO_TO_BOARD':
    case 'NEXT_QUESTION': {
      if (!state.currentQuestion) {
        return { ...state, phase: 'topics' };
      }

      const { topicId, questionIndex, directPlayer, mysteryBagId } =
        state.currentQuestion;
      const topic = state.topics.find((t) => t.id === topicId);
      const directId =
        directPlayer ??
        state.currentQuestion.topicStarterPlayerId ??
        state.turnOrder?.starterPlayerId ??
        state.players[0]?.id;

      if (!topic) {
        const snapshot = createGameSnapshot(state);
        const history = [...(state.history ?? []), snapshot];
        return {
          ...state,
          phase: 'topics',
          currentQuestion: null,
          history,
        };
      }

      const currentQ = topic.questions[questionIndex];
      const isMystery =
        Boolean(mysteryBagId) || (currentQ?.isMysteryQuestion ?? false);

      // NEXT_QUESTION advances to the next question within this topic or mystery bag if available.
      // GO_TO_BOARD always returns directly to the topics board.
      if (action.type === 'NEXT_QUESTION') {
        if (!isMystery) {
          const nextQIndex = topic.questions.findIndex(
            (q, idx) => idx > questionIndex && !q.isMysteryQuestion,
          );

          if (nextQIndex !== -1) {
            const snapshot = createGameSnapshot(state);
            const history = [...(state.history ?? []), snapshot];
            return {
              ...state,
              history,
              currentQuestion: {
                ...state.currentQuestion,
                questionIndex: nextQIndex,
                whoseTurn: directId,
                playersAttempted: [],
                revealed: false,
                isComplete: false,
                startedAt: new Date().toISOString(),
              },
            };
          }
        } else {
          // Mystery bag: check if there are more unanswered questions in this column's mystery bag
          const colBag = state.mysteryBags[topic.column] ?? [];
          const nextEntry = colBag.find(
            (e) => !e.taken && e.id !== mysteryBagId,
          );

          if (nextEntry) {
            const nextTopic = state.topics.find(
              (t) => t.name === nextEntry.topicName,
            );
            if (nextTopic) {
              const nextQIdx = nextTopic.questions.findIndex(
                (q) => q.isMysteryQuestion,
              );
              const snapshot = createGameSnapshot(state);
              const history = [...(state.history ?? []), snapshot];

              return {
                ...state,
                history,
                mysteryBags: {
                  ...state.mysteryBags,
                  [topic.column]: state.mysteryBags[topic.column].map((e) =>
                    e.id === nextEntry.id
                      ? { ...e, taken: true, takenBy: directId }
                      : e,
                  ),
                },
                currentQuestion: {
                  ...state.currentQuestion,
                  topicId: nextTopic.id,
                  questionIndex: nextQIdx !== -1 ? nextQIdx : 0,
                  mysteryBagId: nextEntry.id,
                  whoseTurn: directId,
                  directPlayer: directId,
                  playersAttempted: [],
                  revealed: false,
                  isComplete: false,
                  startedAt: new Date().toISOString(),
                },
              };
            }
          }
        }
      }

      const snapshot = createGameSnapshot(state);
      const history = [...(state.history ?? []), snapshot];

      // If returning to board (or no questions remain), determine taken state and turn order
      const nextTopics = isMystery
        ? state.topics
        : state.topics.map((t) =>
            t.id === topicId ? { ...t, taken: true, takenBy: directId } : t,
          );

      const nextMysteryBags =
        isMystery && mysteryBagId
          ? {
              ...state.mysteryBags,
              [topic.column]: state.mysteryBags[topic.column].map((e) =>
                e.id === mysteryBagId
                  ? { ...e, taken: true, takenBy: directId }
                  : e,
              ),
            }
          : state.mysteryBags;

      const boardTopics = nextTopics.filter((t) =>
        t.questions.some((q) => !q.isMysteryQuestion),
      );
      const allNamedTopicsCompleted =
        boardTopics.length > 0
          ? boardTopics.every((t) => t.taken)
          : nextTopics.length > 0 && nextTopics.every((t) => t.taken);

      let nextTopicPhaseScore = state.topicPhaseScore;
      if (allNamedTopicsCompleted && !nextTopicPhaseScore) {
        nextTopicPhaseScore = Object.fromEntries(
          state.players.map((p) => [p.id, p.score]),
        );
      }

      let nextTurnOrder = state.turnOrder;
      if (state.turnOrder && state.players.length > 0) {
        const seatOrder =
          state.turnOrder.seatOrder && state.turnOrder.seatOrder.length > 0
            ? state.turnOrder.seatOrder
            : state.players.map((p) => p.id);

        if (allNamedTopicsCompleted) {
          const completedBagsCount = COLUMNS.filter(
            (col) =>
              (nextMysteryBags[col] ?? []).length > 0 &&
              (nextMysteryBags[col] ?? []).every((e) => e.taken),
          ).length;
          const mysteryTurnIdx = Math.min(completedBagsCount, 2);
          const mysteryOrder = getMysteryPickOrder(
            state.players,
            seatOrder,
            nextTopicPhaseScore ?? {},
          );
          nextTurnOrder = {
            seatOrder,
            pickIndex: 18 + completedBagsCount,
            starterPlayerId: mysteryOrder[mysteryTurnIdx] ?? mysteryOrder[0],
            direction: 'forward',
          };
        } else {
          const nextPickIndex = (state.turnOrder.pickIndex ?? 0) + 1;
          nextTurnOrder = {
            seatOrder,
            pickIndex: nextPickIndex,
            starterPlayerId: getTopicPicker(nextPickIndex, seatOrder),
            direction: getPickDirection(nextPickIndex),
          };
        }
      }

      return {
        ...state,
        phase: 'topics',
        topics: nextTopics,
        mysteryBags: nextMysteryBags,
        turnOrder: nextTurnOrder,
        currentQuestion: null,
        topicPhaseScore: nextTopicPhaseScore,
        history,
      };
    }

    case 'RESET_TOPIC': {
      const snapshot = createGameSnapshot(state);
      const history = [...(state.history ?? []), snapshot];

      const { topicId, questionIndex, mysteryBagId } = action.payload;
      const topic = state.topics.find((t) => t.id === topicId);
      const isCurrent = state.currentQuestion?.topicId === topicId;

      // Determine if resetting a specific mystery question or the whole topic
      const isResettingMystery =
        mysteryBagId !== undefined ||
        Boolean(state.currentQuestion?.mysteryBagId) ||
        (questionIndex !== undefined
          ? (topic?.questions[questionIndex]?.isMysteryQuestion ?? false)
          : isCurrent &&
            (topic?.questions[state.currentQuestion!.questionIndex]
              ?.isMysteryQuestion ??
              false));

      const targetMysteryId =
        mysteryBagId ??
        (isCurrent ? state.currentQuestion?.mysteryBagId : undefined);

      // 1. Find points awarded during this topic / question play
      const topicEvents = (state.scoreEvents ?? []).filter((e) => {
        if (e.topicId !== topicId) return false;
        if (isResettingMystery) {
          const targetQIdx =
            questionIndex !== undefined
              ? questionIndex
              : isCurrent
                ? state.currentQuestion!.questionIndex
                : (topic?.questions.findIndex((q) => q.isMysteryQuestion) ?? 0);
          return e.questionIndex === targetQIdx;
        }
        return true;
      });

      // Compute total points to deduct per player
      const deductions: Record<string, number> = {};
      for (const event of topicEvents) {
        deductions[event.playerId] =
          (deductions[event.playerId] ?? 0) + event.points;
      }

      // 2. Subtract those points from the relevant players
      const updatedPlayers = state.players.map((p) => {
        const toDeduct = deductions[p.id] ?? 0;
        return toDeduct > 0
          ? { ...p, score: Math.max(0, p.score - toDeduct) }
          : p;
      });

      // 3. Remove those events from scoreEvents
      const eventIdsToRemove = new Set(topicEvents);
      const updatedScoreEvents = (state.scoreEvents ?? []).filter(
        (e) => !eventIdsToRemove.has(e),
      );

      // 4. Update topicPhaseScore if resetting a named topic after capture
      let updatedTopicPhaseScore = state.topicPhaseScore;
      if (!isResettingMystery && state.topicPhaseScore) {
        updatedTopicPhaseScore = { ...state.topicPhaseScore };
        for (const [playerId, toDeduct] of Object.entries(deductions)) {
          if (toDeduct > 0 && updatedTopicPhaseScore[playerId] !== undefined) {
            updatedTopicPhaseScore[playerId] = Math.max(
              0,
              updatedTopicPhaseScore[playerId] - toDeduct,
            );
          }
        }
      }

      const updatedTopics = isResettingMystery
        ? state.topics
        : state.topics.map((t) =>
            t.id === topicId
              ? {
                  ...t,
                  taken: false,
                  takenBy: null,
                  directPlayer: undefined,
                  direction: undefined,
                }
              : t,
          );

      const updatedMysteryBags =
        topic && isResettingMystery
          ? {
              ...state.mysteryBags,
              [topic.column]: state.mysteryBags[topic.column].map((e) =>
                (
                  targetMysteryId
                    ? e.id === targetMysteryId
                    : e.topicName === topic.name
                )
                  ? { ...e, taken: false, takenBy: null }
                  : e,
              ),
            }
          : state.mysteryBags;

      let updatedTurnOrder = state.turnOrder;
      if (state.turnOrder && state.players.length > 0) {
        const seatOrder =
          state.turnOrder.seatOrder && state.turnOrder.seatOrder.length > 0
            ? state.turnOrder.seatOrder
            : state.players.map((p) => p.id);

        const boardTopics = updatedTopics.filter((t) =>
          t.questions.some((q) => !q.isMysteryQuestion),
        );
        const allCompleted =
          boardTopics.length > 0
            ? boardTopics.every((t) => t.taken)
            : updatedTopics.length > 0 && updatedTopics.every((t) => t.taken);

        if (allCompleted) {
          const completedBagsCount = COLUMNS.filter(
            (col) =>
              (updatedMysteryBags[col] ?? []).length > 0 &&
              (updatedMysteryBags[col] ?? []).every((e) => e.taken),
          ).length;
          const mysteryTurnIdx = Math.min(completedBagsCount, 2);
          const mysteryOrder = getMysteryPickOrder(
            updatedPlayers,
            seatOrder,
            updatedTopicPhaseScore ?? {},
          );
          updatedTurnOrder = {
            seatOrder,
            pickIndex: 18 + completedBagsCount,
            starterPlayerId: mysteryOrder[mysteryTurnIdx] ?? mysteryOrder[0],
            direction: 'forward',
          };
        }
      }

      return {
        ...state,
        phase: isCurrent ? 'topics' : state.phase,
        players: updatedPlayers,
        scoreEvents: updatedScoreEvents,
        topicPhaseScore: updatedTopicPhaseScore,
        turnOrder: updatedTurnOrder,
        currentQuestion: isCurrent ? null : state.currentQuestion,
        topics: updatedTopics,
        mysteryBags: updatedMysteryBags,
        history,
      };
    }

    case 'END_GAME': {
      return {
        ...state,
        phase: 'result',
        currentQuestion: null,
      };
    }

    case 'NEW_GAME': {
      clearState();
      return createInitialState();
    }

    case 'HYDRATE': {
      return {
        ...action.payload,
        scoreEvents: action.payload.scoreEvents ?? [],
      };
    }

    default: {
      // Exhaustive check — if TypeScript complains here, an action
      // type is missing from the switch.
      const _exhaustive: never = action;
      console.warn('Unknown action:', _exhaustive);
      return state;
    }
  }
}
