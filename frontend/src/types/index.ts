/** Question as received from the API (without answers) */
export interface Question {
  _id: string;
  topic: string;
  subtopic?: string;
  context?: string;
  question_text: string;
  options: string[];
}

/** Full Question data including correct answer and explanation (used for manage section) */
export interface QuestionData extends Question {
  correct_answer: string;
  explanation: string;
}

/** Answer key entry for a single question */
export interface AnswerKeyEntry {
  correct_answer: string;
  explanation: string;
}

/** Full answer key, keyed by question _id */
export type AnswerKey = Record<string, AnswerKeyEntry>;

/** Topic information from the API */
export interface TopicInfo {
  _id: string;
  count: number;
}

/** User's topic selection for quiz configuration */
export interface TopicSelection {
  topic: string;
  count: number;
  maxCount: number;
  selected: boolean;
}
