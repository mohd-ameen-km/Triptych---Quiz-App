'use client';

import { useGame } from '@/components/GameProvider';
import QuestionScreen from '@/components/QuestionScreen';
import ResultScreen from '@/components/ResultScreen';
import SetupScreen from '@/components/SetupScreen';
import TopicsScreen from '@/components/TopicsScreen';

export default function Home() {
  const { state } = useGame();

  // Route to the right screen based on game phase
  switch (state.phase) {
    case 'setup':
      return <SetupScreen />;

    case 'topics':
      return <TopicsScreen />;

    case 'question':
      return <QuestionScreen />;

    case 'result':
      return <ResultScreen />;

    default:
      return <SetupScreen />;
  }
}
