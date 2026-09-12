/**
 * Turn-order and pass-order logic — pure functions, independent of React.
 *
 * Rules:
 *
 * 1. Topic-pick order:
 *    Given fixed seatOrder [P1, P2, P3], topic picks follow a repeating 6-cycle:
 *    P1, P2, P3, P3, P2, P1 (then repeats).
 *    Purely positional based on pickIndex % 6 — never affected by scores.
 *
 * 2. Round direction:
 *    Derived from position in 6-cycle:
 *    - Positions 0–2 (the P1, P2, P3 half) are 'forward'.
 *    - Positions 3–5 (the P3, P2, P1 half) are 'reverse'.
 *
 * 3. Direct question:
 *    The question always goes to directPlayer first, no exceptions.
 *
 * 4. Pass order:
 *    When directPlayer answers wrong or passes, build the tie-break sequence
 *    by walking seatOrder circularly starting immediately after directPlayer,
 *    in the same direction as the round:
 *    - 'forward' walks the seat order as-is (P1→P2→P3→P1...).
 *    - 'reverse' walks it backwards (P1→P3→P2→P1...).
 *
 * 5. Choosing who is actually next:
 *    Among players in passOrder not yet in attemptedPlayerIds, pick whoever
 *    has the lowest score; on a score tie, pick whichever comes first in passOrder.
 */

export type PlayerId = string;
export type PickDirection = 'forward' | 'reverse';

/**
 * 6-cycle mapping from pickIndex % 6 to seatOrder index:
 * index 0 -> P1 (idx 0)
 * index 1 -> P2 (idx 1)
 * index 2 -> P3 (idx 2)
 * index 3 -> P3 (idx 2)
 * index 4 -> P2 (idx 1)
 * index 5 -> P1 (idx 0)
 */
const CYCLE_SEAT_INDICES = [0, 1, 2, 2, 1, 0] as const;

/**
 * Get the player whose turn it is to pick a topic for the given pickIndex.
 *
 * @param pickIndex  0-based sequence index of topic picks in the game.
 * @param seatOrder  Fixed array of player ids in seating order [P1, P2, P3].
 * @returns          The PlayerId for this pick.
 */
export function getTopicPicker(
  pickIndex: number,
  seatOrder: PlayerId[],
): PlayerId {
  if (seatOrder.length === 0) {
    throw new Error('seatOrder must not be empty');
  }
  const normalized = ((pickIndex % 6) + 6) % 6;
  const seatIdx = CYCLE_SEAT_INDICES[normalized];
  return seatOrder[seatIdx % seatOrder.length];
}

/**
 * Get the round direction for the given pickIndex.
 *
 * Positions 0–2 (P1, P2, P3) are 'forward'.
 * Positions 3–5 (P3, P2, P1) are 'reverse'.
 *
 * @param pickIndex  0-based sequence index of topic picks in the game.
 * @returns          'forward' or 'reverse'.
 */
export function getPickDirection(pickIndex: number): PickDirection {
  const normalized = ((pickIndex % 6) + 6) % 6;
  return normalized < 3 ? 'forward' : 'reverse';
}

/**
 * Determine the pass order (tie-break sequence) for a question.
 *
 * Walks seatOrder circularly starting immediately after directPlayer,
 * in the specified direction ('forward' or 'reverse'), returning the
 * other players in that walked order.
 *
 * @param directPlayer  The player who originally received/picked the question.
 * @param direction     Round direction ('forward' or 'reverse').
 * @param seatOrder     Fixed array of player ids in seating order.
 * @returns             The remaining players in the circular walk order.
 */
export function getPassOrder(
  directPlayer: PlayerId,
  direction: PickDirection,
  seatOrder: PlayerId[],
): PlayerId[] {
  const directIdx = seatOrder.indexOf(directPlayer);
  if (directIdx === -1) {
    throw new Error(`directPlayer "${directPlayer}" not found in seatOrder`);
  }

  const n = seatOrder.length;
  const step = direction === 'forward' ? 1 : -1;
  const passOrder: PlayerId[] = [];

  for (let i = 1; i < n; i++) {
    const idx = (((directIdx + step * i) % n) + n) % n;
    passOrder.push(seatOrder[idx]);
  }

  return passOrder;
}

/**
 * Determine who answers next among the pass candidates.
 *
 * Among players in `passOrder` not yet in `attemptedPlayerIds`, picks whoever
 * has the lowest bonusAttempts. On a BA tie, picks whichever player comes first
 * in `passOrder`.
 *
 * @param passOrder           Ordered candidate player ids from `getPassOrder`.
 * @param attemptedPlayerIds  Player ids who have already attempted this question.
 * @param bonusAttempts       Current bonusAttempts mapped by player id.
 * @returns                   The next player id to attempt, or `null` if all have attempted.
 */
export function getNextPlayer(
  passOrder: PlayerId[],
  attemptedPlayerIds: PlayerId[],
  bonusAttempts: Record<PlayerId, number>,
): PlayerId | null {
  const attempted = new Set(attemptedPlayerIds);
  const remaining = passOrder.filter((id) => !attempted.has(id));

  if (remaining.length === 0) return null;

  let minPlayer = remaining[0];
  let minBA = bonusAttempts[minPlayer] ?? 0;

  for (let i = 1; i < remaining.length; i++) {
    const player = remaining[i];
    const ba = bonusAttempts[player] ?? 0;
    if (ba < minBA) {
      minBA = ba;
      minPlayer = player;
    }
  }

  return minPlayer;
}
