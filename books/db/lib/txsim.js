// Маленький движок для проигрывания расписаний транзакций на разных уровнях изоляции (модель в духе MVCC).
//  RU  — читаем последнюю версию, даже незафиксированную (грязное чтение)
//  RC  — читаем последнюю ЗАФИКСИРОВАННУЮ на момент оператора версию
//  SI  — снимок на начало транзакции + «первый зафиксировавший побеждает»
//  SER — SI + при фиксации проверяем, что прочитанное (в т.ч. диапазоны) не менялось (консервативная валидация)
export function runSchedule(initial, steps, level) {
  const versions = {}; // key -> [{v, tx, at}]  at = момент фиксации или null
  let clock = 1;
  for (const [k, v] of Object.entries(initial)) versions[k] = [{ v, tx: 0, at: 0 }];
  const tx = {}; // id -> {start, writes:Set, reads:Set, prefixes:Set, state, vars}
  const begin = (id) => { if (!tx[id]) tx[id] = { start: clock, writes: new Set(), reads: new Set(), prefixes: new Set(), state: 'active', vars: {} }; return tx[id]; };
  const visible = (k, t, id) => {
    const vs = (versions[k] || []).filter((x) => x.at !== -1);
    for (let i = vs.length - 1; i >= 0; i--) {
      const x = vs[i];
      if (x.tx === id) return x;
      if (level === 'RU') return x;
      if (x.at === null) continue;
      if (level === 'RC') return x;
      if (x.at <= t.start) return x;
    }
    return null;
  };
  const log = [];
  for (const s of steps) {
    const t = begin(s.t);
    if (t.state !== 'active') { log.push({ ...s, out: '— (транзакция уже завершена)' }); continue; }
    if (s.op === 'r') {
      const x = visible(s.k, t, s.t); t.reads.add(s.k);
      const val = x ? x.v : null; t.vars[s.as || s.k] = val;
      log.push({ ...s, out: `${s.k} = ${val}` + (x && x.at === null && x.tx !== s.t ? '  ⚠ незафиксированное значение!' : '') });
    } else if (s.op === 'scan') {
      const keys = Object.keys(versions).filter((k) => k.startsWith(s.prefix) && visible(k, t, s.t) && visible(k, t, s.t).v !== null);
      t.prefixes.add(s.prefix); t.vars[s.as] = keys.length;
      log.push({ ...s, out: `${s.as} = ${keys.length}` });
    } else if (s.op === 'w') {
      const v = s.f(t.vars);
      (versions[s.k] = versions[s.k] || []).push({ v, tx: s.t, at: null });
      t.writes.add(s.k); t.vars[s.k] = v;
      log.push({ ...s, out: `${s.k} := ${v}` });
    } else if (s.op === 'a') {
      for (const k of t.writes) versions[k].forEach((x) => { if (x.tx === s.t && x.at === null) x.at = -1; });
      t.state = 'aborted'; log.push({ ...s, out: 'ROLLBACK' });
    } else if (s.op === 'c') {
      let reason = null;
      if (level === 'SI' || level === 'SER') {
        for (const k of t.writes) if ((versions[k] || []).some((x) => x.tx !== s.t && x.at !== null && x.at > t.start)) reason = `конфликт записи по «${k}»`;
      }
      if (!reason && level === 'SER' && t.writes.size > 0) {   // читающей транзакции хватает снимка
        for (const k of t.reads) if (!t.writes.has(k) && versions[k].some((x) => x.tx !== s.t && x.at !== null && x.at > t.start)) reason = `прочитанное «${k}» изменено параллельно`;
        for (const p of t.prefixes) for (const k of Object.keys(versions)) if (k.startsWith(p) && versions[k].some((x) => x.tx !== s.t && x.at !== null && x.at > t.start)) reason = `в прочитанном диапазоне «${p}*» появились изменения`;
      }
      if (reason) {
        for (const k of t.writes) versions[k].forEach((x) => { if (x.tx === s.t && x.at === null) x.at = -1; });
        t.state = 'aborted'; log.push({ ...s, out: `ОТКАТ: ${reason}`, abort: true });
      } else {
        clock++;
        for (const k of t.writes) versions[k].forEach((x) => { if (x.tx === s.t && x.at === null) x.at = clock; });
        t.state = 'committed'; log.push({ ...s, out: 'COMMIT' });
      }
    }
  }
  const final = {};
  for (const k of Object.keys(versions)) { const c = versions[k].filter((x) => x.at !== null && x.at !== -1); final[k] = c.length ? c[c.length - 1].v : null; }
  return { log, final, tx };
}
