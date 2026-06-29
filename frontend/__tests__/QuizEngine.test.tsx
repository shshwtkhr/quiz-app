import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuizEngine from '@/components/QuizEngine';
import { QuizStoreProvider, useQuizStore } from '@/stores/quiz-store-provider';
import React from 'react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

const mockQuestions = [
  {
    _id: '1',
    topic: 'Math',
    question_text: 'What is 2+2?',
    options: ['3', '4', '5', '6'],
  },
  {
    _id: '2',
    topic: 'Math',
    question_text: 'What is 3+3?',
    options: ['5', '6', '7', '8'],
  },
];

const mockAnswerKey = {
  '1': { correct_answer: '4', explanation: 'Basic math' },
  '2': { correct_answer: '6', explanation: 'Basic math' },
};

// Wrapper to initialize store
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <QuizStoreProvider>
      <StoreInitializer>{children}</StoreInitializer>
    </QuizStoreProvider>
  );
};

const StoreInitializer = ({ children }: { children: React.ReactNode }) => {
  const setQuizData = useQuizStore((s) => s.setQuizData);
  const totalQuestions = useQuizStore((s) => s.totalQuestions);
  
  React.useEffect(() => {
    setQuizData(mockQuestions, mockAnswerKey, 600);
  }, [setQuizData]);
  
  if (totalQuestions === 0) return null;
  
  return <>{children}</>;
};

describe('QuizEngine Component', () => {
  it('renders the first question', () => {
    render(
      <TestWrapper>
        <QuizEngine />
      </TestWrapper>
    );
    
    expect(screen.getByText('What is 2+2?')).toBeTruthy();
    expect(screen.getByText('Question')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('can navigate to the next question', () => {
    render(
      <TestWrapper>
        <QuizEngine />
      </TestWrapper>
    );
    
    const nextBtn = screen.getByText('Next →');
    fireEvent.click(nextBtn);
    
    expect(screen.getByText('What is 3+3?')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('can select an answer', () => {
    render(
      <TestWrapper>
        <QuizEngine />
      </TestWrapper>
    );
    
    const option = screen.getByText('4');
    fireEvent.click(option);
    
    // Check if the selected state is applied (by finding the parent button)
    const button = option.closest('button');
    expect(button).toHaveClass('bg-primary/15'); // Our active style
  });
});
