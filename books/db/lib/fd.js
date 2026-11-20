// Функциональные зависимости: замыкание, ключи, нормальные формы, BCNF-декомпозиция (как python/normalize.py).
export function parseFDs(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l.includes('->')).map((l) => {
    const [a, b] = l.split('->');
    return [new Set(a.split(/[\s,]+/).filter(Boolean)), new Set(b.split(/[\s,]+/).filter(Boolean))];
  });
}

const sub = (a, b) => [...a].every((x) => b.has(x));

export function closure(attrs, fds) {
  const res = new Set(attrs);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [l, r] of fds) if (sub(l, res) && !sub(r, res)) { r.forEach((x) => res.add(x)); changed = true; }
  }
  return res;
}

export function candidateKeys(attrs, fds) {
  const all = new Set(attrs);
  const inRhs = new Set(fds.flatMap(([, r]) => [...r]));
  const must = attrs.filter((a) => !inRhs.has(a));
  const rest = attrs.filter((a) => inRhs.has(a));
  const keys = [];
  for (let k = 0; k <= rest.length; k++) {
    const combos = (arr, n, start = 0, acc = []) => (n === 0 ? [acc] : arr.slice(start).flatMap((x, i) => combos(arr, n - 1, start + i + 1, [...acc, x])));
    for (const extra of combos(rest, k)) {
      const cand = new Set([...must, ...extra]);
      if (keys.some((key) => sub(key, cand))) continue;
      if (closure(cand, fds).size === all.size && sub(all, closure(cand, fds))) keys.push(cand);
    }
    if (keys.length && k > 6) break;
  }
  return keys;
}

/** Нормальная форма отношения (при условии 1NF): '2NF' | '3NF' | 'BCNF' | '1NF' и причина нарушения следующей формы */
export function normalForm(attrs, fds) {
  const all = new Set(attrs);
  const keys = candidateKeys(attrs, fds);
  const prime = new Set(keys.flatMap((k) => [...k]));
  const single = fds.flatMap(([l, r]) => [...r].filter((a) => !l.has(a)).map((a) => [l, a]));
  const isSuper = (x) => sub(all, closure(x, fds));
  // 2NF: неключевой атрибут не зависит от части потенциального ключа
  for (const key of keys) {
    const ks = [...key];
    for (let m = 1; m < (1 << ks.length) - 1; m++) {
      const part = new Set(ks.filter((_, i) => m & (1 << i)));
      const dep = [...closure(part, fds)].filter((a) => !prime.has(a) && !part.has(a));
      if (dep.length) return { nf: '1NF', why: `частичная зависимость: {${[...part].join(', ')}} → ${dep.join(', ')} — часть ключа {${ks.join(', ')}} определяет неключевые атрибуты`, keys, prime };
    }
  }
  for (const [l, a] of single) if (!isSuper(l) && !prime.has(a)) return { nf: '2NF', why: `транзитивная зависимость: {${[...l].join(', ')}} → ${a}, где {${[...l].join(', ')}} не суперключ, а ${a} не входит ни в один ключ`, keys, prime };
  for (const [l, a] of single) if (!isSuper(l)) return { nf: '3NF', why: `{${[...l].join(', ')}} → ${a}: левая часть не суперключ (хотя ${a} — ключевой атрибут)`, keys, prime };
  return { nf: 'BCNF', why: 'каждая нетривиальная зависимость начинается с суперключа', keys, prime };
}

export function bcnfDecompose(attrs, fds) {
  const all = new Set(attrs);
  // ищем нарушение среди зависимостей, спроецированных на attrs (перебор подмножеств — для учебных размеров)
  const list = [...attrs];
  for (let m = 1; m < (1 << list.length) - 1; m++) {
    const x = new Set(list.filter((_, i) => m & (1 << i)));
    const xp = new Set([...closure(x, fds)].filter((a) => all.has(a)));
    const nontriv = [...xp].some((a) => !x.has(a));
    if (nontriv && xp.size < all.size) {
      const r1 = [...xp], r2 = list.filter((a) => !xp.has(a) || x.has(a));
      return [...bcnfDecompose(r1, fds), ...bcnfDecompose(r2, fds)];
    }
  }
  return [list];
}
