import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat } from '@shared/ui.jsx';

// Сценарий: записи журнала и сбросы страниц на диск. Страницы A, B, C изначально = 0.
const EVENTS = [
  { kind: 'upd', t: 1, p: 'A', old: 0, nw: 10 },
  { kind: 'upd', t: 2, p: 'B', old: 0, nw: 20 },
  { kind: 'flush', p: 'B' },
  { kind: 'upd', t: 1, p: 'C', old: 0, nw: 30 },
  { kind: 'commit', t: 1 },
  { kind: 'upd', t: 3, p: 'A', old: 10, nw: 11 },
  { kind: 'flush', p: 'A' },
  { kind: 'upd', t: 2, p: 'C', old: 30, nw: 31 },
  { kind: 'commit', t: 3 },
  { kind: 'upd', t: 2, p: 'B', old: 20, nw: 22 },
  { kind: 'flush', p: 'C' },
  { kind: 'commit', t: 2 },
];
const PAGES = ['A', 'B', 'C'];

function simulateCrash(crashAt) {
  const buf = { A: 0, B: 0, C: 0 }, bufLSN = { A: 0, B: 0, C: 0 };
  const disk = { A: 0, B: 0, C: 0 }, diskLSN = { A: 0, B: 0, C: 0 };
  const log = [];
  EVENTS.slice(0, crashAt).forEach((e, i) => {
    const lsn = i + 1;
    if (e.kind === 'upd') { log.push({ ...e, lsn }); buf[e.p] = e.nw; bufLSN[e.p] = lsn; }
    if (e.kind === 'commit') log.push({ ...e, lsn });
    if (e.kind === 'flush') { disk[e.p] = buf[e.p]; diskLSN[e.p] = bufLSN[e.p]; } // по правилу WAL журнал до bufLSN уже на диске
  });
  const before = { ...disk };
  // 1. Анализ
  const committed = new Set(log.filter((l) => l.kind === 'commit').map((l) => l.t));
  const all = new Set(log.filter((l) => l.kind === 'upd').map((l) => l.t));
  const losers = [...all].filter((t) => !committed.has(t));
  // 2. Redo: повторяем ВСЮ историю, если страница на диске старее записи
  const redo = [];
  const state = { ...disk }, lsnOf = { ...diskLSN };
  log.forEach((l) => { if (l.kind === 'upd' && lsnOf[l.p] < l.lsn) { state[l.p] = l.nw; lsnOf[l.p] = l.lsn; redo.push(l); } });
  const afterRedo = { ...state };
  // 3. Undo: откатываем проигравших с конца журнала
  const undo = [];
  [...log].reverse().forEach((l) => { if (l.kind === 'upd' && losers.includes(l.t)) { state[l.p] = l.old; undo.push(l); } });
  // ожидаемое: применены только изменения зафиксированных транзакций
  const expected = { A: 0, B: 0, C: 0 };
  log.forEach((l) => { if (l.kind === 'upd' && committed.has(l.t)) expected[l.p] = l.nw; });
  return { log, before, afterRedo, after: state, expected, committed: [...committed], losers, redo, undo };
}

function CrashWidget() {
  const [crashAt, setCrash] = useState(10);
  const s = simulateCrash(crashAt);
  const ok = PAGES.every((p) => s.after[p] === s.expected[p]);
  const desc = (e) => (e.kind === 'upd' ? `T${e.t}: ${e.p} ${e.old} → ${e.nw}` : e.kind === 'commit' ? `T${e.t}: COMMIT` : `сброс страницы ${e.p} на диск`);
  return (
    <Widget title="Сбой и восстановление по ARIES">
      <Slider label="сбой после события №" value={crashAt} min={0} max={EVENTS.length} onChange={setCrash} />
      <div className="row">
        <div className="col">
          {EVENTS.map((e, i) => (
            <div key={i} className="mono small" style={{ opacity: i < crashAt ? 1 : 0.3, color: e.kind === 'flush' ? 'var(--amber)' : e.kind === 'commit' ? 'var(--green)' : undefined }}>
              {i + 1}. {e.kind === 'flush' ? '' : `LSN ${i + 1}  `}{desc(e)}{i === crashAt - 1 ? '   ⚡ СБОЙ' : ''}
            </div>
          ))}
        </div>
        <div className="col">
          <p className="small"><b>Анализ:</b> зафиксированы {s.committed.map((t) => 'T' + t).join(', ') || '—'}; проигравшие (откатить): {s.losers.map((t) => 'T' + t).join(', ') || '—'}</p>
          <p className="small"><b>Redo</b> (повтор истории): {s.redo.map((l) => `LSN${l.lsn}`).join(', ') || 'ничего'}</p>
          <p className="small"><b>Undo</b> (с конца): {s.undo.map((l) => `LSN${l.lsn}`).join(', ') || 'ничего'}</p>
          <table className="small">
            <thead><tr><th>Стр.</th><th>на диске после сбоя</th><th>после redo</th><th>после undo</th><th>должно быть</th></tr></thead>
            <tbody>{PAGES.map((p) => <tr key={p}><td>{p}</td><td>{s.before[p]}</td><td>{s.afterRedo[p]}</td><td><b>{s.after[p]}</b></td><td>{s.expected[p]}</td></tr>)}</tbody>
          </table>
          <div className="stats"><Stat k="результат" v={ok ? '✓ атомарность и долговечность' : '✗'} /></div>
        </div>
      </div>
      <p className="small muted">Политика буфера — steal/no-force: незафиксированные изменения могут попасть на диск (событие 3 сбрасывает страницу B с изменением незавершённой T2), а зафиксированные — не попасть. Поэтому нужны и redo, и undo. Двигайте точку сбоя: ответ всегда совпадает с «должно быть». Упрощения: нет контрольных точек и записей компенсации (CLR), журнал до точки сбоя считается сброшенным на диск.</p>
    </Widget>
  );
}

export default function Recovery() {
  return (
    <>
      <h1>Журнал и восстановление</h1>
      <p className="lead">Питание может пропасть в любую наносекунду — посреди записи страницы, между двумя операциями транзакции, сразу после ответа «COMMIT OK». СУБД обязана после перезапуска показать: все зафиксированные транзакции — целиком, незафиксированные — никак.</p>

      <h2>Почему нельзя просто писать страницы</h2>
      <p>Транзакция меняет страницы, разбросанные по диску. Записать их все атомарно невозможно: диск гарантирует атомарность в лучшем случае одного сектора. Выбор политики буферного пула определяет, что придётся чинить:</p>
      <table>
        <thead><tr><th></th><th>No-force (не сбрасывать страницы при COMMIT)</th><th>Force (сбрасывать)</th></tr></thead>
        <tbody>
          <tr><th>Steal (можно сбросить грязную страницу незавершённой транзакции)</th><td><b>Нужны redo и undo</b> — быстрее всего, так делают почти все СУБД</td><td>нужен undo</td></tr>
          <tr><th>No-steal</th><td>нужен redo</td><td>ничего не нужно, но очень медленно и требует огромного буфера</td></tr>
        </tbody>
      </table>
      <p>Терминология и классификация — у Хердера и Ройтера <Cite id="harder1983" />.</p>

      <h2>Журнал упреждающей записи (WAL)</h2>
      <p>Каждое изменение сначала описывается в последовательном журнале. Каждой записи — возрастающий номер <b>LSN</b> (log sequence number). Запись об обновлении содержит транзакцию, страницу, старое значение (для undo) и новое (для redo). Два правила:</p>
      <ol>
        <li><b>Правило WAL:</b> страница может быть записана на диск, только если журнал до её <code>pageLSN</code> (LSN последнего изменения страницы) уже на диске. Иначе после сбоя на диске окажется изменение, которое нечем откатить.</li>
        <li><b>Правило фиксации:</b> транзакция считается зафиксированной, когда на диске её запись COMMIT (и все предыдущие записи журнала). Это одна последовательная запись + <code>fsync</code>, а не сброс десятков страниц.</li>
      </ol>
      <Callout type="tip" title="Групповая фиксация">
        <p><code>fsync</code> стоит от сотен микросекунд (NVMe) до миллисекунд. Если сотни транзакций фиксируются одновременно, СУБД сбрасывает их записи COMMIT одним <code>fsync</code> (group commit). В PostgreSQL можно отказаться от ожидания <code>fsync</code> (<code>synchronous_commit = off</code>): транзакции быстрее, но при сбое можно потерять последние доли секунды подтверждённых транзакций (без порчи базы).</p>
      </Callout>

      <h2>ARIES</h2>
      <p>Алгоритм восстановления ARIES (Мохан и др., IBM <Cite id="mohan1992" />) — основа восстановления в DB2, SQL Server и многих других; в PostgreSQL используется упрощённая схема с одной redo-фазой (undo не нужен благодаря MVCC: версии незафиксированных транзакций просто невидимы). Три фазы:</p>
      <ol>
        <li><b>Анализ</b>: от последней контрольной точки вперёд по журналу — какие транзакции были активны в момент сбоя (проигравшие) и какие страницы могли быть грязными.</li>
        <li><b>Redo — «повтор истории»</b>: применить <i>все</i> изменения журнала (в том числе проигравших!) к страницам, у которых <M t={r`\text{pageLSN} < \text{LSN записи}`} />. После этого база в точности в состоянии момента сбоя. Сравнение LSN делает redo идемпотентным: повторный сбой во время восстановления безопасен.</li>
        <li><b>Undo</b>: откатить изменения проигравших транзакций в обратном порядке. Каждый откат сам записывается в журнал как <b>CLR</b> (compensation log record), чтобы при сбое во время undo не откатывать дважды.</li>
      </ol>
      <CrashWidget />

      <h2>Контрольные точки</h2>
      <p>Без них восстановление читало бы журнал с начала времён. Контрольная точка записывает в журнал список активных транзакций и грязных страниц (с LSN первого изменения). Восстановление стартует от неё, а журнал до минимального LSN грязных страниц можно удалить или архивировать. В ARIES контрольная точка «нечёткая» (fuzzy): работа базы во время неё не останавливается.</p>

      <h2>Тонкости реального железа</h2>
      <ul>
        <li><b>Разорванные страницы.</b> Страница 8 КБ пишется несколькими секторами, сбой посреди записи оставит половину старой, половину новой. PostgreSQL после каждой контрольной точки пишет в журнал полный образ страницы при первом её изменении (<code>full_page_writes</code>); InnoDB использует doublewrite buffer; контрольные суммы страниц обнаруживают порчу.</li>
        <li><b><code>fsync</code> может лгать.</b> Диски с кэшем записи без защиты от потери питания подтверждают запись раньше, чем она реально случилась. Для БД нужны диски с честным сбросом кэша или с батареей/конденсаторами.</li>
        <li><b>Репликация через журнал.</b> Журнал — полная история изменений. Передавая его на другой сервер и проигрывая там redo, получают реплику (физическая репликация PostgreSQL) — об этом в главе 10.</li>
      </ul>
      <Code title="python — минимальный WAL: запись с fsync и проигрывание после сбоя">{`
import json, os

class WAL:
    def __init__(self, path):
        self.f = open(path, "a+", encoding="utf-8")

    def append(self, record):
        self.f.write(json.dumps(record) + "\\n")

    def commit(self, txid):
        self.append({"type": "commit", "tx": txid})
        self.f.flush()
        os.fsync(self.f.fileno())            # только после этого можно отвечать клиенту «OK»

    def replay(self):
        self.f.seek(0)
        records = []
        for line in self.f:
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:     # оборванная последняя строка — сбой посреди записи
                break
        committed = {r["tx"] for r in records if r["type"] == "commit"}
        state = {}
        for r in records:                    # redo только зафиксированных (no-steal упрощение)
            if r["type"] == "set" and r["tx"] in committed:
                state[r["key"]] = r["value"]
        return state
`}</Code>
      <Quiz q="Почему redo в ARIES применяет изменения и проигравших транзакций, которые потом всё равно откатятся?" options={['Это ошибка алгоритма', 'Чтобы восстановить точное состояние момента сбоя («повтор истории»); после этого undo работает так же, как обычный откат', 'Так быстрее', 'Чтобы проверить контрольные суммы']} answer={1}
        explain="Повтор истории сильно упрощает логику, особенно при блокировках на уровне строк, когда на одной странице есть изменения и победителей, и проигравших." />
      <Quiz q="Клиент получил «COMMIT OK», через 1 мс пропало питание. Страницы с изменениями на диск не попали. Что после перезапуска?" options={['Транзакция потеряна', 'Транзакция восстановлена из журнала на фазе redo', 'База повреждена', 'Зависит от индексов']} answer={1}
        explain="COMMIT OK отправляется только после fsync журнала. Всё нужное для redo уже на диске." />
    </>
  );
}
