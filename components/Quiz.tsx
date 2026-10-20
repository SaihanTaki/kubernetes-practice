"use client";

import { useState } from "react";
import { quizzes } from "@/content/chapters";
import type { QuizQuestion } from "@/content/types";

export function Quiz({ id }: { id: string }) {
  const questions = quizzes[id];
  if (!questions) throw new Error(`Unknown quiz "${id}"`);
  return <QuizView questions={questions} />;
}

const button = "min-h-11 rounded-md border border-border px-4 enabled:hover:bg-code disabled:opacity-50";
const primary = "min-h-11 rounded-md bg-accent-fill px-4 font-medium text-white enabled:hover:opacity-90 disabled:opacity-50";

function QuizView({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const answered = Object.keys(answers).length;
  const correct = questions.filter((q) => answers[q.id] === q.correctOptionId).length;
  const done = answered === questions.length;
  const q = questions[index];
  const picked = answers[q.id];

  return (
    <section className="my-8 rounded-lg border border-border bg-surface p-5" aria-label="Quiz">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted">
        <span className="font-mono">
          question {index + 1} / {questions.length}
        </span>
        <span>
          {answered} answered, {correct} correct
        </span>
      </div>
      <div className="mt-2 h-1 rounded bg-code" aria-hidden>
        <div className="h-1 rounded bg-accent" style={{ width: `${(answered / questions.length) * 100}%` }} />
      </div>

      <fieldset key={q.id} disabled={!!picked} className="mt-5">
        <legend className="text-lg font-medium leading-7">{q.question}</legend>
        <p className="mt-1 font-mono text-xs text-muted">
          {q.topic} · {q.difficulty}
        </p>
        <div className="mt-3 grid gap-2">
          {q.options.map((o) => {
            const state = !picked ? "border-border" : o.id === q.correctOptionId ? "border-ok" : o.id === picked ? "border-bad" : "border-border opacity-70";
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                aria-pressed={picked === o.id}
                className={`min-h-11 rounded-md border-2 px-3 py-2 text-left enabled:hover:bg-code ${state}`}
              >
                {o.text}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 min-h-6" role="status">
        {picked && (
          <>
            <p className={`font-medium ${picked === q.correctOptionId ? "text-ok" : "text-bad"}`}>
              {picked === q.correctOptionId ? "Correct." : "Not quite."}
            </p>
            <p className="mt-1 text-sm">{q.explanation}</p>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous
        </button>
        <button type="button" className={primary} disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}>
          Next question
        </button>
        <button
          type="button"
          className={button}
          disabled={!answered}
          onClick={() => {
            setAnswers({});
            setIndex(0);
          }}
        >
          Retry quiz
        </button>
      </div>
      {done && (
        <p className="mt-4 font-medium">
          Finished: {correct} of {questions.length} correct.
        </p>
      )}
    </section>
  );
}
