// Детерминированный генератор случайных чисел (mulberry32) — чтобы демо были воспроизводимы.
export function makeRng(seed = 42) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // нормальное распределение N(0,1) методом Бокса — Мюллера
  const randn = () => {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // выбор индекса из распределения probs
  const choice = (probs) => {
    let x = rand(), c = 0;
    for (let i = 0; i < probs.length; i++) { c += probs[i]; if (x < c) return i; }
    return probs.length - 1;
  };
  return { rand, randn, choice };
}

export function softmax(logits, temperature = 1) {
  const z = logits.map((l) => l / temperature);
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
