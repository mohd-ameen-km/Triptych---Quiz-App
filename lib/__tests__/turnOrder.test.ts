import { describe, expect, it } from 'vitest';
import {
  getTopicPicker,
  getPickDirection,
  getPassOrder,
  getNextPlayer,
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
  //    (covering score-tie, non-tie, and attempted cases)
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
        it('non-tie: first player has lower score -> picks first', () => {
          const scores = { [first]: 2, [second]: 5 };
          expect(getNextPlayer(passOrder, [], scores)).toBe(first);
        });

        it('non-tie: second player has lower score -> picks second', () => {
          const scores = { [first]: 8, [second]: 3 };
          expect(getNextPlayer(passOrder, [], scores)).toBe(second);
        });

        it('score-tie: both have identical scores -> picks first in passOrder', () => {
          const scores = { [first]: 4, [second]: 4 };
          expect(getNextPlayer(passOrder, [], scores)).toBe(first);
        });

        it('score-tie at 0: both have 0 points -> picks first in passOrder', () => {
          const scores = { [first]: 0, [second]: 0 };
          expect(getNextPlayer(passOrder, [], scores)).toBe(first);
        });

        it('after first player has attempted -> picks second player regardless of score', () => {
          const scores = { [first]: 0, [second]: 10 };
          expect(getNextPlayer(passOrder, [first], scores)).toBe(second);
        });

        it('after both players have attempted -> returns null', () => {
          const scores = { [first]: 2, [second]: 5 };
          expect(getNextPlayer(passOrder, [first, second], scores)).toBeNull();
        });
      });
    });
  });
});
