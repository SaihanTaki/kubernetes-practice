"use client";

import { useState } from "react";
import { quizzes, type QuizQuestion } from "@/content/quizzes";

export function Quiz({ id }: { id: string }) {
  const questions = quizzes[id];
  if (!questions) throw new Error(`Unknown quiz "${id}"`);
  return <QuizView questions={questions} />;
}

function QuizView({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answered = Object.keys(answers).length;
  const correct = questions.filter((q) => answers[q.id] === q.correctOptionId).length;

  return (
    <section className="my-8 rounded-lg border border-border bg-surface p-4" aria-label="Quiz">
      <ol className="space-y-8">
        {questions.map((q, n) => {
          const picked = answers[q.id];
          return (
            <li key={q.id}>
              <fieldset disabled={!!picked}>
                <legend className="font-medium">
                  {n + 1}. {q.question}
                </legend>
                <p className="mt-1 text-xs text-muted">
                  {q.topic} · {q.difficulty}
                </p>
                <div className="mt-3 grid gap-2">
                  {q.options.map((o) => {
                    const state = !picked ? "" : o.id === q.correctOptionId ? "border-ok" : o.id === picked ? "border-bad" : "opacity-70";
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                        aria-pressed={picked === o.id}
                        className={`min-h-11 rounded-md border-2 border-border px-3 py-2 text-left enabled:hover:bg-code ${state}`}
                      >
                        {o.text}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {picked && (
                <div className="mt-3" role="status">
                  <p className={`font-medium ${picked === q.correctOptionId ? "text-ok" : "text-bad"}`}>
                    {picked === q.correctOptionId ? "Correct." : "Not quite."}
                  </p>
                  <p className="mt-1 text-sm">{q.explanation}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <p className="text-sm text-muted">
          {answered === questions.length ? `${correct} of ${questions.length} correct.` : `${answered} of ${questions.length} answered.`}
        </p>
        <button
          type="button"
          onClick={() => setAnswers({})}
          disabled={!answered}
          className="min-h-11 rounded-md border border-border px-4 enabled:hover:bg-code disabled:opacity-50"
        >
          Retry quiz
        </button>
      </div>
    </section>
  );
}
