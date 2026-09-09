/**
 * Shared type definitions for the quiz app.
 */

// ---------------------------------------------------------------------------
// Board layout
// ---------------------------------------------------------------------------

/** The three board columns a topic can be placed in. */
export type Column = 'left' | 'center' | 'right';

/** All valid column values, useful for iteration / validation. */
export const COLUMNS: readonly Column[] = ['left', 'center', 'right'] as const;

/** Display labels for board columns. */
export const COLUMN_LABELS: Record<Column, string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
};

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/** A single quiz question parsed from a TSV row. */
export interface Question {
  /** 1-based question number within its topic. */
  questionNumber: number;

  /** Whether this question lives in the mystery bag rather than on the board. */
  isMysteryQuestion: boolean;

  /** The question prompt shown to players. */
  questionText: string;

  /** The correct answer. */
  answerText: string;

  // Optional media attachments – empty string means "no media".
  questionImage: string;
  answerImage: string;
  questionVideo: string;
  answerVideo: string;
  questionAudio: string;
  answerAudio: string;
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

/** A topic (category) on the quiz board – raw from the parser. */
export interface Topic {
  /** Display name shown on the board. */
  name: string;

  /** Which board column this topic belongs to. */
  column: Column;

  /** Whether this is a mystery topic (has a question in the mystery bag). */
  isMysteryTopic: boolean;

  /** Ordered list of questions under this topic. */
  questions: Question[];
}

/** A topic enriched with game-play state (used in the reducer). */
export interface GameTopic extends Topic {
  /** Unique id for this topic (index-based or name-based). */
  id: string;

  /** Whether this topic has been selected and completed. */
  taken: boolean;

  /** The player id who selected (and thus "owns") this topic, or null. */
  takenBy: string | null;

  /** The player id who received this topic directly. */
  directPlayer?: string;

  /** Round direction when topic was picked: 'forward' | 'reverse'. */
  direction?: 'forward' | 'reverse';
}

// ---------------------------------------------------------------------------
// Mystery Bag
// ---------------------------------------------------------------------------

/** A single entry in the mystery bag, linking back to its source topic. */
export interface MysteryBagEntry {
  topicName: string;
  column: Column;
  question: Question;
}

/**
 * The mystery bag collects one mystery question from each mystery topic.
 * Grouped by column so the game can draw from a specific column's bag.
 */
export interface MysteryBag {
  left: MysteryBagEntry[];
  center: MysteryBagEntry[];
  right: MysteryBagEntry[];
}

/** A mystery bag entry enriched with game-play state. */
export interface GameMysteryBagEntry extends MysteryBagEntry {
  id: string;
  taken: boolean;
  takenBy: string | null;
}

/** Mystery bags with game-play state, grouped by column. */
export interface GameMysteryBags {
  left: GameMysteryBagEntry[];
  center: GameMysteryBagEntry[];
  right: GameMysteryBagEntry[];
}

// ---------------------------------------------------------------------------
// TSV parser result
// ---------------------------------------------------------------------------

/** Return type of the `parseTsv` function. */
export interface ParseResult {
  topics: Topic[];
  mysteryBag: MysteryBag;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

/** A player / team in the quiz. */
export interface Player {
  id: string;
  name: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Current question state
// ---------------------------------------------------------------------------

/** Tracks the actively-displayed question during gameplay. */
export interface CurrentQuestion {
  /** The id of the topic this question belongs to. */
  topicId: string;

  /** Index into the topic's questions array. */
  questionIndex: number;

  /** Player id whose turn it is to answer. */
  whoseTurn: string;

  /** Player ids who have already attempted this question. */
  playersAttempted: string[];

  /** Whether the answer has been revealed (shown to the host). */
  revealed: boolean;

  /** ISO timestamp of when this question was started. */
  startedAt: string;

  /** Whether the current question round is complete (either answered correctly or all attempted). */
  isComplete: boolean;

  /** The player who received this question directly (always gets question first). */
  directPlayer: string;

  /** Round direction ('forward' | 'reverse'). */
  direction: 'forward' | 'reverse';

  /** Ordered list of players to receive passes (tie-break walk order). */
  passOrder: string[];

  /** Mystery bag entry ID if this question is from a mystery bag. */
  mysteryBagId?: string;

  /** The player id who picked/started this topic (backward-compatibility alias). */
  topicStarterPlayerId?: string;

  /** Precomputed turn rotation order for this question round. */
  seatingOrder?: string[];
}

// ---------------------------------------------------------------------------
// Turn order
// ---------------------------------------------------------------------------

/** Tracks the topic-pick and turn rotation state. */
export interface TurnOrderState {
  /** Fixed seating order of players [P1, P2, P3]. */
  seatOrder: string[];

  /** Current topic-pick sequence index (0, 1, 2, ...). */
  pickIndex: number;

  /** The player id whose turn it is to pick (from getTopicPicker). */
  starterPlayerId: string;

  /** Rotation direction: 'forward' | 'reverse'. */
  direction: 'forward' | 'reverse';
}

// ---------------------------------------------------------------------------
// Game phases
// ---------------------------------------------------------------------------

export type GamePhase = 'setup' | 'topics' | 'question' | 'result';

// ---------------------------------------------------------------------------
// Score tracking events
// ---------------------------------------------------------------------------

/** Tracks individual scoring events to allow granular rewinds/resets. */
export interface ScoreEvent {
  playerId: string;
  topicId: string;
  questionIndex: number;
  points: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  players: Player[];
  topics: GameTopic[];
  mysteryBags: GameMysteryBags;
  currentQuestion: CurrentQuestion | null;
  turnOrder: TurnOrderState | null;
  scoreEvents: ScoreEvent[];
  directSeconds: number;
  passSeconds: number;
}

// ---------------------------------------------------------------------------
// Game state (top-level)
// ---------------------------------------------------------------------------

/** Top-level game state managed by the reducer. */
export interface GameState {
  phase: GamePhase;
  players: Player[];
  topics: GameTopic[];
  mysteryBags: GameMysteryBags;
  currentQuestion: CurrentQuestion | null;
  turnOrder: TurnOrderState | null;
  scoreEvents: ScoreEvent[];
  directSeconds: number;
  passSeconds: number;
  history: GameSnapshot[];
}

// ---------------------------------------------------------------------------
// Game actions
// ---------------------------------------------------------------------------

export type GameAction =
  | {
      type: 'LOAD_TOPICS';
      payload: { topics: Topic[]; mysteryBag: MysteryBag };
    }
  | { type: 'SET_PLAYERS'; payload: { players: Pick<Player, 'id' | 'name'>[] } }
  | {
      type: 'START_GAME';
      payload?: {
        starterPlayerId?: string;
        direction?: 'forward' | 'reverse' | (1 | -1);
        directSeconds?: number;
        passSeconds?: number;
      };
    }
  | {
      type: 'SELECT_TOPIC';
      payload: {
        topicId: string;
        questionIndex: number;
        mysteryBagId?: string;
      };
    }
  | { type: 'MARK_CORRECT' }
  | { type: 'MARK_WRONG' }
  | { type: 'PASS' }
  | { type: 'UNDO' }
  | { type: 'REVEAL_ANSWER' }
  | { type: 'NEXT_QUESTION' }
  | {
      type: 'RESET_TOPIC';
      payload: {
        topicId: string;
        questionIndex?: number;
        mysteryBagId?: string;
      };
    }
  | { type: 'END_GAME' }
  | { type: 'NEW_GAME' }
  | { type: 'HYDRATE'; payload: GameState };
