"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2.5 text-[15px] " +
  "outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 transition";

export function PollModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy?: boolean;
  onClose: () => void;
  onSubmit: (
    question: string,
    options: string[],
    opts: { anonymous: boolean; quiz: boolean; correctOption?: number },
  ) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [anonymous, setAnonymous] = useState(true);
  const [quiz, setQuiz] = useState(false);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);

  function setOpt(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  }
  function addOpt() {
    setOptions((prev) => (prev.length < 10 ? [...prev, ""] : prev));
  }

  const cleaned = options.map((o) => o.trim());
  const nonEmpty = cleaned.filter(Boolean);
  // Map the marked correct option (index into `options`) to its index among non-empty options.
  const correctOption =
    quiz && correctIndex != null && cleaned[correctIndex]
      ? cleaned.slice(0, correctIndex).filter(Boolean).length
      : undefined;
  const valid =
    question.trim().length > 0 && nonEmpty.length >= 2 && (!quiz || correctOption != null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    onSubmit(question.trim(), nonEmpty, { anonymous, quiz, correctOption });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-sm rounded-2xl bg-[#17212b] p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold">New {quiz ? "Quiz" : "Poll"}</h2>
        <input
          className={inputClass}
          placeholder="Ask a question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          autoFocus
        />
        <div className="mt-3 space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              {quiz && (
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                  title="Mark as correct answer"
                  className="accent-sky-500"
                />
              )}
              <input
                className={inputClass}
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => setOpt(i, e.target.value)}
              />
            </div>
          ))}
          {options.length < 10 && (
            <button type="button" onClick={addOpt} className="text-sm text-sky-300 hover:underline">
              + Add option
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="accent-sky-500"
            />
            Anonymous voting
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={quiz}
              onChange={(e) => {
                setQuiz(e.target.checked);
                if (!e.target.checked) setCorrectIndex(null);
              }}
              className="accent-sky-500"
            />
            Quiz mode (one correct answer)
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/10">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
