import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';
import { LineChart } from '@shared/charts.jsx';
import { makeRng } from '@shared/rng.js';

// --- генераторы нагрузки ---
function workload(kind, n, pages, seed) {
  const rng = makeRng(seed);
  // распределение Ципфа: страница i запрашивается с вероятностью ∝ 1/(i+1)^s
  const zipf = (s) => {
    const w = Array.from({ length: pages }, (_, i) => 1 / Math.pow(i + 1, s));
    const tot = w.reduce((a, b) => a + b, 0);
    const cdf = []; let c = 0;
    for (const x of w) { c += x / tot; cdf.push(c); }
    return () => { const u = rng.rand(); let lo = 0, hi = pages - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; } return lo; };
  };
  const out = [];
  if (kind === 'zipf') { const z = zipf(1.0); for (let i = 0; i < n; i++) out.push(z()); }
  if (kind === 'uniform') for (let i = 0; i < n; i++) out.push(Math.floor(rng.rand() * pages));
  if (kind === 'scan') {
    // «горячие» 50 страниц (индекс, справочники) + периодический полный скан большой таблицы
    const hot = zipf(0.8);
    let i = 0;
    while (out.length < n) {
      for (let k = 0; k < 300 && out.length < n; k++) out.push(hot() % 50);
      for (let p = 0; p < 400 && out.length < n; p++) out.push(1000 + ((i * 400 + p) % 4000));
      i++;
    }
  }
  return out;
}

function simulate(policy, trace, cap) {
  let hits = 0;
  if (policy === 'FIFO' || policy === 'LRU') {
    const m = new Map(); // порядок вставки Map = очередь
    for (const p of trace) {
      if (m.has(p)) { hits++; if (policy === 'LRU') { m.delete(p); m.set(p, 1); } continue; }
      if (m.size >= cap) m.delete(m.keys().next().value);
      m.set(p, 1);
    }
  } else if (policy === 'Clock') {
    const frames = new Array(cap).fill(-1), ref = new Array(cap).fill(0), where = new Map();
    let hand = 0;
    for (const p of trace) {
      if (where.has(p)) { hits++; ref[where.get(p)] = 1; continue; }
      while (frames[hand] !== -1 && ref[hand]) { ref[hand] = 0; hand = (hand + 1) % cap; } // «второй шанс»
      if (frames[hand] !== -1) where.delete(frames[hand]);
      frames[hand] = p; ref[hand] = 1; where.set(p, hand); hand = (hand + 1) % cap;
    }
  } else if (policy === 'LRU-2') {
    // вытесняем страницу с самым старым ПРЕДПОСЛЕДНИМ обращением (у видевших одно обращение — −∞)
    const hist = new Map(), inPool = new Set();
    trace.forEach((p, t) => {
      const h = hist.get(p) || [-Infinity, -Infinity];
      hist.set(p, [h[1], t]);
      if (inPool.has(p)) { hits++; return; }
      if (inPool.size >= cap) {
        let victim = null, best = Infinity, bestLast = Infinity;
        for (const q of inPool) { const [k2, k1] = hist.get(q); if (k2 < best || (k2 === best && k1 < bestLast)) { best = k2; bestLast = k1; victim = q; } }
        inPool.delete(victim);
      }
      inPool.add(p);
    });
  } else if (policy === 'OPT') {
    // оптимальный алгоритм Белади: вытесняем страницу, которая понадобится позже всех (нужно знать будущее)
    const next = new Array(trace.length), last = new Map();
    for (let t = trace.length - 1; t >= 0; t--) { next[t] = last.has(trace[t]) ? last.get(trace[t]) : Infinity; last.set(trace[t], t); }
    const nextOf = new Map(), pool = new Set();
    trace.forEach((p, t) => {
      if (pool.has(p)) { hits++; nextOf.set(p, next[t]); return; }
      if (pool.size >= cap) { let v = null, far = -1; for (const q of pool) if (nextOf.get(q) > far) { far = nextOf.get(q); v = q; } pool.delete(v); }
      pool.add(p); nextOf.set(p, next[t]);
    });
  }
  return hits / trace.length;
}

const POLICIES = ['FIFO', 'LRU', 'Clock', 'LRU-2', 'OPT'];
const COLORS = { FIFO: 'var(--c6)', LRU: 'var(--c1)', Clock: 'var(--c5)', 'LRU-2': 'var(--c3)', OPT: 'var(--muted)' };

function BufferSim() {
  const [kind, setKind] = useState('scan');
  const [cap, setCap] = useState(120);
  const trace = useMemo(() => workload(kind, 12000, 5000, 3), [kind]);
  const res = useMemo(() => Object.fromEntries(POLICIES.map((p) => [p, simulate(p, trace, cap)])), [trace, cap]);
  const curve = useMemo(() => {
    const sizes = [20, 40, 60, 100, 150, 200, 300, 400, 600];
    return POLICIES.map((p) => ({ data: sizes.map((s) => [s, 100 * simulate(p, trace, s)]), color: COLORS[p], label: p, dashed: p === 'OPT' }));
  }, [trace]);
  return (
    <Widget title="Симулятор буферного пула: доля попаданий в кэш">
      <div className="controls">
        {[['scan', 'горячие страницы + полные сканы'], ['zipf', 'Ципф (популярные страницы)'], ['uniform', 'равномерно случайно']].map(([k, l]) => (
          <button key={k} className={'btn small' + (k === kind ? ' primary' : '')} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      <Slider label="размер пула, страниц" value={cap} min={10} max={600} step={10} onChange={setCap} />
      <div className="stats">{POLICIES.map((p) => <Stat key={p} k={p} v={fmt(100 * res[p], 1) + '%'} />)}</div>
      <LineChart height={240} series={curve} xLabel="размер пула, страниц" yLabel="попаданий, %" extra={(sx) => <line x1={sx(cap)} x2={sx(cap)} y1={0} y2={400} stroke="var(--amber)" strokeDasharray="4 3" />} />
      <p className="small muted">12 000 обращений к 5000 страницам. В режиме «сканы» периодический полный проход по большой таблице вымывает из LRU горячие страницы (<b>sequential flooding</b>): каждая страница скана самая «свежая», хотя больше не понадобится. LRU-2 помнит два последних обращения и отличает разово прочитанное от действительно популярного. OPT (алгоритм Белади) знает будущее — это недостижимая верхняя граница.</p>
    </Widget>
  );
}

export default function Buffer() {
  return (
    <>
      <h1>Буферный пул</h1>
      <p className="lead">Каждое чтение с диска в сотни раз дороже чтения из памяти. Буферный пул — кэш страниц, через который проходит любой доступ к данным. От того, какие страницы он держит, зависит почти вся производительность.</p>

      <h2>Устройство</h2>
      <ul>
        <li><b>Кадры (frames)</b> — массив ячеек размером со страницу в общей памяти. В PostgreSQL их число задаёт <code>shared_buffers</code>, в InnoDB — <code>innodb_buffer_pool_size</code>.</li>
        <li><b>Таблица страниц</b> — хеш-таблица «номер страницы → кадр».</li>
        <li><b>Счётчик закреплений (pin count)</b> — сколько потоков сейчас работают со страницей. Закреплённую страницу вытеснять нельзя.</li>
        <li><b>Флаг «грязная»</b> — страница изменена в памяти и отличается от диска. Перед вытеснением её нужно записать, причём только <i>после</i> того, как на диск попали записи журнала про это изменение (правило WAL, глава 13).</li>
      </ul>
      <p>Запрос страницы: если она в таблице — закрепить и вернуть (<b>попадание</b>). Иначе найти свободный кадр или выбрать «жертву» по политике вытеснения, при необходимости записать жертву на диск, прочитать нужную страницу (<b>промах</b>).</p>
      <Eq t={r`T_{\text{доступа}} \approx h\cdot T_{\text{память}} + (1-h)\cdot T_{\text{диск}}`} label="h — доля попаданий" />
      <p>При <M t={r`T_{диск}/T_{память}\approx 1000`} /> разница между <M t="h=0.99" /> и <M t="h=0.95" /> — это разница в 5 раз по средней задержке. Каждый процент попаданий важен.</p>

      <h2>Политики вытеснения</h2>
      <ul>
        <li><b>LRU</b> — вытеснить страницу, к которой дольше всего не обращались. Хорошо для «локальной» нагрузки, но требует обновлять список на каждом обращении (узкое место при многопоточности).</li>
        <li><b>Clock</b> (второй шанс) — приближение LRU: у каждого кадра бит обращения, «стрелка» обходит кадры по кругу, сбрасывает биты и вытесняет первый кадр с нулевым битом. Дёшево и почти так же хорошо. PostgreSQL использует вариант с небольшим счётчиком использования вместо бита.</li>
        <li><b>LRU-K</b> (О'Нил, О'Нил, Вайкум <Cite id="oneil1993" />) — оценивать страницу по времени <M t="K" />-го с конца обращения. Страница, к которой обратились один раз (сканом), проигрывает странице с регулярными обращениями.</li>
        <li><b>ARC</b> <Cite id="megiddo2003" /> — адаптивно делит кэш между «недавно» и «часто» используемыми страницами.</li>
      </ul>
      <BufferSim />
      <Callout type="note" title="Как с флудингом борются на практике">
        <p>Помимо умных политик, СУБД различают типы доступа. PostgreSQL для больших последовательных сканов использует маленькое кольцо буферов (ring buffer), чтобы скан не вымывал основной пул. InnoDB вставляет новые страницы в середину LRU-списка («старую» часть), и страница попадает в «молодую» часть, только если к ней обратились повторно через некоторое время.</p>
      </Callout>

      <h2>Почему не положиться на кэш ОС</h2>
      <p>Операционная система тоже кэширует файлы (page cache). Но СУБД знает больше: какой запрос идёт (скан или точечный поиск), какие страницы скоро понадобятся (упреждающее чтение по плану), и главное — <b>когда страницу можно записать</b>. Порядок записи страниц и журнала критичен для восстановления (глава 13), а ОС сбрасывает грязные страницы когда хочет. Поэтому многие СУБД управляют буферами сами и читают в обход кэша ОС (<code>O_DIRECT</code> в InnoDB); PostgreSQL использует и свой пул, и кэш ОС одновременно. Подробное обсуждение — у Хеллерштейна и др. <Cite id="hellerstein2007" />.</p>
      <Callout type="history" title="Сколько времени СУБД тратит на «накладные расходы»">
        <p>Харизопулос и др. <Cite id="harizopoulos2008" /> разобрали СУБД Shore, когда все данные помещаются в память: полезная работа заняла лишь малую долю инструкций, а основная часть ушла на буферный пул, блокировки, журнал и защёлки. Отсюда выросли in-memory СУБД вроде H-Store/VoltDB (глава 16).</p>
      </Callout>

      <Code title="python — минимальный буферный пул с LRU">{`
from collections import OrderedDict

class BufferPool:
    def __init__(self, disk, capacity):
        self.disk, self.capacity = disk, capacity      # disk: объект с read_page(n) / write_page(n, data)
        self.frames = OrderedDict()                    # page_no -> [data, dirty, pins]; порядок = LRU
        self.hits = self.misses = 0

    def fetch(self, page_no):
        if page_no in self.frames:
            self.hits += 1
            self.frames.move_to_end(page_no)           # стала самой «свежей»
        else:
            self.misses += 1
            if len(self.frames) >= self.capacity:
                self._evict()
            self.frames[page_no] = [self.disk.read_page(page_no), False, 0]
        self.frames[page_no][2] += 1                   # pin
        return self.frames[page_no][0]

    def unpin(self, page_no, dirty=False):
        f = self.frames[page_no]
        f[2] -= 1
        f[1] = f[1] or dirty

    def _evict(self):
        for page_no, (data, dirty, pins) in self.frames.items():   # от самой старой
            if pins == 0:
                if dirty:
                    self.disk.write_page(page_no, data)  # в настоящей СУБД — только после сброса WAL!
                del self.frames[page_no]
                return
        raise RuntimeError("все страницы закреплены — пул слишком мал")
`}</Code>
      <Quiz q="Почему LRU плохо справляется с периодическими полными сканами таблицы?" options={['Скан слишком быстрый', 'Каждая страница скана становится «самой свежей» и вытесняет действительно популярные страницы, хотя сама больше не понадобится', 'LRU не умеет читать последовательно', 'Из-за грязных страниц']} answer={1}
        explain="Это и есть sequential flooding. LRU-K, ARC и кольцевые буферы для сканов решают проблему." />
      <Quiz q="Можно ли вытеснить грязную страницу, если запись журнала о её изменении ещё не на диске?" options={['Да, это безопасно', 'Нет: сначала журнал, потом страница (правило WAL)', 'Да, если страница не закреплена', 'Только при контрольной точке']} answer={1}
        explain="Если страница попадёт на диск раньше журнала и произойдёт сбой, нельзя будет откатить незафиксированное изменение. Подробно — в главе 13." />
    </>
  );
}
