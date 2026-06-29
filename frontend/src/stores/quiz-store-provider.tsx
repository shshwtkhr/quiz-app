'use client';

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createQuizStore, type QuizStore } from './quiz-store';

type QuizStoreApi = ReturnType<typeof createQuizStore>;

const QuizStoreContext = createContext<QuizStoreApi | undefined>(undefined);

export function QuizStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<QuizStoreApi | undefined>(undefined);
  if (!storeRef.current) {
    storeRef.current = createQuizStore();
  }

  return (
    <QuizStoreContext.Provider value={storeRef.current}>
      {children}
    </QuizStoreContext.Provider>
  );
}

export function useQuizStore<T>(selector: (state: QuizStore) => T): T {
  const store = useContext(QuizStoreContext);
  if (!store) {
    throw new Error('useQuizStore must be used within a QuizStoreProvider');
  }
  return useStore(store, selector);
}
