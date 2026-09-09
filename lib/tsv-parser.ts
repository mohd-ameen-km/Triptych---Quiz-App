/**
 * TSV parsing utilities powered by PapaParse.
 *
 * Parses quiz data from a TSV string and validates the structural
 * constraints required by the quiz board layout.
 */

import Papa from 'papaparse';
import type {
  Column,
  MysteryBag,
  MysteryBagEntry,
  ParseResult,
  Question,
  Topic,
} from '@/types';
import { COLUMNS } from '@/types';

// ---------------------------------------------------------------------------
// TSV column header names
// ---------------------------------------------------------------------------

type RawRow = Record<
  | 'TopicName'
  | 'Column'
  | 'IsMysteryTopic'
  | 'QnNo'
  | 'IsMysteryQuestion'
  | 'QnText'
  | 'AnsText'
  | 'QnImg'
  | 'AnsImg'
  | 'QnVid'
  | 'AnsVid'
  | 'QnAud'
  | 'AnsAud',
  string
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a boolean-ish TSV cell ("TRUE", "1", "yes" → true). */
function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/** Normalise a column cell value to a typed Column or null. */
function parseColumn(value: string | undefined): Column | null {
  if (!value) return null;
  const v = value.trim().toLowerCase() as Column;
  if (COLUMNS.includes(v)) return v;
  return null;
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

/**
 * Parse a TSV string into an array of validated `Topic` objects.
 *
 * This is a **pure** function — no side effects, no exceptions.
 * All problems are returned via the `errors` array.
 */
export function parseTsv(fileText: string): ParseResult {
  const errors: string[] = [];

  // ── 1. Run PapaParse ────────────────────────────────────────────────
  // Only strip leading/trailing newlines — NOT tabs, which PapaParse needs
  // to correctly count trailing empty fields on the last row.
  const parsed = Papa.parse<RawRow>(fileText.replace(/^\n+|\n+$/g, ''), {
    header: true,
    delimiter: '\t',
    skipEmptyLines: true,
  });

  // Surface real parse errors but suppress TooFewFields — we handle missing
  // optional media columns gracefully via `?? ''` defaults.
  for (const e of parsed.errors) {
    if (e.code === 'TooFewFields') continue;
    errors.push(`CSV parse error (row ${e.row}): ${e.message}`);
  }

  if (parsed.data.length === 0) {
    errors.push('TSV file contains no data rows.');
    return { topics: [], mysteryBag: emptyBag(), errors };
  }

  // ── 2. Group rows into topics ───────────────────────────────────────
  // Rows are grouped by TopicName. Order of first appearance is preserved.
  const topicMap = new Map<
    string,
    { column: Column | null; isMystery: boolean; questions: Question[] }
  >();

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowLabel = `Row ${i + 2}`; // +2 because header = row 1, data is 0-indexed

    const topicName = (row.TopicName ?? '').trim();
    if (!topicName) {
      errors.push(`${rowLabel}: TopicName is empty.`);
      continue;
    }

    const column = parseColumn(row.Column);
    if (!column) {
      errors.push(
        `${rowLabel}: Column "${row.Column}" is not one of left, center, right.`,
      );
      continue;
    }

    const isMysteryTopic = parseBool(row.IsMysteryTopic);
    const qnNo = parseInt(row.QnNo, 10);
    if (isNaN(qnNo) || qnNo < 1) {
      errors.push(
        `${rowLabel}: QnNo "${row.QnNo}" is not a valid positive integer.`,
      );
      continue;
    }

    const question: Question = {
      questionNumber: qnNo,
      isMysteryQuestion: parseBool(row.IsMysteryQuestion),
      questionText: (row.QnText ?? '').trim(),
      answerText: (row.AnsText ?? '').trim(),
      questionImage: (row.QnImg ?? '').trim(),
      answerImage: (row.AnsImg ?? '').trim(),
      questionVideo: (row.QnVid ?? '').trim(),
      answerVideo: (row.AnsVid ?? '').trim(),
      questionAudio: (row.QnAud ?? '').trim(),
      answerAudio: (row.AnsAud ?? '').trim(),
    };

    if (!question.questionText) {
      errors.push(
        `${rowLabel}: QnText is empty for topic "${topicName}" question ${qnNo}.`,
      );
    }
    if (!question.answerText) {
      errors.push(
        `${rowLabel}: AnsText is empty for topic "${topicName}" question ${qnNo}.`,
      );
    }

    // Merge into topic map
    const existing = topicMap.get(topicName);
    if (existing) {
      // Validate consistency within a topic
      if (existing.column !== column) {
        errors.push(
          `${rowLabel}: Topic "${topicName}" has conflicting columns: ` +
            `"${existing.column}" vs "${column}".`,
        );
      }
      if (existing.isMystery !== isMysteryTopic) {
        errors.push(
          `${rowLabel}: Topic "${topicName}" has conflicting IsMysteryTopic values.`,
        );
      }
      existing.questions.push(question);
    } else {
      topicMap.set(topicName, {
        column,
        isMystery: isMysteryTopic,
        questions: [question],
      });
    }
  }

  // ── 3. Build Topic objects ──────────────────────────────────────────
  const topics: Topic[] = [];
  topicMap.forEach((data, name) => {
    topics.push({
      name,
      column: data.column ?? 'left', // fallback; error already recorded
      isMysteryTopic: data.isMystery,
      questions: data.questions.sort(
        (a, b) => a.questionNumber - b.questionNumber,
      ),
    });
  });

  // ── 4. Structural validations ──────────────────────────────────────
  // Allow 3-topic test mode (1 topic per column, all mystery topics)
  // as well as standard 15-topic mode (5 per column, 3 mystery per column).
  const isTestMode = topics.length === 3;

  if (isTestMode) {
    // Test mode validations:
    // 4a. 1 topic per column
    for (const col of COLUMNS) {
      const count = topics.filter((t) => t.column === col).length;
      if (count !== 1) {
        errors.push(
          `Test mode expected 1 topic in the "${col}" column, but found ${count}.`,
        );
      }
    }

    // 4b. Ensure mystery topics have at least 1 mystery question
    for (const topic of topics) {
      if (topic.isMysteryTopic) {
        const mysteryQs = topic.questions.filter((q) => q.isMysteryQuestion);
        if (mysteryQs.length === 0) {
          errors.push(
            `Mystery topic "${topic.name}" must have at least 1 mystery question.`,
          );
        }
      }
    }
  } else {
    // Standard game validations:
    // 4a. Exactly 15 topics total
    if (topics.length !== 15) {
      errors.push(`Expected exactly 15 topics, but found ${topics.length}.`);
    }

    // 4b. 5 topics per column
    for (const col of COLUMNS) {
      const count = topics.filter((t) => t.column === col).length;
      if (count !== 5) {
        errors.push(
          `Expected exactly 5 topics in the "${col}" column, but found ${count}.`,
        );
      }
    }

    // 4c. Exactly 3 mystery topics per column
    for (const col of COLUMNS) {
      const mysteryCount = topics.filter(
        (t) => t.column === col && t.isMysteryTopic,
      ).length;
      if (mysteryCount !== 3) {
        errors.push(
          `Expected exactly 3 mystery topics in the "${col}" column, but found ${mysteryCount}.`,
        );
      }
    }

    // 4d. Exactly 1 mystery question per mystery topic
    for (const topic of topics) {
      if (!topic.isMysteryTopic) continue;
      const mysteryQs = topic.questions.filter((q) => q.isMysteryQuestion);
      if (mysteryQs.length !== 1) {
        errors.push(
          `Mystery topic "${topic.name}" must have exactly 1 mystery question, ` +
            `but has ${mysteryQs.length}.`,
        );
      }
    }

    // 4e. Every topic has at least one non-mystery question
    for (const topic of topics) {
      const nonMysteryQs = topic.questions.filter((q) => !q.isMysteryQuestion);
      if (nonMysteryQs.length === 0) {
        errors.push(
          `Topic "${topic.name}" must have at least one non-mystery question.`,
        );
      }
    }
  }

  // ── 5. Build the mystery bag ────────────────────────────────────────
  const mysteryBag = buildMysteryBag(topics);

  return { topics, mysteryBag, errors };
}

// ---------------------------------------------------------------------------
// Mystery-bag builder
// ---------------------------------------------------------------------------

function emptyBag(): MysteryBag {
  return { left: [], center: [], right: [] };
}

function buildMysteryBag(topics: Topic[]): MysteryBag {
  const bag = emptyBag();
  for (const topic of topics) {
    if (!topic.isMysteryTopic) continue;
    const mysteryQs = topic.questions.filter((q) => q.isMysteryQuestion);
    for (const mysteryQ of mysteryQs) {
      const entry: MysteryBagEntry = {
        topicName: topic.name,
        column: topic.column,
        question: mysteryQ,
      };
      bag[topic.column].push(entry);
    }
  }
  return bag;
}
