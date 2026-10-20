import { quizzes } from "@/content/chapters";
import { QuizView } from "./QuizView";

// Server component: only this quiz is sent to the browser.
export function Quiz({ id }: { id: string }) {
  const questions = quizzes[id];
  if (!questions) throw new Error(`Unknown quiz "${id}"`);
  return <QuizView questions={questions} />;
}
