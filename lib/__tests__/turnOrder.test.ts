import { describe, expect, it } from 'vitest';
import {
  getTopicPicker,
  getPickDirection,
  getPassOrder,
  getNextPlayer,
  getMysteryPickOrder,
} from '../turnOrder';

describe('turnOrder', () => {
  const TOM = 'Tom';
  const JIM = 'Jim';
  const CAM = 'Cam';
  const SEAT_ORDER = [TOM, JIM, CAM]; // [P1, P2, P3]

  // -------------------------------------------------------------------------
  // 1. Topic-pick order (6-cycle: P1, P2, P3, P3, P2, P1)
  // -------------------------------------------------------------------------

  describe('getTopicPicker', () => {
    it('follows the 6-cycle: P1, P2, P3, P3, P2, P1', () => {
      expect(getTopicPicker(0, SEAT_ORDER)).toBe(TOM); // P1
      expect(getTopicPicker(1, SEAT_ORDER)).toBe(JIM); // P2
      expect(getTopicPicker(2, SEAT_ORDER)).toBe(CAM); // P3
      expect(getTopicPicker(3, SEAT_ORDER)).toBe(CAM); // P3
      expect(getTopicPicker(4, SEAT_ORDER)).toBe(JIM); // P2
      expect(getTopicPicker(5, SEAT_ORDER)).toBe(TOM); // P1
    });

    it('repeats the 6-cycle for pickIndex >= 6', () => {
      expect(getTopicPicker(6, SEAT_ORDER)).toBe(TOM); // P1
      expect(getTopicPicker(7, SEAT_ORDER)).toBe(JIM); // P2
      expect(getTopicPicker(8, SEAT_ORDER)).toBe(CAM); // P3
      expect(getTopicPicker(9, SEAT_ORDER)).toBe(CAM); // P3
      expect(getTopicPicker(10, SEAT_ORDER)).toBe(JIM); // P2
      expect(getTopicPicker(11, SEAT_ORDER)).toBe(TOM); // P1
      expect(getTopicPicker(12, SEAT_ORDER)).toBe(TOM); // P1
      expect(getTopicPicker(17, SEAT_ORDER)).toBe(TOM); // P1
    });

    it('throws if seatOrder is empty', () => {
      expect(() => getTopicPicker(0, [])).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Round direction (0-2 forward, 3-5 reverse)
  // -------------------------------------------------------------------------

  describe('getPickDirection', () => {
    it('returns forward for positions 0, 1, 2', () => {
      expect(getPickDirection(0)).toBe('forward');
      expect(getPickDirection(1)).toBe('forward');
      expect(getPickDirection(2)).toBe('forward');
    });

    it('returns reverse for positions 3, 4, 5', () => {
      expect(getPickDirection(3)).toBe('reverse');
      expect(getPickDirection(4)).toBe('reverse');
      expect(getPickDirection(5)).toBe('reverse');
    });

    it('repeats forward for positions 6, 7, 8 and reverse for 9, 10, 11', () => {
      expect(getPickDirection(6)).toBe('forward');
      expect(getPickDirection(7)).toBe('forward');
      expect(getPickDirection(8)).toBe('forward');
      expect(getPickDirection(9)).toBe('reverse');
      expect(getPickDirection(10)).toBe('reverse');
      expect(getPickDirection(11)).toBe('reverse');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Pass order: all 3 direct players × 2 directions (6 cases)
  // -------------------------------------------------------------------------

  describe('getPassOrder (6 cases)', () => {
    // Forward direction: walks seatOrder circularly starting after direct
    it('Case 1: direct = Tom, forward -> [Jim, Cam]', () => {
      expect(getPassOrder(TOM, 'forward', SEAT_ORDER)).toEqual([JIM, CAM]);
    });

    it('Case 2: direct = Jim, forward -> [Cam, Tom]', () => {
      expect(getPassOrder(JIM, 'forward', SEAT_ORDER)).toEqual([CAM, TOM]);
    });

    it('Case 3: direct = Cam, forward -> [Tom, Jim]', () => {
      expect(getPassOrder(CAM, 'forward', SEAT_ORDER)).toEqual([TOM, JIM]);
    });

    // Reverse direction: walks seatOrder backwards circularly starting after direct
    it('Case 4: direct = Tom, reverse -> [Cam, Jim]', () => {
      expect(getPassOrder(TOM, 'reverse', SEAT_ORDER)).toEqual([CAM, JIM]);
    });

    it('Case 5: direct = Jim, reverse -> [Tom, Cam]', () => {
      expect(getPassOrder(JIM, 'reverse', SEAT_ORDER)).toEqual([TOM, CAM]);
    });

    it('Case 6: direct = Cam, reverse -> [Jim, Tom]', () => {
      expect(getPassOrder(CAM, 'reverse', SEAT_ORDER)).toEqual([JIM, TOM]);
    });

    it('throws when direct player is not found in seatOrder', () => {
      expect(() => getPassOrder('Unknown', 'forward', SEAT_ORDER)).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 4. getNextPlayer across each of the 6 pass-order sequences
  //    (covering BA-tie, non-tie, and attempted cases)
  // -------------------------------------------------------------------------

  describe('getNextPlayer across all 6 pass-order sequences', () => {
    const sequences = [
      { name: 'Forward, direct=Tom: [Jim, Cam]', passOrder: [JIM, CAM] },
      { name: 'Forward, direct=Jim: [Cam, Tom]', passOrder: [CAM, TOM] },
      { name: 'Forward, direct=Cam: [Tom, Jim]', passOrder: [TOM, JIM] },
      { name: 'Reverse, direct=Tom: [Cam, Jim]', passOrder: [CAM, JIM] },
      { name: 'Reverse, direct=Jim: [Tom, Cam]', passOrder: [TOM, CAM] },
      { name: 'Reverse, direct=Cam: [Jim, Tom]', passOrder: [JIM, TOM] },
    ];

    sequences.forEach(({ name, passOrder }) => {
      const [first, second] = passOrder;

      describe(name, () => {
        it('non-tie: first player has lower bonusAttempts -> picks first', () => {
          const bonusAttempts = { [first]: 1, [second]: 3 };
          expect(getNextPlayer(passOrder, [], bonusAttempts)).toBe(first);
        });

        it('non-tie: second player has lower bonusAttempts -> picks second', () => {
          const bonusAttempts = { [first]: 4, [second]: 2 };
          expect(getNextPlayer(passOrder, [], bonusAttempts)).toBe(second);
        });

        it('BA-tie: both have identical bonusAttempts -> picks first in passOrder', () => {
          const bonusAttempts = { [first]: 2, [second]: 2 };
          expect(getNextPlayer(passOrder, [], bonusAttempts)).toBe(first);
        });

        it('BA-tie at 0: both have 0 bonusAttempts -> picks first in passOrder', () => {
          const bonusAttempts = { [first]: 0, [second]: 0 };
          expect(getNextPlayer(passOrder, [], bonusAttempts)).toBe(first);
        });

        it('after first player has attempted -> picks second player regardless of BA', () => {
          const bonusAttempts = { [first]: 0, [second]: 10 };
          expect(getNextPlayer(passOrder, [first], bonusAttempts)).toBe(second);
        });

        it('after both players have attempted -> returns null', () => {
          const bonusAttempts = { [first]: 1, [second]: 2 };
          expect(
            getNextPlayer(passOrder, [first, second], bonusAttempts),
          ).toBeNull();
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Mystery pick order (score ascending -> BA ascending -> seat order)
  // -------------------------------------------------------------------------

  describe('getMysteryPickOrder', () => {
    it('ranks players by topicPhaseScore ascending (lowest score picks first)', () => {
      const players = [
        { id: TOM, bonusAttempts: 2 },
        { id: JIM, bonusAttempts: 1 },
        { id: CAM, bonusAttempts: 0 },
      ];
      const topicPhaseScore = {
        [TOM]: 5,
        [JIM]: 2,
        [CAM]: 8,
      };
      // Lowest score: Jim (2), then Tom (5), then Cam (8)
      expect(getMysteryPickOrder(players, SEAT_ORDER, topicPhaseScore)).toEqual(
        [JIM, TOM, CAM],
      );
    });

    it('breaks score ties by lowest bonusAttempts (BA ascending)', () => {
      const players = [
        { id: TOM, bonusAttempts: 4 },
        { id: JIM, bonusAttempts: 1 },
        { id: CAM, bonusAttempts: 2 },
      ];
      // All have the same score of 3
      const topicPhaseScore = {
        [TOM]: 3,
        [JIM]: 3,
        [CAM]: 3,
      };
      // Lowest BA: Jim (1), then Cam (2), then Tom (4)
      expect(getMysteryPickOrder(players, SEAT_ORDER, topicPhaseScore)).toEqual(
        [JIM, CAM, TOM],
      );
    });

    it('breaks score AND bonusAttempts ties using fixed initial seatOrder [P1, P2, P3]', () => {
      const players = [
        { id: CAM, bonusAttempts: 0 },
        { id: JIM, bonusAttempts: 0 },
        { id: TOM, bonusAttempts: 0 },
      ];
      // All scores 0, all BA 0
      const topicPhaseScore = {
        [TOM]: 0,
        [JIM]: 0,
        [CAM]: 0,
      };
      // Ties broken by seat order: Tom (P1), Jim (P2), Cam (P3)
      expect(getMysteryPickOrder(players, SEAT_ORDER, topicPhaseScore)).toEqual(
        [TOM, JIM, CAM],
      );
    });

    it('handles mixed conditions: 2 players tie on score but differ in BA, 1 player has distinct score', () => {
      const players = [
        { id: TOM, bonusAttempts: 3 }, // score 4, BA 3
        { id: JIM, bonusAttempts: 1 }, // score 4, BA 1
        { id: CAM, bonusAttempts: 5 }, // score 2, BA 5
      ];
      const topicPhaseScore = {
        [TOM]: 4,
        [JIM]: 4,
        [CAM]: 2,
      };
      // Lowest score first: Cam (2)
      // Then tie between Tom & Jim on score 4: Jim has lower BA (1 < 3), so Jim, then Tom
      expect(getMysteryPickOrder(players, SEAT_ORDER, topicPhaseScore)).toEqual(
        [CAM, JIM, TOM],
      );
    });
  });
});
