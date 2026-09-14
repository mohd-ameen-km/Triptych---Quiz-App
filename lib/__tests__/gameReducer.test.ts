import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from '@/lib/gameReducer';
import type { GameState, Topic, MysteryBag } from '@/types';

function createMockData() {
  const topics: Topic[] = [];
  const mysteryBag: MysteryBag = { left: [], center: [], right: [] };

  for (const col of ['left', 'center', 'right'] as const) {
    for (let t = 1; t <= 6; t++) {
      const isMystery = t <= 3;
      const topicName = `${col}_topic_${t}`;
      const questions = [
        {
          questionNumber: 1,
          isMysteryQuestion: false,
          questionText: `${topicName} Q1`,
          answerText: `${topicName} A1`,
          questionImage: '',
          answerImage: '',
          questionVideo: '',
          answerVideo: '',
          questionAudio: '',
          answerAudio: '',
        },
        {
          questionNumber: 2,
          isMysteryQuestion: isMystery,
          questionText: `${topicName} Q2`,
          answerText: `${topicName} A2`,
          questionImage: '',
          answerImage: '',
          questionVideo: '',
          answerVideo: '',
          questionAudio: '',
          answerAudio: '',
        },
      ];
      topics.push({
        name: topicName,
        column: col,
        isMysteryTopic: isMystery,
        questions,
      });

      if (isMystery) {
        mysteryBag[col].push({
          topicName,
          column: col,
          question: questions[1],
        });
      }
    }
  }

  return { topics, mysteryBag };
}

describe('gameReducer - Topics and Turn Order integration', () => {
  function setupActiveGame(): GameState {
    const initial = createInitialState();
    const { topics, mysteryBag } = createMockData();

    const loaded = gameReducer(initial, {
      type: 'LOAD_TOPICS',
      payload: { topics, mysteryBag },
    });

    const withPlayers = gameReducer(loaded, {
      type: 'SET_PLAYERS',
      payload: {
        players: [
          { id: 'player-1', name: 'Alice' },
          { id: 'player-2', name: 'Bob' },
          { id: 'player-3', name: 'Charlie' },
        ],
      },
    });

    return gameReducer(withPlayers, {
      type: 'START_GAME',
      payload: { starterPlayerId: 'player-1', direction: 1 },
    });
  }

  it('stores directSeconds and passSeconds in game state on START_GAME', () => {
    const initial = createInitialState();
    const { topics, mysteryBag } = createMockData();

    const loaded = gameReducer(initial, {
      type: 'LOAD_TOPICS',
      payload: { topics, mysteryBag },
    });

    const withPlayers = gameReducer(loaded, {
      type: 'SET_PLAYERS',
      payload: {
        players: [
          { id: 'player-1', name: 'Alice' },
          { id: 'player-2', name: 'Bob' },
        ],
      },
    });

    const game = gameReducer(withPlayers, {
      type: 'START_GAME',
      payload: {
        starterPlayerId: 'player-1',
        directSeconds: 30,
        passSeconds: 15,
      },
    });

    expect(game.directSeconds).toBe(30);
    expect(game.passSeconds).toBe(15);
  });

  it('uses default directSeconds (25) and passSeconds (20) if not specified', () => {
    const state = setupActiveGame();
    expect(state.directSeconds).toBe(25);
    expect(state.passSeconds).toBe(20);
  });

  it('selects an available topic, marks it taken, and sets up currentQuestion', () => {
    const state = setupActiveGame();
    expect(state.phase).toBe('topics');
    expect(state.topics[0].taken).toBe(false);

    const nextState = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });

    expect(nextState.phase).toBe('question');
    expect(nextState.topics[0].taken).toBe(true);
    expect(nextState.topics[0].takenBy).toBe('player-1');
    expect(nextState.currentQuestion).toBeDefined();
    expect(nextState.currentQuestion?.topicId).toBe(state.topics[0].id);
    expect(nextState.currentQuestion?.questionIndex).toBe(0);
    expect(nextState.currentQuestion?.whoseTurn).toBe('player-1');
    expect(nextState.currentQuestion?.directPlayer).toBe('player-1');
    expect(nextState.currentQuestion?.direction).toBe('forward');
    expect(nextState.currentQuestion?.passOrder).toEqual([
      'player-2',
      'player-3',
    ]);
  });

  it('ignores SELECT_TOPIC if topic is already taken', () => {
    const state = setupActiveGame();
    const firstState = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });

    // Attempting to select the same topic again should be a no-op
    const secondState = gameReducer(firstState, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });

    expect(secondState).toBe(firstState);
  });

  it('resets a taken topic back to available', () => {
    const state = setupActiveGame();
    const takenState = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(takenState.topics[0].taken).toBe(true);

    const resetState = gameReducer(takenState, {
      type: 'RESET_TOPIC',
      payload: { topicId: state.topics[0].id },
    });

    expect(resetState.topics[0].taken).toBe(false);
    expect(resetState.topics[0].takenBy).toBeNull();
  });

  it('allows selecting a mystery question from mystery bag even if topic.taken is true', () => {
    let state = setupActiveGame();

    // Mark the topic as taken on the main board
    state = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(state.topics[0].taken).toBe(true);

    // Switch phase back to topics to simulate mystery bag phase
    const readyForMystery: GameState = {
      ...state,
      phase: 'topics',
    };

    // Question 1 of topic 0 is the mystery question (isMysteryQuestion: true)
    const mysteryState = gameReducer(readyForMystery, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 1 },
    });

    expect(mysteryState.phase).toBe('question');
    expect(mysteryState.currentQuestion?.topicId).toBe(state.topics[0].id);
    expect(mysteryState.currentQuestion?.questionIndex).toBe(1);

    // Corresponding mystery bag entry should now be taken
    const entry = mysteryState.mysteryBags.left.find(
      (e) => e.topicName === state.topics[0].name,
    );
    expect(entry?.taken).toBe(true);
    expect(entry?.takenBy).toBe('player-1');
  });

  it('computes reverse direction and pass order correctly at pickIndex 3', () => {
    const game = setupActiveGame();
    // Simulate pickIndex: 3 (positions 3-5 are reverse, starting with P3='player-3')
    const reverseGame: GameState = {
      ...game,
      turnOrder: {
        seatOrder: ['player-1', 'player-2', 'player-3'],
        pickIndex: 3,
        starterPlayerId: 'player-3',
        direction: 'reverse',
      },
    };

    const selected = gameReducer(reverseGame, {
      type: 'SELECT_TOPIC',
      payload: { topicId: game.topics[0].id, questionIndex: 0 },
    });

    expect(selected.currentQuestion?.whoseTurn).toBe('player-3');
    expect(selected.currentQuestion?.directPlayer).toBe('player-3');
    expect(selected.currentQuestion?.direction).toBe('reverse');
    expect(selected.currentQuestion?.passOrder).toEqual([
      'player-2',
      'player-1',
    ]);
  });

  it('follows the 6-cycle (P1, P2, P3, P3, P2, P1) as topics complete', () => {
    let state = setupActiveGame();
    const expectedPickers = [
      'player-1',
      'player-2',
      'player-3',
      'player-3',
      'player-2',
      'player-1',
      'player-1', // cycle repeats
    ];

    for (let i = 0; i < expectedPickers.length; i++) {
      expect(state.turnOrder?.starterPlayerId).toBe(expectedPickers[i]);
      expect(state.turnOrder?.pickIndex).toBe(i);

      // Select and complete all questions in topic i
      const topic = state.topics[i];
      let s = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: topic.id, questionIndex: 0 },
      });
      while (s.phase === 'question') {
        s = gameReducer(s, { type: 'MARK_CORRECT' });
        s = gameReducer(s, { type: 'NEXT_QUESTION' });
      }
      state = s;
    }
  });

  it('MARK_CORRECT awards 1 point to the active player and marks question complete', () => {
    const state = setupActiveGame();
    const qState = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(qState.players[0].score).toBe(0);
    expect(qState.currentQuestion?.revealed).toBe(false);
    expect(qState.currentQuestion?.isComplete).toBe(false);

    const correctState = gameReducer(qState, { type: 'MARK_CORRECT' });
    expect(correctState.players[0].score).toBe(1);
    expect(correctState.currentQuestion?.revealed).toBe(false);
    expect(correctState.currentQuestion?.isComplete).toBe(true);
  });

  it('PASS advances turn to the next player via turn order; marks complete if all 3 attempted', () => {
    const state = setupActiveGame();
    const qState = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(qState.currentQuestion?.whoseTurn).toBe('player-1');

    // Player 1 passes
    const pass1 = gameReducer(qState, { type: 'PASS' });
    expect(pass1.currentQuestion?.playersAttempted).toEqual(['player-1']);
    // Since scores are tied, next in order [player-1, player-2, player-3] is player-2
    expect(pass1.currentQuestion?.whoseTurn).toBe('player-2');
    expect(pass1.currentQuestion?.isComplete).toBe(false);

    // Player 2 passes
    const pass2 = gameReducer(pass1, { type: 'PASS' });
    expect(pass2.currentQuestion?.playersAttempted).toEqual([
      'player-1',
      'player-2',
    ]);
    expect(pass2.currentQuestion?.whoseTurn).toBe('player-3');
    expect(pass2.currentQuestion?.isComplete).toBe(false);

    // Player 3 passes (all 3 attempted -> mark complete with nobody scoring)
    const pass3 = gameReducer(pass2, { type: 'PASS' });
    expect(pass3.currentQuestion?.playersAttempted).toEqual([
      'player-1',
      'player-2',
      'player-3',
    ]);
    expect(pass3.currentQuestion?.revealed).toBe(false);
    expect(pass3.currentQuestion?.isComplete).toBe(true);
    // Scores unchanged
    expect(pass3.players.every((p) => p.score === 0)).toBe(true);
  });

  it('REVEAL_ANSWER sets revealed to true without modifying score or turn', () => {
    const state = setupActiveGame();
    const qState = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(qState.currentQuestion?.revealed).toBe(false);

    const revealedState = gameReducer(qState, { type: 'REVEAL_ANSWER' });
    expect(revealedState.currentQuestion?.revealed).toBe(true);
    expect(revealedState.currentQuestion?.whoseTurn).toBe('player-1');
  });

  it('NEXT_QUESTION advances to topic next question if any, resetting attempted and turn to starter', () => {
    const state = setupActiveGame();

    // Modify topic 0 in state to have 2 non-mystery questions
    const multiQState: GameState = {
      ...state,
      topics: state.topics.map((t, idx) =>
        idx === 0
          ? {
              ...t,
              questions: [
                { ...t.questions[0], isMysteryQuestion: false },
                { ...t.questions[1], isMysteryQuestion: false },
              ],
            }
          : t,
      ),
    };

    // Select topic 0, question 0
    let qState = gameReducer(multiQState, {
      type: 'SELECT_TOPIC',
      payload: { topicId: multiQState.topics[0].id, questionIndex: 0 },
    });

    // Player 1 passes, Player 2 is now up
    qState = gameReducer(qState, { type: 'PASS' });
    expect(qState.currentQuestion?.whoseTurn).toBe('player-2');
    expect(qState.currentQuestion?.playersAttempted).toEqual(['player-1']);

    // Player 2 marks correct
    qState = gameReducer(qState, { type: 'MARK_CORRECT' });
    expect(qState.currentQuestion?.isComplete).toBe(true);

    // Dispatch NEXT_QUESTION -> should advance to questionIndex 1, reset attempted list and turn to starter (player-1)
    const nextQState = gameReducer(qState, { type: 'NEXT_QUESTION' });
    expect(nextQState.phase).toBe('question');
    expect(nextQState.currentQuestion?.questionIndex).toBe(1);
    expect(nextQState.currentQuestion?.whoseTurn).toBe('player-1');
    expect(nextQState.currentQuestion?.playersAttempted).toEqual([]);
    expect(nextQState.currentQuestion?.revealed).toBe(false);
    expect(nextQState.currentQuestion?.isComplete).toBe(false);

    // Complete question 1
    const completedQ1 = gameReducer(nextQState, { type: 'MARK_CORRECT' });

    // Dispatch NEXT_QUESTION again -> no more questions remain -> topic complete, return to 'topics'
    const exhaustedState = gameReducer(completedQ1, { type: 'NEXT_QUESTION' });
    expect(exhaustedState.phase).toBe('topics');
    expect(exhaustedState.currentQuestion).toBeNull();
    expect(exhaustedState.topics[0].taken).toBe(true);
    expect(exhaustedState.topics[0].takenBy).toBe('player-1');
    // Turn rotates to player-2
    expect(exhaustedState.turnOrder?.starterPlayerId).toBe('player-2');
  });

  it('GO_TO_BOARD from the first question of a multi-question topic immediately returns to topics board', () => {
    const state = setupActiveGame();

    // Modify topic 0 to have 2 non-mystery questions
    const multiQState: GameState = {
      ...state,
      topics: state.topics.map((t, idx) =>
        idx === 0
          ? {
              ...t,
              questions: [
                { ...t.questions[0], isMysteryQuestion: false },
                { ...t.questions[1], isMysteryQuestion: false },
              ],
            }
          : t,
      ),
    };

    // Select topic 0, question 0
    let qState = gameReducer(multiQState, {
      type: 'SELECT_TOPIC',
      payload: { topicId: multiQState.topics[0].id, questionIndex: 0 },
    });
    expect(qState.phase).toBe('question');
    expect(qState.currentQuestion?.questionIndex).toBe(0);

    // Player 1 scores on question 0
    qState = gameReducer(qState, { type: 'MARK_CORRECT' });
    expect(qState.players[0].score).toBe(1);

    // Clicking Board dispatches GO_TO_BOARD -> goes directly to topics board (NOT question 1)
    const boardState = gameReducer(qState, { type: 'GO_TO_BOARD' });
    expect(boardState.phase).toBe('topics');
    expect(boardState.currentQuestion).toBeNull();
    expect(boardState.topics[0].taken).toBe(true);
    expect(boardState.topics[0].takenBy).toBe('player-1');
    expect(boardState.turnOrder?.starterPlayerId).toBe('player-2');
  });

  it('RESET_TOPIC deducts points earned during that topic from players and untakes topic', () => {
    const state = setupActiveGame();

    // Select topic 0, question 0
    let qState = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });

    // Player 1 scores 1 point
    qState = gameReducer(qState, { type: 'MARK_CORRECT' });
    expect(qState.players[0].score).toBe(1);
    expect(qState.scoreEvents).toHaveLength(1);
    expect(qState.scoreEvents[0].topicId).toBe(state.topics[0].id);

    // Reset topic 0
    const resetState = gameReducer(qState, {
      type: 'RESET_TOPIC',
      payload: { topicId: state.topics[0].id },
    });

    // Player 1 score should be reverted to 0
    expect(resetState.players[0].score).toBe(0);
    // Score events for topic 0 should be removed
    expect(resetState.scoreEvents).toHaveLength(0);
    // Topic should be untaken
    expect(resetState.topics[0].taken).toBe(false);
    expect(resetState.topics[0].takenBy).toBeNull();
    // Phase should return to topics and currentQuestion cleared
    expect(resetState.phase).toBe('topics');
    expect(resetState.currentQuestion).toBeNull();
  });

  it('Mystery Bag flow: allows selection when all topics are taken, reuses scoring and reset mechanics', () => {
    const state = setupActiveGame();

    // Mark all 18 topics taken on the board
    const allTakenState: GameState = {
      ...state,
      topics: state.topics.map((t) => ({
        ...t,
        taken: true,
        takenBy: 'player-1',
      })),
    };

    // Verify exactly 3 mystery questions exist in the left bag
    expect(allTakenState.mysteryBags.left).toHaveLength(3);
    const mysteryEntry = allTakenState.mysteryBags.left[0];
    expect(mysteryEntry.taken).toBe(false);

    // Find the topic that owns this mystery question
    const mysteryTopic = allTakenState.topics.find(
      (t) => t.name === mysteryEntry.topicName,
    )!;
    const mysteryQIndex = mysteryTopic.questions.findIndex(
      (q) => q.isMysteryQuestion,
    );
    expect(mysteryQIndex).not.toBe(-1);

    // 1. Select the mystery bag question via standard SELECT_TOPIC
    let qState = gameReducer(allTakenState, {
      type: 'SELECT_TOPIC',
      payload: { topicId: mysteryTopic.id, questionIndex: mysteryQIndex },
    });

    expect(qState.phase).toBe('question');
    expect(qState.currentQuestion?.topicId).toBe(mysteryTopic.id);
    expect(qState.currentQuestion?.questionIndex).toBe(mysteryQIndex);
    expect(qState.currentQuestion?.whoseTurn).toBe('player-1');
    expect(qState.mysteryBags.left[0].taken).toBe(true);

    // 2. Score on the mystery question via standard MARK_CORRECT
    qState = gameReducer(qState, { type: 'MARK_CORRECT' });
    expect(qState.players[0].score).toBe(1);
    expect(qState.currentQuestion?.isComplete).toBe(true);
    expect(qState.currentQuestion?.revealed).toBe(false);

    // 3. NEXT_QUESTION advances through the remaining mystery questions in the bag, then returns to 'topics'
    const q2State = gameReducer(qState, { type: 'NEXT_QUESTION' });
    expect(q2State.phase).toBe('question');
    expect(q2State.currentQuestion?.mysteryBagId).toBe(
      allTakenState.mysteryBags.left[1].id,
    );
    expect(q2State.mysteryBags.left[1].taken).toBe(true);

    const q3State = gameReducer(q2State, { type: 'NEXT_QUESTION' });
    expect(q3State.phase).toBe('question');
    expect(q3State.currentQuestion?.mysteryBagId).toBe(
      allTakenState.mysteryBags.left[2].id,
    );
    expect(q3State.mysteryBags.left[2].taken).toBe(true);

    const backToTopics = gameReducer(q3State, { type: 'NEXT_QUESTION' });
    expect(backToTopics.phase).toBe('topics');
    expect(backToTopics.currentQuestion).toBeNull();
    // Mystery bag entries remain taken
    expect(backToTopics.mysteryBags.left[0].taken).toBe(true);
    expect(backToTopics.mysteryBags.left[1].taken).toBe(true);
    expect(backToTopics.mysteryBags.left[2].taken).toBe(true);

    // 4. RESET_TOPIC specifically on mystery question 1 deducts points and resets the bag entry
    const resetMystery = gameReducer(backToTopics, {
      type: 'RESET_TOPIC',
      payload: { topicId: mysteryTopic.id, questionIndex: mysteryQIndex },
    });
    expect(resetMystery.players[0].score).toBe(0);
    expect(resetMystery.mysteryBags.left[0].taken).toBe(false);
    expect(resetMystery.mysteryBags.left[1].taken).toBe(true);
    expect(resetMystery.mysteryBags.left[2].taken).toBe(true);
    // Main board topics remain taken so mystery bags remain unlocked
    expect(resetMystery.topics.every((t) => t.taken)).toBe(true);
  });

  it('END_GAME transitions to phase "result" and clears currentQuestion', () => {
    const state = setupActiveGame();
    const resultState = gameReducer(state, { type: 'END_GAME' });

    expect(resultState.phase).toBe('result');
    expect(resultState.currentQuestion).toBeNull();
    // Preserves players and scores
    expect(resultState.players).toHaveLength(3);
  });

  it('NEW_GAME resets state to initial setup phase', () => {
    const state = setupActiveGame();
    // Simulate game in progress with scores
    const withScore = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    const scored = gameReducer(withScore, { type: 'MARK_CORRECT' });
    expect(scored.players[0].score).toBe(1);

    // End game
    const ended = gameReducer(scored, { type: 'END_GAME' });
    expect(ended.phase).toBe('result');

    // New game
    const newGame = gameReducer(ended, { type: 'NEW_GAME' });
    expect(newGame.phase).toBe('setup');
    expect(newGame.players).toEqual([]);
    expect(newGame.topics).toEqual([]);
    expect(newGame.currentQuestion).toBeNull();
    expect(newGame.turnOrder).toBeNull();
    expect(newGame.scoreEvents).toEqual([]);
  });

  it('All 3 players tied throughout: turn-order engine resolves ties deterministically and rotates starters', () => {
    let state = setupActiveGame();

    // Round 1: Player 1 starts
    expect(state.turnOrder?.starterPlayerId).toBe('player-1');
    state = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(state.currentQuestion?.whoseTurn).toBe('player-1');

    // Player 1 passes -> Player 2 is up (tied at 0, next in seating order)
    state = gameReducer(state, { type: 'PASS' });
    expect(state.currentQuestion?.whoseTurn).toBe('player-2');

    // Player 2 passes -> Player 3 is up (tied at 0, next in seating order)
    state = gameReducer(state, { type: 'PASS' });
    expect(state.currentQuestion?.whoseTurn).toBe('player-3');

    // Player 3 passes -> all 3 attempted, question complete with 0 points
    state = gameReducer(state, { type: 'PASS' });
    expect(state.currentQuestion?.isComplete).toBe(true);
    expect(state.players.every((p) => p.score === 0)).toBe(true);

    // Advance to topics
    state = gameReducer(state, { type: 'NEXT_QUESTION' });
    expect(state.phase).toBe('topics');
    // Starter rotated to Player 2
    expect(state.turnOrder?.starterPlayerId).toBe('player-2');

    // Round 2: Player 2 starts topic 1
    state = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[1].id, questionIndex: 0 },
    });
    // With 0-0-0 tie, Player 2 gets first attempt!
    expect(state.currentQuestion?.whoseTurn).toBe('player-2');

    // Player 2 passes -> Player 3 is next in cyclic seating order
    state = gameReducer(state, { type: 'PASS' });
    expect(state.currentQuestion?.whoseTurn).toBe('player-3');

    // Player 3 passes -> Player 1 is next
    state = gameReducer(state, { type: 'PASS' });
    expect(state.currentQuestion?.whoseTurn).toBe('player-1');
  });

  it('UNDO reverts MARK_CORRECT and restores pre-action score and completion state', () => {
    const state = setupActiveGame();
    expect(state.history).toEqual([]);

    const selected = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(selected.players[0].score).toBe(0);
    expect(selected.currentQuestion?.isComplete).toBe(false);
    expect(selected.history.length).toBe(1);

    const scored = gameReducer(selected, { type: 'MARK_CORRECT' });
    expect(scored.players[0].score).toBe(1);
    expect(scored.currentQuestion?.isComplete).toBe(true);
    expect(scored.scoreEvents.length).toBe(1);
    expect(scored.history.length).toBe(2);

    const undone = gameReducer(scored, { type: 'UNDO' });
    expect(undone.players[0].score).toBe(0);
    expect(undone.currentQuestion?.isComplete).toBe(false);
    expect(undone.currentQuestion?.revealed).toBe(false);
    expect(undone.scoreEvents.length).toBe(0);
    expect(undone.history.length).toBe(1);
  });

  it('UNDO reverts MARK_WRONG and restores whoseTurn and attempted list', () => {
    const state = setupActiveGame();
    const selected = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(selected.currentQuestion?.whoseTurn).toBe('player-1');
    expect(selected.currentQuestion?.playersAttempted).toEqual([]);
    expect(selected.history.length).toBe(1);

    const wrong = gameReducer(selected, { type: 'MARK_WRONG' });
    expect(wrong.currentQuestion?.whoseTurn).toBe('player-2');
    expect(wrong.currentQuestion?.playersAttempted).toEqual(['player-1']);
    expect(wrong.history.length).toBe(2);

    const undone = gameReducer(wrong, { type: 'UNDO' });
    expect(undone.currentQuestion?.whoseTurn).toBe('player-1');
    expect(undone.currentQuestion?.playersAttempted).toEqual([]);
    expect(undone.history.length).toBe(1);
  });

  it('supports multiple undos in sequence across passes and walking back across questions', () => {
    const state = setupActiveGame();
    // 1. Select Topic 0 (Q0)
    const q1 = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(q1.history.length).toBe(1);

    // 2. Pass 1
    const pass1 = gameReducer(q1, { type: 'PASS' });
    expect(pass1.currentQuestion?.whoseTurn).toBe('player-2');
    expect(pass1.history.length).toBe(2);

    // 3. Mark Correct on player 2
    const correct1 = gameReducer(pass1, { type: 'MARK_CORRECT' });
    expect(correct1.players[1].score).toBe(1);
    expect(correct1.history.length).toBe(3);

    // 4. Reveal Answer
    const revealed1 = gameReducer(correct1, { type: 'REVEAL_ANSWER' });
    expect(revealed1.currentQuestion?.revealed).toBe(true);
    expect(revealed1.history.length).toBe(4);

    // 5. Next Question -> returns to topics board
    const boardState = gameReducer(revealed1, { type: 'NEXT_QUESTION' });
    expect(boardState.phase).toBe('topics');
    expect(boardState.topics[0].taken).toBe(true);
    expect(boardState.history.length).toBe(5);

    // 6. Select Topic 1 (Q0)
    const q2 = gameReducer(boardState, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[1].id, questionIndex: 0 },
    });
    expect(q2.phase).toBe('question');
    expect(q2.currentQuestion?.topicId).toBe(state.topics[1].id);
    expect(q2.history.length).toBe(6);

    // NOW WALK ALL THE WAY BACK USING UNDO:
    // Undo 1: steps back to topics board before Topic 1 was selected
    const u1 = gameReducer(q2, { type: 'UNDO' });
    expect(u1.phase).toBe('topics');
    expect(u1.topics[1].taken).toBe(false);
    expect(u1.history.length).toBe(5);

    // Undo 2: steps back into Topic 0's final completed question state
    const u2 = gameReducer(u1, { type: 'UNDO' });
    expect(u2.phase).toBe('question');
    expect(u2.currentQuestion?.topicId).toBe(state.topics[0].id);
    expect(u2.currentQuestion?.revealed).toBe(true);
    expect(u2.currentQuestion?.isComplete).toBe(true);
    expect(u2.players[1].score).toBe(1);
    expect(u2.history.length).toBe(4);

    // Undo 3: reverts REVEAL_ANSWER
    const u3 = gameReducer(u2, { type: 'UNDO' });
    expect(u3.currentQuestion?.revealed).toBe(false);
    expect(u3.currentQuestion?.isComplete).toBe(true);
    expect(u3.history.length).toBe(3);

    // Undo 4: reverts MARK_CORRECT (score reverts, isComplete reverts)
    const u4 = gameReducer(u3, { type: 'UNDO' });
    expect(u4.players[1].score).toBe(0);
    expect(u4.currentQuestion?.isComplete).toBe(false);
    expect(u4.history.length).toBe(2);

    // Undo 5: reverts PASS (turn back to player 1)
    const u5 = gameReducer(u4, { type: 'UNDO' });
    expect(u5.currentQuestion?.whoseTurn).toBe('player-1');
    expect(u5.currentQuestion?.playersAttempted).toEqual([]);
    expect(u5.history.length).toBe(1);

    // Undo 6: reverts SELECT_TOPIC (back to initial board before any topic picked)
    const u6 = gameReducer(u5, { type: 'UNDO' });
    expect(u6.phase).toBe('topics');
    expect(u6.topics[0].taken).toBe(false);
    expect(u6.history.length).toBe(0);

    // Undo 7: no-op when history is empty
    const u7 = gameReducer(u6, { type: 'UNDO' });
    expect(u7).toBe(u6);
  });

  it('clicking Correct, Wrong, or Pass does not set revealed = true; answer stays hidden until REVEAL_ANSWER', () => {
    const state = setupActiveGame();
    const selected = gameReducer(state, {
      type: 'SELECT_TOPIC',
      payload: { topicId: state.topics[0].id, questionIndex: 0 },
    });
    expect(selected.currentQuestion?.revealed).toBe(false);

    // Pass 1: still false
    const pass1 = gameReducer(selected, { type: 'PASS' });
    expect(pass1.currentQuestion?.revealed).toBe(false);

    // Wrong 2: still false
    const wrong2 = gameReducer(pass1, { type: 'MARK_WRONG' });
    expect(wrong2.currentQuestion?.revealed).toBe(false);

    // Undo back to direct attempt: still false
    const undo1 = gameReducer(wrong2, { type: 'UNDO' });
    const undo2 = gameReducer(undo1, { type: 'UNDO' });
    expect(undo2.currentQuestion?.revealed).toBe(false);

    // Mark correct: completes question, but revealed is STILL false
    const correct = gameReducer(undo2, { type: 'MARK_CORRECT' });
    expect(correct.currentQuestion?.isComplete).toBe(true);
    expect(correct.currentQuestion?.revealed).toBe(false);

    // Only REVEAL_ANSWER sets revealed to true
    const revealed = gameReducer(correct, { type: 'REVEAL_ANSWER' });
    expect(revealed.currentQuestion?.revealed).toBe(true);
  });

  it('selecting a mystery bag only marks that specific bag entry as taken, without marking or altering any other topic in the column', () => {
    const base = setupActiveGame();

    // Set up a game state where topics in the left column have varied states:
    // Topic 0: untaken
    // Topic 1: taken by player-2
    // Topic 2: untaken
    const testState: GameState = {
      ...base,
      turnOrder: {
        seatOrder: ['player-1', 'player-2', 'player-3'],
        pickIndex: 2, // player-3's turn
        starterPlayerId: 'player-3',
        direction: 'forward',
      },
      topics: base.topics.map((t, idx) => {
        if (idx === 1) {
          return { ...t, taken: true, takenBy: 'player-2' };
        }
        return { ...t, taken: false, takenBy: null };
      }),
      topicPhaseScore: {
        'player-1': 5,
        'player-2': 5,
        'player-3': 0,
      },
    };

    const mysteryEntry = testState.mysteryBags.left[0];
    const sourceTopic = testState.topics.find(
      (t) => t.name === mysteryEntry.topicName,
    )!;
    const mysteryQIdx = sourceTopic.questions.findIndex(
      (q) => q.isMysteryQuestion,
    );

    // Player 3 selects the mystery bag
    const qState = gameReducer(testState, {
      type: 'SELECT_TOPIC',
      payload: {
        topicId: sourceTopic.id,
        questionIndex: mysteryQIdx,
        mysteryBagId: mysteryEntry.id,
      },
    });

    // 1. The mystery bag entry itself is taken by player-3
    const updatedBag = qState.mysteryBags.left.find(
      (e) => e.id === mysteryEntry.id,
    );
    expect(updatedBag?.taken).toBe(true);
    expect(updatedBag?.takenBy).toBe('player-3');

    // Other mystery bags in the column are untouched
    expect(qState.mysteryBags.left.slice(1).every((e) => !e.taken)).toBe(true);

    // 2. Named topics in the column MUST NOT be altered!
    // Topic 0 is still untaken
    expect(qState.topics[0].taken).toBe(false);
    expect(qState.topics[0].takenBy).toBeNull();
    // Topic 1 is STILL taken by player-2 (not changed to player-3)
    expect(qState.topics[1].taken).toBe(true);
    expect(qState.topics[1].takenBy).toBe('player-2');
    // Source topic (if it wasn't topic 1) is still untaken
    const updatedSource = qState.topics.find((t) => t.id === sourceTopic.id)!;
    if (sourceTopic.id !== qState.topics[1].id) {
      expect(updatedSource.taken).toBe(false);
      expect(updatedSource.takenBy).toBeNull();
    }

    // 3. Mark correct & return to board
    const scored = gameReducer(qState, { type: 'MARK_CORRECT' });
    const finished = gameReducer(scored, { type: 'GO_TO_BOARD' });

    expect(finished.phase).toBe('topics');
    // Bag remains taken by player-3
    const finalBag = finished.mysteryBags.left.find(
      (e) => e.id === mysteryEntry.id,
    );
    expect(finalBag?.taken).toBe(true);
    expect(finalBag?.takenBy).toBe('player-3');

    // Topics in column still maintain their own states!
    expect(finished.topics[0].taken).toBe(false);
    expect(finished.topics[0].takenBy).toBeNull();
    expect(finished.topics[1].taken).toBe(true);
    expect(finished.topics[1].takenBy).toBe('player-2');
  });

  // -------------------------------------------------------------------------
  // 12. Bonus Attempts (BA) Tracking & Pass Priority
  // -------------------------------------------------------------------------

  describe('Bonus Attempts (BA) tracking and BA-based pass priority', () => {
    it('initializes all players with bonusAttempts: 0 on SET_PLAYERS and START_GAME', () => {
      const state = setupActiveGame();
      expect(state.players.every((p) => p.bonusAttempts === 0)).toBe(true);
    });

    it('direct player MARK_CORRECT does NOT increment BA', () => {
      let state = setupActiveGame();
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });
      // Player 1 is direct player
      expect(state.currentQuestion?.whoseTurn).toBe('player-1');
      expect(state.currentQuestion?.directPlayer).toBe('player-1');

      state = gameReducer(state, { type: 'MARK_CORRECT' });
      const p1 = state.players.find((p) => p.id === 'player-1')!;
      expect(p1.score).toBe(1);
      expect(p1.bonusAttempts).toBe(0);
    });

    it('direct player MARK_WRONG does NOT increment BA', () => {
      let state = setupActiveGame();
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });
      // Player 1 is direct player
      state = gameReducer(state, { type: 'MARK_WRONG' });
      const p1 = state.players.find((p) => p.id === 'player-1')!;
      expect(p1.bonusAttempts).toBe(0);
    });

    it('PASS never increments BA for anyone', () => {
      let state = setupActiveGame();
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });
      // Direct player passes
      state = gameReducer(state, { type: 'PASS' });
      expect(state.players.every((p) => p.bonusAttempts === 0)).toBe(true);

      // Passed player passes
      state = gameReducer(state, { type: 'PASS' });
      expect(state.players.every((p) => p.bonusAttempts === 0)).toBe(true);
    });

    it('passed player MARK_CORRECT increments BA by 1', () => {
      let state = setupActiveGame();
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });
      // Player 1 passes -> question passes to Player 2
      state = gameReducer(state, { type: 'PASS' });
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');

      // Player 2 answers correctly
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      const p1 = state.players.find((p) => p.id === 'player-1')!;
      const p2 = state.players.find((p) => p.id === 'player-2')!;
      expect(p1.bonusAttempts).toBe(0);
      expect(p2.score).toBe(1);
      expect(p2.bonusAttempts).toBe(1);
    });

    it('passed player MARK_WRONG increments BA by 1', () => {
      let state = setupActiveGame();
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });
      // Player 1 is wrong -> passes to Player 2
      state = gameReducer(state, { type: 'MARK_WRONG' });
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');

      // Player 2 is wrong on bonus attempt
      state = gameReducer(state, { type: 'MARK_WRONG' });
      const p2 = state.players.find((p) => p.id === 'player-2')!;
      expect(p2.bonusAttempts).toBe(1);

      // Passes to Player 3
      expect(state.currentQuestion?.whoseTurn).toBe('player-3');
      // Player 3 is wrong on bonus attempt (exhausting question)
      state = gameReducer(state, { type: 'MARK_WRONG' });
      const p3 = state.players.find((p) => p.id === 'player-3')!;
      expect(p3.bonusAttempts).toBe(1);
      expect(state.currentQuestion?.isComplete).toBe(true);
    });

    it('selects the player with lowest BA when passing', () => {
      let state = setupActiveGame();
      // Suppose Player 2 already has 1 BA, and Player 3 has 0 BA
      state = {
        ...state,
        players: [
          { id: 'player-1', name: 'Alice', score: 0, bonusAttempts: 0 },
          { id: 'player-2', name: 'Bob', score: 5, bonusAttempts: 1 },
          { id: 'player-3', name: 'Charlie', score: 10, bonusAttempts: 0 },
        ],
      };

      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });
      // Direct player = player-1, direction = forward -> pass order is [player-2, player-3]
      expect(state.currentQuestion?.passOrder).toEqual([
        'player-2',
        'player-3',
      ]);

      // Player 1 passes -> among [player-2 (BA=1), player-3 (BA=0)], player-3 has lower BA!
      state = gameReducer(state, { type: 'PASS' });
      expect(state.currentQuestion?.whoseTurn).toBe('player-3');
    });

    it('breaks BA ties using passOrder direction order', () => {
      let state = setupActiveGame();
      // Both Player 2 and Player 3 have 0 BA
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });
      // Pass order: [player-2, player-3]
      state = gameReducer(state, { type: 'PASS' });
      // Tied at 0 BA -> first in passOrder is player-2
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');
    });

    it('UNDO reverts BA increments on MARK_CORRECT and MARK_WRONG', () => {
      let state = setupActiveGame();
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });

      // Pass to Player 2
      state = gameReducer(state, { type: 'PASS' });
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');

      // Player 2 marked correct -> BA becomes 1
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      expect(
        state.players.find((p) => p.id === 'player-2')?.bonusAttempts,
      ).toBe(1);

      // Undo -> BA reverts to 0
      state = gameReducer(state, { type: 'UNDO' });
      expect(
        state.players.find((p) => p.id === 'player-2')?.bonusAttempts,
      ).toBe(0);
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');

      // Player 2 marked wrong -> BA becomes 1
      state = gameReducer(state, { type: 'MARK_WRONG' });
      expect(
        state.players.find((p) => p.id === 'player-2')?.bonusAttempts,
      ).toBe(1);

      // Undo -> BA reverts to 0
      state = gameReducer(state, { type: 'UNDO' });
      expect(
        state.players.find((p) => p.id === 'player-2')?.bonusAttempts,
      ).toBe(0);
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');
    });

    it('RESET_TOPIC preserves bonusAttempts (stat tracked for whole quiz)', () => {
      let state = setupActiveGame();
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: state.topics[0].id, questionIndex: 0 },
      });

      // Player 1 passes, Player 2 marks correct
      state = gameReducer(state, { type: 'PASS' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      expect(state.players.find((p) => p.id === 'player-2')?.score).toBe(1);
      expect(
        state.players.find((p) => p.id === 'player-2')?.bonusAttempts,
      ).toBe(1);

      // Next question to return to board
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      expect(state.phase).toBe('topics');

      // Reset topic 0: score is deducted, but BA is preserved
      state = gameReducer(state, {
        type: 'RESET_TOPIC',
        payload: { topicId: state.topics[0].id },
      });
      const p2 = state.players.find((p) => p.id === 'player-2')!;
      expect(p2.score).toBe(0);
      expect(p2.bonusAttempts).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Mystery bag phase & topicPhaseScore
  // -------------------------------------------------------------------------

  describe('Mystery bag phase & topicPhaseScore', () => {
    it('captures topicPhaseScore snapshot the moment the 18th topic completes', () => {
      const base = setupActiveGame();

      // Mark the first 17 topics as completed, with topic 17 untaken
      let state: GameState = {
        ...base,
        topics: base.topics.map((t, idx) => ({
          ...t,
          taken: idx < 17,
          takenBy: idx < 17 ? 'player-1' : null,
        })),
        players: [
          { id: 'player-1', name: 'Alice', score: 6, bonusAttempts: 1 },
          { id: 'player-2', name: 'Bob', score: 4, bonusAttempts: 2 },
          { id: 'player-3', name: 'Charlie', score: 2, bonusAttempts: 0 },
        ],
        topicPhaseScore: null,
      };

      expect(state.topicPhaseScore).toBeNull();

      // Play the 18th topic (topic 17)
      const finalTopic = state.topics[17];
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: { topicId: finalTopic.id, questionIndex: 0 },
      });

      // Direct player (player-1) marks Q1 correct
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      // Next question advances to Q2 of the topic
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      expect(state.phase).toBe('question');
      expect(state.currentQuestion?.questionIndex).toBe(1);

      // Direct player marks Q2 correct
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      expect(state.players.find((p) => p.id === 'player-1')?.score).toBe(8);
      // Still in question phase, snapshot is captured upon NEXT_QUESTION completing the topic
      expect(state.topicPhaseScore).toBeNull();

      // Complete 18th topic
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      expect(state.phase).toBe('topics');
      expect(state.topics.every((t) => t.taken)).toBe(true);

      // Snapshot is captured at that instant!
      expect(state.topicPhaseScore).toEqual({
        'player-1': 8,
        'player-2': 4,
        'player-3': 2,
      });

      // Turn order for 1st mystery pick goes to lowest topicPhaseScore (Charlie: 2)
      expect(state.turnOrder?.starterPlayerId).toBe('player-3');
      expect(state.turnOrder?.direction).toBe('forward');
    });

    it('points earned during mystery bag play do NOT alter topicPhaseScore', () => {
      const base = setupActiveGame();

      // All 18 topics completed, with snapshot captured
      let state: GameState = {
        ...base,
        topics: base.topics.map((t) => ({
          ...t,
          taken: true,
          takenBy: 'player-1',
        })),
        players: [
          { id: 'player-1', name: 'Alice', score: 5, bonusAttempts: 0 },
          { id: 'player-2', name: 'Bob', score: 3, bonusAttempts: 0 },
          { id: 'player-3', name: 'Charlie', score: 1, bonusAttempts: 0 },
        ],
        topicPhaseScore: {
          'player-1': 5,
          'player-2': 3,
          'player-3': 1,
        },
        turnOrder: {
          seatOrder: ['player-1', 'player-2', 'player-3'],
          pickIndex: 18,
          starterPlayerId: 'player-3', // Charlie has lowest score (1)
          direction: 'forward',
        },
      };

      const mysteryEntry = state.mysteryBags.left[0];
      const sourceTopic = state.topics.find(
        (t) => t.name === mysteryEntry.topicName,
      )!;
      const mysteryQIdx = sourceTopic.questions.findIndex(
        (q) => q.isMysteryQuestion,
      );

      // Charlie selects Left Mystery Bag
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: {
          topicId: sourceTopic.id,
          questionIndex: mysteryQIdx,
          mysteryBagId: mysteryEntry.id,
        },
      });

      expect(state.currentQuestion?.directPlayer).toBe('player-3');
      expect(state.currentQuestion?.whoseTurn).toBe('player-3');
      expect(state.currentQuestion?.direction).toBe('forward');

      // Charlie answers correctly: score becomes 2
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      expect(state.players.find((p) => p.id === 'player-3')?.score).toBe(2);

      // topicPhaseScore MUST NOT change!
      expect(state.topicPhaseScore).toEqual({
        'player-1': 5,
        'player-2': 3,
        'player-3': 1,
      });

      // Complete mystery questions 1, 2, and 3 in this bag
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      expect(state.phase).toBe('topics');

      // topicPhaseScore is still strictly the original topic-only scores
      expect(state.topicPhaseScore).toEqual({
        'player-1': 5,
        'player-2': 3,
        'player-3': 1,
      });

      // 2nd mystery pick goes to 2nd ranked player: Bob (score 3)
      expect(state.turnOrder?.starterPlayerId).toBe('player-2');
      expect(state.turnOrder?.direction).toBe('forward');
    });

    it('ranks mystery picks by score -> BA -> seatOrder for a sequence of 3 turns', () => {
      const base = setupActiveGame();

      // Alice & Bob have same topicPhaseScore (2), but Bob has lower BA (1 vs 3)
      // Charlie has higher topicPhaseScore (4)
      let state: GameState = {
        ...base,
        topics: base.topics.map((t) => ({
          ...t,
          taken: true,
          takenBy: 'player-1',
        })),
        players: [
          { id: 'player-1', name: 'Alice', score: 2, bonusAttempts: 3 },
          { id: 'player-2', name: 'Bob', score: 2, bonusAttempts: 1 },
          { id: 'player-3', name: 'Charlie', score: 4, bonusAttempts: 0 },
        ],
        topicPhaseScore: {
          'player-1': 2,
          'player-2': 2,
          'player-3': 4,
        },
        turnOrder: {
          seatOrder: ['player-1', 'player-2', 'player-3'],
          pickIndex: 18,
          starterPlayerId: 'player-2', // Bob picks 1st (tied score 2, lower BA)
          direction: 'forward',
        },
      };

      // Turn 1: Bob (player-2) selects Center Mystery Bag
      const bag1 = state.mysteryBags.center[0];
      const topic1 = state.topics.find((t) => t.name === bag1.topicName)!;
      const q1Idx = topic1.questions.findIndex((q) => q.isMysteryQuestion);

      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: {
          topicId: topic1.id,
          questionIndex: q1Idx,
          mysteryBagId: bag1.id,
        },
      });
      expect(state.currentQuestion?.directPlayer).toBe('player-2');
      // Bob plays all 3 questions of Center Mystery Bag
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });

      // Turn 2: Alice (player-1) picks 2nd (score 2, higher BA than Bob, lower score than Charlie)
      expect(state.turnOrder?.starterPlayerId).toBe('player-1');

      const bag2 = state.mysteryBags.left[0];
      const topic2 = state.topics.find((t) => t.name === bag2.topicName)!;
      const q2Idx = topic2.questions.findIndex((q) => q.isMysteryQuestion);

      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: {
          topicId: topic2.id,
          questionIndex: q2Idx,
          mysteryBagId: bag2.id,
        },
      });
      expect(state.currentQuestion?.directPlayer).toBe('player-1');
      // Alice plays all 3 questions of Left Mystery Bag
      state = gameReducer(state, { type: 'MARK_WRONG' });
      state = gameReducer(state, { type: 'PASS' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });

      // Turn 3: Charlie (player-3) picks 3rd (highest score 4)
      expect(state.turnOrder?.starterPlayerId).toBe('player-3');

      const bag3 = state.mysteryBags.right[0];
      const topic3 = state.topics.find((t) => t.name === bag3.topicName)!;
      const q3Idx = topic3.questions.findIndex((q) => q.isMysteryQuestion);

      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: {
          topicId: topic3.id,
          questionIndex: q3Idx,
          mysteryBagId: bag3.id,
        },
      });
      expect(state.currentQuestion?.directPlayer).toBe('player-3');
      // Charlie plays all 3 questions of Right Mystery Bag
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      state = gameReducer(state, { type: 'NEXT_QUESTION' });

      // All 3 bags have now been chosen and all 9 mystery questions taken
      const takenBags = Object.values(state.mysteryBags)
        .flat()
        .filter((e) => e.taken);
      expect(takenBags).toHaveLength(9);
    });

    it('treats mystery-bag passes as forward direction based on initial seatOrder', () => {
      const base = setupActiveGame();
      const seatOrder = ['player-1', 'player-2', 'player-3'];

      let state: GameState = {
        ...base,
        topics: base.topics.map((t) => ({
          ...t,
          taken: true,
          takenBy: 'player-1',
        })),
        players: [
          { id: 'player-1', name: 'Alice', score: 5, bonusAttempts: 2 },
          { id: 'player-2', name: 'Bob', score: 1, bonusAttempts: 4 },
          { id: 'player-3', name: 'Charlie', score: 3, bonusAttempts: 1 },
        ],
        topicPhaseScore: {
          'player-1': 5,
          'player-2': 1,
          'player-3': 3,
        },
        turnOrder: {
          seatOrder,
          pickIndex: 18,
          starterPlayerId: 'player-2',
          direction: 'forward',
        },
      };

      // Bob picks Left Mystery Bag
      const bag = state.mysteryBags.left[0];
      const topic = state.topics.find((t) => t.name === bag.topicName)!;
      const qIdx = topic.questions.findIndex((q) => q.isMysteryQuestion);

      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: {
          topicId: topic.id,
          questionIndex: qIdx,
          mysteryBagId: bag.id,
        },
      });

      // Direction must be forward
      expect(state.currentQuestion?.direction).toBe('forward');
      // Pass order from player-2 forward: player-3, then player-1
      expect(state.currentQuestion?.passOrder).toEqual([
        'player-3',
        'player-1',
      ]);

      // Bob marks wrong: question passes to player with lowest BA between Charlie (1) and Alice (2)
      // Charlie has BA 1 < Alice's 2, so it passes to Charlie (player-3)
      state = gameReducer(state, { type: 'MARK_WRONG' });
      expect(state.currentQuestion?.whoseTurn).toBe('player-3');
    });

    it('RESET_TOPIC on a named topic after snapshot deducts points from topicPhaseScore as well as score', () => {
      const base = setupActiveGame();

      let state: GameState = {
        ...base,
        topics: base.topics.map((t) => ({
          ...t,
          taken: true,
          takenBy: 'player-1',
        })),
        players: [
          { id: 'player-1', name: 'Alice', score: 5, bonusAttempts: 0 },
          { id: 'player-2', name: 'Bob', score: 3, bonusAttempts: 0 },
          { id: 'player-3', name: 'Charlie', score: 2, bonusAttempts: 0 },
        ],
        topicPhaseScore: {
          'player-1': 5,
          'player-2': 3,
          'player-3': 2,
        },
        scoreEvents: [
          {
            playerId: 'player-1',
            topicId: base.topics[0].id,
            questionIndex: 0,
            points: 1,
          },
        ],
      };

      // Reset topic 0: Alice scored 1 point on topic 0
      state = gameReducer(state, {
        type: 'RESET_TOPIC',
        payload: { topicId: base.topics[0].id },
      });

      // Both score and topicPhaseScore have 1 point deducted for Alice
      expect(state.players.find((p) => p.id === 'player-1')?.score).toBe(4);
      expect(state.topicPhaseScore?.['player-1']).toBe(4);
      // Other players unaffected
      expect(state.topicPhaseScore?.['player-2']).toBe(3);
      expect(state.topicPhaseScore?.['player-3']).toBe(2);
    });

    it('RESET_TOPIC on a mystery bag deducts from score but does NOT touch topicPhaseScore', () => {
      const base = setupActiveGame();

      let state: GameState = {
        ...base,
        topics: base.topics.map((t) => ({
          ...t,
          taken: true,
          takenBy: 'player-1',
        })),
        players: [
          { id: 'player-1', name: 'Alice', score: 5, bonusAttempts: 0 },
          { id: 'player-2', name: 'Bob', score: 3, bonusAttempts: 0 },
          { id: 'player-3', name: 'Charlie', score: 3, bonusAttempts: 0 }, // scored 1 on mystery bag (was 2)
        ],
        topicPhaseScore: {
          'player-1': 5,
          'player-2': 3,
          'player-3': 2, // snapshot was 2!
        },
        scoreEvents: [
          {
            playerId: 'player-3',
            topicId: base.topics[0].id,
            questionIndex: 1,
            points: 1,
          },
        ],
        mysteryBags: {
          ...base.mysteryBags,
          left: base.mysteryBags.left.map((e, idx) =>
            idx === 0 ? { ...e, taken: true, takenBy: 'player-3' } : e,
          ),
        },
      };

      const mysteryBagEntry = state.mysteryBags.left[0];

      // Reset mystery bag entry
      state = gameReducer(state, {
        type: 'RESET_TOPIC',
        payload: {
          topicId: base.topics[0].id,
          questionIndex: 1,
          mysteryBagId: mysteryBagEntry.id,
        },
      });

      // Charlie's score is deducted from 3 to 2
      expect(state.players.find((p) => p.id === 'player-3')?.score).toBe(2);
      // topicPhaseScore is UNTOUCHED!
      expect(state.topicPhaseScore).toEqual({
        'player-1': 5,
        'player-2': 3,
        'player-3': 2,
      });
      // Mystery bag is untaken again
      expect(state.mysteryBags.left[0].taken).toBe(false);
      // Charlie (lowest score 2) is restored as starterPlayerId for mystery pick
      expect(state.turnOrder?.starterPlayerId).toBe('player-3');
    });

    it('sequences through all 3 mystery questions per column in mystery bags, maintaining directPlayer throughout', () => {
      const base = setupActiveGame();
      const seatOrder = ['player-1', 'player-2', 'player-3'];

      let state: GameState = {
        ...base,
        topics: base.topics.map((t) => ({
          ...t,
          taken: true,
          takenBy: 'player-1',
        })),
        players: [
          { id: 'player-1', name: 'Alice', score: 10, bonusAttempts: 0 },
          { id: 'player-2', name: 'Bob', score: 2, bonusAttempts: 0 },
          { id: 'player-3', name: 'Charlie', score: 6, bonusAttempts: 0 },
        ],
        topicPhaseScore: {
          'player-1': 10,
          'player-2': 2,
          'player-3': 6,
        },
        turnOrder: {
          seatOrder,
          pickIndex: 18,
          starterPlayerId: 'player-2', // Bob picks 1st (lowest score 2)
          direction: 'forward',
        },
      };

      // Verify each column's bag has 3 distinct entries
      expect(state.mysteryBags.left).toHaveLength(3);
      expect(state.mysteryBags.center).toHaveLength(3);
      expect(state.mysteryBags.right).toHaveLength(3);

      const centerEntries = state.mysteryBags.center;
      const topic1 = state.topics.find((t) => t.name === centerEntries[0].topicName)!;
      const topic2 = state.topics.find((t) => t.name === centerEntries[1].topicName)!;
      const topic3 = state.topics.find((t) => t.name === centerEntries[2].topicName)!;

      // Bob selects Center Mystery Bag (Question 1)
      const q1Idx = topic1.questions.findIndex((q) => q.isMysteryQuestion);
      state = gameReducer(state, {
        type: 'SELECT_TOPIC',
        payload: {
          topicId: topic1.id,
          questionIndex: q1Idx,
          mysteryBagId: centerEntries[0].id,
        },
      });

      expect(state.phase).toBe('question');
      expect(state.currentQuestion?.topicId).toBe(topic1.id);
      expect(state.currentQuestion?.mysteryBagId).toBe(centerEntries[0].id);
      expect(state.currentQuestion?.directPlayer).toBe('player-2');
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');
      expect(state.mysteryBags.center[0].taken).toBe(true);
      expect(state.mysteryBags.center[1].taken).toBe(false);
      expect(state.mysteryBags.center[2].taken).toBe(false);

      // Question 1 answered correctly
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      expect(state.currentQuestion?.isComplete).toBe(true);

      // Advance to Question 2 of Center Mystery Bag
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      expect(state.phase).toBe('question');
      expect(state.currentQuestion?.topicId).toBe(topic2.id);
      expect(state.currentQuestion?.mysteryBagId).toBe(centerEntries[1].id);
      expect(state.currentQuestion?.directPlayer).toBe('player-2'); // same picker
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');
      expect(state.mysteryBags.center[1].taken).toBe(true);
      expect(state.mysteryBags.center[2].taken).toBe(false);

      // Question 2 answered correctly
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      expect(state.currentQuestion?.isComplete).toBe(true);

      // Advance to Question 3 of Center Mystery Bag
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      expect(state.phase).toBe('question');
      expect(state.currentQuestion?.topicId).toBe(topic3.id);
      expect(state.currentQuestion?.mysteryBagId).toBe(centerEntries[2].id);
      expect(state.currentQuestion?.directPlayer).toBe('player-2'); // same picker
      expect(state.currentQuestion?.whoseTurn).toBe('player-2');
      expect(state.mysteryBags.center[2].taken).toBe(true);

      // Question 3 answered correctly
      state = gameReducer(state, { type: 'MARK_CORRECT' });
      expect(state.currentQuestion?.isComplete).toBe(true);

      // Advance from Question 3: all 3 questions exhausted, completes Center Mystery Bag!
      state = gameReducer(state, { type: 'NEXT_QUESTION' });
      expect(state.phase).toBe('topics');
      expect(state.currentQuestion).toBeNull();
      expect(state.mysteryBags.center.every((e) => e.taken)).toBe(true);

      // Next mystery pick turn order automatically advances to 2nd-ranked: Charlie (score 6)
      expect(state.turnOrder?.starterPlayerId).toBe('player-3');
    });
  });
});
