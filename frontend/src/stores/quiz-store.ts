import { createStore } from 'zustand/vanilla';
import { Question, AnswerKey } from '@/types';

export interface QuizState {
  // Quiz data
  questions: Question[];
  answerKey: AnswerKey;
  totalQuestions: number;

  // Quiz progress
  currentIndex: number;
  selectedAnswers: Record<string, string>; // keyed by question _id

  // Timer
  timeRemaining: number; // in seconds

  // Results
  isSubmitted: boolean;
  score: number;
}

export interface QuizActions {
  setQuizData: (questions: Question[], answerKey: AnswerKey, timeLimitSeconds: number) => void;
  selectAnswer: (questionId: string, answer: string) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  tickTimer: () => void;
  submitQuiz: () => void;
  resetQuiz: () => void;
}

export type QuizStore = QuizState & QuizActions;

const initialState: QuizState = {
  questions: [],
  answerKey: {},
  totalQuestions: 0,
  currentIndex: 0,
  selectedAnswers: {},
  timeRemaining: 0,
  isSubmitted: false,
  score: 0,
};

export const createQuizStore = (initState: Partial<QuizState> = {}) => {
  return createStore<QuizStore>()((set, get) => ({
    ...initialState,
    ...initState,

    setQuizData: (questions, answerKey, timeLimitSeconds) =>
      set({
        questions,
        answerKey,
        totalQuestions: questions.length,
        timeRemaining: timeLimitSeconds,
        currentIndex: 0,
        selectedAnswers: {},
        isSubmitted: false,
        score: 0,
      }),

    selectAnswer: (questionId, answer) =>
      set((state) => ({
        selectedAnswers: { ...state.selectedAnswers, [questionId]: answer },
      })),

    nextQuestion: () =>
      set((state) => ({
        currentIndex: Math.min(state.currentIndex + 1, state.totalQuestions - 1),
      })),

    prevQuestion: () =>
      set((state) => ({
        currentIndex: Math.max(state.currentIndex - 1, 0),
      })),

    tickTimer: () =>
      set((state) => {
        if (state.timeRemaining <= 0) return state;
        return { timeRemaining: state.timeRemaining - 1 };
      }),

    submitQuiz: () => {
      const { questions, answerKey, selectedAnswers } = get();
      let score = 0;
      questions.forEach((q) => {
        const userAnswer = selectedAnswers[q._id];
        const correct = answerKey[q._id]?.correct_answer;
        if (userAnswer === correct) score++;
      });
      set({ isSubmitted: true, score });
    },

    resetQuiz: () => set(initialState),
  }));
};
