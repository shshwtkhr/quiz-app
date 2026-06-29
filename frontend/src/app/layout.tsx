import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QuizStoreProvider } from '@/stores/quiz-store-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'QuizMaster — Dynamic Quiz Application',
  description:
    'Test your knowledge across multiple topics with timed quizzes, instant feedback, and detailed explanations.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <div className="animated-bg" />
        <QuizStoreProvider>
          <main className="relative min-h-screen">{children}</main>
        </QuizStoreProvider>
      </body>
    </html>
  );
}
