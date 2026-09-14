# Triptych

A strategic, high-stakes trivia platform designed for competitive three-player gameplay. Built with a bespoke **White and Gold with Stately Teal** aesthetic, **Triptych** combines an 18-topic board, cyclical positional pick rotations, lowest-score pass mechanics, non-blocking pacing timers, endgame mystery bags, and a complete multi-step global undo engine.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [Positional 6-Cycle Pick Rotation](#positional-6-cycle-pick-rotation)
  - [Pass Order & Tie-Breaking Engine](#pass-order--tie-breaking-engine)
  - [Adaptive Pacing Timers](#adaptive-pacing-timers)
  - [Single-Row Action Bar & Independent Reveal](#single-row-action-bar--independent-reveal)
  - [Global History & Multi-Step Undo](#global-history--multi-step-undo)
  - [Mystery Bags (Endgame Phase)](#mystery-bags-endgame-phase)
  - [Granular Score Deduction & Topic Resets](#granular-score-deduction--topic-resets)
- [Design & Aesthetics](#design--aesthetics)
- [TSV Question Bank Specification](#tsv-question-bank-specification)
  - [Required Columns](#required-columns)
  - [Sample TSV Data](#sample-tsv-data)
  - [Game Modes](#game-modes)
- [Architecture & Tech Stack](#architecture--tech-stack)
  - [State Machine & Reducer](#state-machine--reducer)
  - [Turn Order Mathematics](#turn-order-mathematics)
  - [File Structure](#file-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development Server](#development-server)
  - [Testing & Quality Assurance](#testing--quality-assurance)

---

## Overview

In **Triptych**, three players (P1, P2, P3) compete across a structured 3-column board (**Left**, **Center**, **Right**). Each column contains 6 named topic cards, culminating in 18 core board topics, plus 3 mystery bags positioned at the base of each column that unlock in the endgame.

Questions are delivered directly to the active topic picker, with missed questions passing to eligible opponents based on circular seating order and live scores.

---

## Key Features

### Positional 6-Cycle Pick Rotation

- Given fixed seating order `[P1, P2, P3]`, topic selections follow a deterministic 6-cycle:
  $$\text{Picks 0–5: } [P_1, P_2, P_3, P_3, P_2, P_1]$$
- Position index is purely positional and never biased by current scores or prior outcomes:
  `getTopicPicker(pickIndex, seatOrder) = seatOrder[cycle[pickIndex % 6]]`
- **Round Direction**:
  - Picks 0–2 ($P_1 \to P_2 \to P_3$): **Forward** (`'forward'`)
  - Picks 3–5 ($P_3 \to P_2 \to P_1$): **Reverse** (`'reverse'`)

### Pass Order & Tie-Breaking Engine

1. **Direct Question**: The question always goes to `directPlayer` first.
2. **Pass Sequence**: When the direct player passes or answers incorrectly, the pass sequence begins with the player sitting immediately after the direct player in the round's direction:
   - _Forward_: $P_1 \to [P_2, P_3]$; $P_2 \to [P_3, P_1]$; $P_3 \to [P_1, P_2]$
   - _Reverse_: $P_1 \to [P_3, P_2]$; $P_2 \to [P_1, P_3]$; $P_3 \to [P_2, P_1]$
3. **Lowest-Score Priority**: Between the two non-direct players, the pass goes to whoever has the **lowest score**. If tied, the circular pass sequence breaks the tie.
4. **Completion**: If all three players attempt without scoring, the question finishes with zero points awarded.

### Adaptive Pacing Timers

- Configurable on the setup screen:
  - **Seconds on Direct** (default: `25s`)
  - **Seconds on Pass** (default: `20s`)
- **Direct Turn**: The timer displays at `directSeconds` in a **stopped** state, requiring the reader to click **Start Timer** manually.
- **Pass Turn**: When a question passes via **Wrong** or **Pass**, the timer resets to `passSeconds` and **auto-starts** immediately.
- **Non-Blocking**: Timers provide visual pacing only; expiration does not lock out controls.

### Single-Row Action Bar & Independent Reveal

All five core gameplay actions sit side-by-side in a single row with exact, unambiguous labels:

- **`Correct`**: Awards 1 point to the active player and marks the question complete.
- **`Wrong`**: Marks the attempt wrong and advances to the next eligible pass player.
- **`Pass`**: Passes the question to the next eligible pass player.
- **`Reveal Answer`**: Explicitly reveals the answer text and media. Marking a question Correct or Wrong does **not** auto-reveal the answer, giving the quizmaster complete control.
- **`Undo`**: Reverts the last game action.

### Global History & Multi-Step Undo

- Every mutating dispatch (`SELECT_TOPIC`, `MARK_CORRECT`, `MARK_WRONG`, `PASS`, `REVEAL_ANSWER`, `NEXT_QUESTION`, `RESET_TOPIC`) pushes a full immutable snapshot of the game state onto a single global history stack.
- Clicking **Undo** pops the most recent snapshot and restores the exact state (scores, turn pointer, attempts, revealed status, topic progress).
- Because `SELECT_TOPIC` and `NEXT_QUESTION` are snapshotted, repeated clicks step back through the current question, transition back to the topics board, and continue into the previous question's final completed state.
- Available on both the question screen and the topics board.

### Mystery Bags (Endgame Phase)

- Positioned at the bottom of each column, mystery bags remain locked and disabled until all 18 named topics have been completed.
- **Topic-Only Score Snapshot (`topicPhaseScore`)**: The exact moment the 18th topic completes, each player's score is snapshotted into `topicPhaseScore`. This internal ranking metric is never updated by points earned during mystery bag play (regular displayed scores continue to reflect true running totals everywhere in the UI).
- **Pick Order Ranking**: Players are ranked to pick one mystery bag each across a fixed sequence of exactly 3 turns:
  1. **Topic-Phase Score**: Lowest score picks first (ascending).
  2. **Bonus Attempts (BA)**: Score ties broken by lowest BA.
  3. **Initial Seat Order**: Persistent tie-breaker from setup `[P1, P2, P3]`.
- **Selection & Question Flow**: The 1st-ranked player chooses any of the 3 mystery bags; the 2nd-ranked chooses from the remaining 2; the 3rd-ranked receives the final bag. Clicking an available mystery bag goes directly into the question without intermediate modals.
- **Pass Direction**: All mystery bag questions treat rotation as **`forward`** using initial `seatOrder`, since mystery picks fall outside the 18-topic zigzag cycle.
- **Isolated State & Resets**: Each mystery bag entry has an independent ID (`mystery-bag-${column}-${index}`). Taking a mystery bag marks only that specific bag entry as taken. If a named topic is reset after mystery bags unlock, the same point deduction applies to `topicPhaseScore` as to `score`. Resetting a mystery question deducts points from `score` but leaves `topicPhaseScore` unchanged.

### Granular Score Deduction & Topic Resets

- Completed topics and mystery bag entries can be reset directly from the board.
- The system checks all historical score events associated with that topic or question, presents a confirmation dialog with the exact point deductions, and cleanly deducts the points from the affected player(s).

---

## Design & Aesthetics

Triptych adheres to a refined, distraction-free aesthetic:

- **Palette**: Deep Stately Teal (`#0D5C58`), Polished Antique Gold (`#C5A059`), Soft Neutral Grey (`#F8FAFC`), and Crisp White (`#FFFFFF`).
- **Readability**: High-contrast dark text (`#0F172A`) on white cards for questions and answers.
- **Two-Column Question View**:
  - **Left Sidebar**: Fixed-width, sticky vertical scoreboard keeping player names, scores, and active-turn pulses visible during scrolling.
  - **Right Main Area**: Left-aligned question text, centered answer text, and the five-control action bar.
- **Zero Emojis**: Clean iconography and typographic accents only.

---

## TSV Question Bank Specification

Questions are ingested via TSV (tab-separated values) or CSV files exported from Google Sheets or Excel.

### Required Columns

| Column Header       | Type         | Description                                             |
| :------------------ | :----------- | :------------------------------------------------------ |
| `TopicName`         | String       | Name of the topic.                                      |
| `Column`            | Enum         | `left`, `center`, or `right` (case-insensitive).        |
| `IsMysteryTopic`    | Boolean      | `TRUE` or `FALSE`.                                      |
| `QnNo`              | Integer      | Question sequence number within topic (1-indexed).      |
| `QnText`            | String       | The prompt presented to the contestants.                |
| `AnsText`           | String       | The verified correct answer.                            |
| `IsMysteryQuestion` | Boolean      | `TRUE` if question belongs to the column's mystery bag. |
| `QnImg`             | String (URL) | _(Optional)_ Image shown with the question prompt.      |
| `AnsImg`            | String (URL) | _(Optional)_ Image revealed alongside the answer.       |
| `QnVid`             | String (URL) | _(Optional)_ Video URL/path for question prompt.        |
| `AnsVid`            | String (URL) | _(Optional)_ Video URL/path for answer reveal.          |
| `QnAud`             | String (URL) | _(Optional)_ Audio URL/path for question prompt.        |
| `AnsAud`            | String (URL) | _(Optional)_ Audio URL/path for answer reveal.          |

### Sample TSV Data

```tsv
TopicName	Column	IsMysteryTopic	QnNo	QnText	AnsText	IsMysteryQuestion	QnImg	AnsImg	QnVid	AnsVid	QnAud	AnsAud
Ancient Wonders	left	FALSE	1	Which wonder was located in Alexandria?	Lighthouse of Alexandria	FALSE
Ancient Wonders	left	FALSE	2	What temple was built in Ephesus for a goddess?	Temple of Artemis	FALSE
Lost Cities	left	TRUE	1	Which city was rediscovered by Hiram Bingham in 1911?	Machu Picchu	TRUE
```

### Game Structure (18 Topics)

- Exactly 18 topics total (6 in Left, 6 in Center, 6 in Right).
- Exactly 3 mystery topics per column (9 total).
- Exactly 1 mystery question per mystery topic (feeding 3 mystery questions into each column's mystery bag).
- At least one non-mystery question per topic.

---

## Architecture & Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS with custom theme variables
- **Parser**: PapaParse with syntax normalization and schema validation
- **Testing**: Vitest with 94 unit and integration tests

### State Machine & Reducer

All gameplay mutations flow through [`lib/gameReducer.ts`](file:///Users/ameenkm/Projects/quizapp/lib/gameReducer.ts) via React's `useReducer`. State changes automatically sync to browser `localStorage` under `quizapp_game_state`.

```
[SetupScreen] ── START_GAME ──► [TopicsScreen]
                                     │
                 ┌───────────────────┴───────────────────┐
            SELECT_TOPIC                            RESET_TOPIC
                 ▼                                       ▼
         [QuestionScreen]                        Recalculate & Deduct
                 │
       ┌─────────┼─────────┬──────────────┬──────────────┐
    Correct    Wrong      Pass      Reveal Answer      Undo
       │         │         │              │              │
       └─────────┴─────────┴──────────────┴──────────────┘
                 │
            NEXT_QUESTION ──► Return to [TopicsScreen] or [ResultScreen]
```

### Turn Order Mathematics & Bonus Attempts (BA)

All turn sequencing logic is isolated and unit-tested in [`lib/turnOrder.ts`](file:///Users/ameenkm/Projects/quizapp/lib/turnOrder.ts):

- `getTopicPicker(pickIndex, seatOrder)`
- `getPickDirection(pickIndex)`
- `getPassOrder(directPlayer, direction, seatOrder)`
- `getNextPlayer(passOrder, playersAttempted, bonusAttempts)`

#### Bonus Attempts (BA) & Pass Priority Rules

- **Definition**: A player earns a bonus attempt only when marked **Correct** or **Wrong** on a passed question (i.e. questions that reached them via a pass, where they are not the direct player).
- **Direct Attempts**: The direct player who picked the topic never receives a BA regardless of outcome.
- **Pass Actions**: Clicking **Pass** indicates no attempt was made, so BA remains unchanged.
- **Pass Priority**: When a question passes, `getNextPlayer` selects the candidate who currently has the **lowest BA**. If candidates are tied on BA, ties are resolved using the direction-based `passOrder`.
- **Persistence**: BA is tracked persistently across the entire tournament and is displayed transparently on the scoreboard (`Score: 3 · BA: 2`).

### File Structure

```
quizapp/
├── app/
│   ├── globals.css            # Global typography and base CSS tokens
│   ├── layout.tsx             # Root layout with font definitions
│   └── page.tsx               # Orchestrator routing to current phase
├── components/
│   ├── GameProvider.tsx       # React Context provider wrapping gameReducer
│   ├── Logo.tsx               # Stately 3-panel Triptych crest and wordmark
│   ├── QuestionScreen.tsx     # Two-column layout with sticky sidebar & controls
│   ├── ResetConfirmationModal.tsx # Safe point deduction confirmation dialog
│   ├── ResultScreen.tsx       # Final standings podium and leaderboard
│   ├── Scoreboard.tsx         # Reusable horizontal or vertical scoreboard
│   ├── SetupScreen.tsx        # File upload, player setup, timer configuration
│   └── TopicsScreen.tsx       # 18-topic board with mystery bags & board undo
├── lib/
│   ├── __tests__/
│   │   ├── gameReducer.test.ts # Reducer, undo stack, mystery bag isolation tests
│   │   ├── tsv-parser.test.ts  # Parsing, header handling, schema validation tests
│   │   └── turnOrder.test.ts   # 6-cycle rotations, pass orders, tie-breaking tests
│   ├── gameReducer.ts         # Central reducer and state management
│   ├── tsv-parser.ts          # PapaParse wrapper and game mode validation
│   └── turnOrder.ts           # Pure turn order algorithms
├── types/
│   └── index.ts               # Core domain interfaces, actions, and snapshots
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18.17+ or 20+
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/your-username/quizapp.git
cd quizapp
npm install
```

### Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Testing & Quality Assurance

```bash
# Run unit and integration tests (104 test cases)
npm test

# Check code style with Prettier
npm run format

# Run ESLint validation
npm run lint

# Compile optimized production build
npm run build
```

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
