import { describe, it, expect } from 'vitest';
import { parseTsv } from '@/lib/tsv-parser';

// ---------------------------------------------------------------------------
// Helpers to build TSV strings
// ---------------------------------------------------------------------------

const HEADER = [
  'TopicName',
  'Column',
  'IsMysteryTopic',
  'QnNo',
  'IsMysteryQuestion',
  'QnText',
  'AnsText',
  'QnImg',
  'AnsImg',
  'QnVid',
  'AnsVid',
  'QnAud',
  'AnsAud',
].join('\t');

/** Shorthand to build a single TSV data row. */
function row(
  topicName: string,
  column: string,
  isMysteryTopic: string,
  qnNo: string,
  isMysteryQuestion: string,
  qnText: string,
  ansText: string,
  qnImg = '',
  ansImg = '',
  qnVid = '',
  ansVid = '',
  qnAud = '',
  ansAud = '',
): string {
  return [
    topicName,
    column,
    isMysteryTopic,
    qnNo,
    isMysteryQuestion,
    qnText,
    ansText,
    qnImg,
    ansImg,
    qnVid,
    ansVid,
    qnAud,
    ansAud,
  ].join('\t');
}

/**
 * Generate a fully valid 15-topic TSV. Per column (left/center/right):
 *   - 5 topics, numbered 1–5
 *   - Topics 1–3 are mystery topics, topics 4–5 are normal
 *   - Each topic has 2 questions: Q1 is non-mystery, Q2 is mystery for
 *     mystery topics and non-mystery for normal topics
 */
function validTsv(): string {
  const lines = [HEADER];
  for (const col of ['left', 'center', 'right'] as const) {
    for (let t = 1; t <= 5; t++) {
      const name = `${col}_topic_${t}`;
      const isMystery = t <= 3;
      // Q1: always a normal question
      lines.push(
        row(
          name,
          col,
          String(isMystery),
          '1',
          'false',
          `${name} Q1`,
          `${name} A1`,
        ),
      );
      // Q2: mystery question only if mystery topic, else normal
      lines.push(
        row(
          name,
          col,
          String(isMystery),
          '2',
          String(isMystery),
          `${name} Q2`,
          `${name} A2`,
        ),
      );
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseTsv', () => {
  // ── Valid case ──────────────────────────────────────────────────────

  it('parses a fully valid TSV with no errors', () => {
    const result = parseTsv(validTsv());

    expect(result.errors).toEqual([]);
    expect(result.topics).toHaveLength(15);

    // 5 topics per column
    for (const col of ['left', 'center', 'right'] as const) {
      expect(result.topics.filter((t) => t.column === col)).toHaveLength(5);
    }

    // 3 mystery topics per column
    for (const col of ['left', 'center', 'right'] as const) {
      expect(
        result.topics.filter((t) => t.column === col && t.isMysteryTopic),
      ).toHaveLength(3);
    }

    // Each topic has 2 questions
    for (const topic of result.topics) {
      expect(topic.questions).toHaveLength(2);
    }
  });

  it('populates the mystery bag correctly', () => {
    const result = parseTsv(validTsv());

    expect(result.errors).toEqual([]);
    // 3 mystery topics per column → 3 entries per column in the bag
    expect(result.mysteryBag.left).toHaveLength(3);
    expect(result.mysteryBag.center).toHaveLength(3);
    expect(result.mysteryBag.right).toHaveLength(3);

    // Every bag entry should reference a mystery question
    for (const entry of [
      ...result.mysteryBag.left,
      ...result.mysteryBag.center,
      ...result.mysteryBag.right,
    ]) {
      expect(entry.question.isMysteryQuestion).toBe(true);
    }
  });

  // ── Validation: not exactly 15 topics ──────────────────────────────

  it('errors when there are fewer than 15 topics', () => {
    // Build a TSV with only 14 topics (drop the last topic in "right")
    const lines = [HEADER];
    for (const col of ['left', 'center', 'right'] as const) {
      const topicCount = col === 'right' ? 4 : 5;
      for (let t = 1; t <= topicCount; t++) {
        const name = `${col}_t${t}`;
        const isMystery = t <= 3;
        lines.push(row(name, col, String(isMystery), '1', 'false', `Q`, `A`));
        lines.push(
          row(name, col, String(isMystery), '2', String(isMystery), `Q`, `A`),
        );
      }
    }

    const result = parseTsv(lines.join('\n'));

    expect(result.errors).toContain(
      'Expected exactly 15 topics, but found 14.',
    );
    expect(result.errors).toContain(
      'Expected exactly 5 topics in the "right" column, but found 4.',
    );
  });

  // ── Validation: wrong number of topics per column ──────────────────

  it('errors when topics are unevenly distributed across columns', () => {
    // 6 in left, 5 in center, 4 in right = 15 total, but wrong per-column
    const lines = [HEADER];
    // left: 6 topics
    for (let t = 1; t <= 6; t++) {
      const isMystery = t <= 3;
      lines.push(
        row(`L${t}`, 'left', String(isMystery), '1', 'false', 'Q', 'A'),
      );
      lines.push(
        row(
          `L${t}`,
          'left',
          String(isMystery),
          '2',
          String(isMystery),
          'Q',
          'A',
        ),
      );
    }
    // center: 5 topics
    for (let t = 1; t <= 5; t++) {
      const isMystery = t <= 3;
      lines.push(
        row(`C${t}`, 'center', String(isMystery), '1', 'false', 'Q', 'A'),
      );
      lines.push(
        row(
          `C${t}`,
          'center',
          String(isMystery),
          '2',
          String(isMystery),
          'Q',
          'A',
        ),
      );
    }
    // right: 4 topics
    for (let t = 1; t <= 4; t++) {
      const isMystery = t <= 3;
      lines.push(
        row(`R${t}`, 'right', String(isMystery), '1', 'false', 'Q', 'A'),
      );
      lines.push(
        row(
          `R${t}`,
          'right',
          String(isMystery),
          '2',
          String(isMystery),
          'Q',
          'A',
        ),
      );
    }

    const result = parseTsv(lines.join('\n'));

    // 15 topics total is correct, so no error about total count
    expect(
      result.errors.some((e) => e.includes('Expected exactly 15 topics')),
    ).toBe(false);
    expect(result.errors).toContain(
      'Expected exactly 5 topics in the "left" column, but found 6.',
    );
    expect(result.errors).toContain(
      'Expected exactly 5 topics in the "right" column, but found 4.',
    );
  });

  // ── Validation: wrong number of mystery topics per column ──────────

  it('errors when mystery topic count per column is not 3', () => {
    // Make all 5 left topics mystery, 3 center mystery, 3 right mystery
    const lines = [HEADER];
    // left: all 5 are mystery
    for (let t = 1; t <= 5; t++) {
      lines.push(row(`L${t}`, 'left', 'true', '1', 'false', 'Q', 'A'));
      lines.push(row(`L${t}`, 'left', 'true', '2', 'true', 'Q', 'A'));
    }
    // center: 3 mystery (correct)
    for (let t = 1; t <= 5; t++) {
      const isMystery = t <= 3;
      lines.push(
        row(`C${t}`, 'center', String(isMystery), '1', 'false', 'Q', 'A'),
      );
      lines.push(
        row(
          `C${t}`,
          'center',
          String(isMystery),
          '2',
          String(isMystery),
          'Q',
          'A',
        ),
      );
    }
    // right: 3 mystery (correct)
    for (let t = 1; t <= 5; t++) {
      const isMystery = t <= 3;
      lines.push(
        row(`R${t}`, 'right', String(isMystery), '1', 'false', 'Q', 'A'),
      );
      lines.push(
        row(
          `R${t}`,
          'right',
          String(isMystery),
          '2',
          String(isMystery),
          'Q',
          'A',
        ),
      );
    }

    const result = parseTsv(lines.join('\n'));

    expect(result.errors).toContain(
      'Expected exactly 3 mystery topics in the "left" column, but found 5.',
    );
  });

  // ── Validation: mystery topic with ≠ 1 mystery question ────────────

  it('errors when a mystery topic has zero mystery questions', () => {
    const lines = [HEADER];
    for (const col of ['left', 'center', 'right'] as const) {
      for (let t = 1; t <= 5; t++) {
        const name = `${col}_t${t}`;
        const isMystery = t <= 3;
        lines.push(row(name, col, String(isMystery), '1', 'false', 'Q', 'A'));
        // BUG: mystery topics get NO mystery questions (always false)
        lines.push(
          row(
            name,
            col,
            String(isMystery),
            '2',
            'false', // ← should be 'true' for mystery topics
            'Q',
            'A',
          ),
        );
      }
    }

    const result = parseTsv(lines.join('\n'));

    // Should have 9 errors (3 mystery topics × 3 columns)
    const mysteryQErrors = result.errors.filter((e) =>
      e.includes('must have exactly 1 mystery question'),
    );
    expect(mysteryQErrors).toHaveLength(9);
  });

  it('errors when a mystery topic has more than 1 mystery question', () => {
    const lines = [HEADER];
    for (const col of ['left', 'center', 'right'] as const) {
      for (let t = 1; t <= 5; t++) {
        const name = `${col}_t${t}`;
        const isMystery = t <= 3;
        // Q1 and Q2 both marked as mystery for mystery topics
        lines.push(
          row(name, col, String(isMystery), '1', String(isMystery), 'Q', 'A'),
        );
        lines.push(
          row(name, col, String(isMystery), '2', String(isMystery), 'Q', 'A'),
        );
      }
    }

    const result = parseTsv(lines.join('\n'));

    // Mystery topics now have 2 mystery questions → error
    const mysteryQErrors = result.errors.filter((e) =>
      e.includes('must have exactly 1 mystery question'),
    );
    expect(mysteryQErrors).toHaveLength(9);

    // Also: those mystery topics have NO non-mystery questions → additional error
    const nonMysteryErrors = result.errors.filter((e) =>
      e.includes('must have at least one non-mystery question'),
    );
    expect(nonMysteryErrors).toHaveLength(9);
  });

  // ── Validation: topic with no non-mystery questions ────────────────

  it('errors when a topic has only mystery questions', () => {
    // Build a valid base, then break one topic by making all its questions mystery
    const lines = [HEADER];
    for (const col of ['left', 'center', 'right'] as const) {
      for (let t = 1; t <= 5; t++) {
        const name = `${col}_t${t}`;
        const isMystery = t <= 3;

        if (col === 'left' && t === 1) {
          // This mystery topic: ALL questions are mystery → violates non-mystery rule
          lines.push(row(name, col, 'true', '1', 'true', 'Q', 'A'));
        } else {
          lines.push(row(name, col, String(isMystery), '1', 'false', 'Q', 'A'));
          lines.push(
            row(name, col, String(isMystery), '2', String(isMystery), 'Q', 'A'),
          );
        }
      }
    }

    const result = parseTsv(lines.join('\n'));

    expect(result.errors).toContain(
      'Topic "left_t1" must have at least one non-mystery question.',
    );
  });

  // ── Edge case: empty input ─────────────────────────────────────────

  it('returns an error for empty input', () => {
    const result = parseTsv('');

    expect(result.topics).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ── Row-level: invalid column value ────────────────────────────────

  it('errors on invalid column values', () => {
    const tsv = [
      HEADER,
      row('BadCol', 'top', 'false', '1', 'false', 'Q', 'A'),
    ].join('\n');

    const result = parseTsv(tsv);

    expect(result.errors).toContain(
      'Row 2: Column "top" is not one of left, center, right.',
    );
  });

  // ── Test Mode: 3 topics total (1 per column, all mystery) ─────────

  describe('3-topic test mode', () => {
    it('successfully parses a 3-topic TSV with 1 mystery topic per column', () => {
      const tsv = [
        HEADER,
        row('Left Mystery', 'left', 'true', '1', 'true', 'Left Q?', 'Left Ans'),
        row(
          'Center Mystery',
          'center',
          'true',
          '1',
          'true',
          'Center Q?',
          'Center Ans',
        ),
        row(
          'Right Mystery',
          'right',
          'true',
          '1',
          'true',
          'Right Q?',
          'Right Ans',
        ),
      ].join('\n');

      const result = parseTsv(tsv);

      expect(result.errors).toEqual([]);
      expect(result.topics).toHaveLength(3);
      expect(result.mysteryBag.left).toHaveLength(1);
      expect(result.mysteryBag.center).toHaveLength(1);
      expect(result.mysteryBag.right).toHaveLength(1);
      expect(result.mysteryBag.left[0].question.questionText).toBe('Left Q?');
    });

    it('errors when 3 topics are not distributed 1 per column', () => {
      const tsv = [
        HEADER,
        row('Left 1', 'left', 'true', '1', 'true', 'Q', 'A'),
        row('Left 2', 'left', 'true', '1', 'true', 'Q', 'A'),
        row('Center 1', 'center', 'true', '1', 'true', 'Q', 'A'),
      ].join('\n');

      const result = parseTsv(tsv);

      expect(result.errors).toContain(
        'Test mode expected 1 topic in the "left" column, but found 2.',
      );
      expect(result.errors).toContain(
        'Test mode expected 1 topic in the "right" column, but found 0.',
      );
    });

    it('errors when a mystery topic in 3-topic mode has no mystery question', () => {
      const tsv = [
        HEADER,
        row('Left Mystery', 'left', 'true', '1', 'false', 'Q', 'A'), // IsMysteryQuestion is false
        row('Center Mystery', 'center', 'true', '1', 'true', 'Q', 'A'),
        row('Right Mystery', 'right', 'true', '1', 'true', 'Q', 'A'),
      ].join('\n');

      const result = parseTsv(tsv);

      expect(result.errors).toContain(
        'Mystery topic "Left Mystery" must have at least 1 mystery question.',
      );
    });
  });
});
