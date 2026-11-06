/**
 * Answer-position shuffling for generated multiple-choice questions.
 *
 * Models put the right answer first far more often than chance, so a learner
 * who always picks the first choice scores well. Choices are shuffled ONCE,
 * before a question is stored, and the index-string `correctKey` is remapped to
 * follow its choice. Never shuffle at render time: the stored order is what the
 * learner answered against and what grading reads.
 */

export type Random = () => number;

export interface McqShape {
  choices: string[];
  correctKey: string;
}

/** Fisher-Yates permutation of `0..n-1`. */
export function shuffledIndices(n: number, random: Random = Math.random): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Shuffle a question's choices and move its key with them. A question whose key
 * isn't a valid index into its choices is returned untouched: grading treats it
 * as it always did, and the shuffle never invents a wrong answer key.
 */
export function shuffleMcq<T extends McqShape>(question: T, random: Random = Math.random): T {
  const { choices, correctKey } = question;
  const key = correctKey.trim();
  if (!/^\d+$/.test(key) || Number(key) >= choices.length) return question;

  const order = shuffledIndices(choices.length, random);
  return {
    ...question,
    choices: order.map((i) => choices[i]),
    correctKey: String(order.indexOf(Number(key))),
  };
}
