import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';
import { LineChart } from '@shared/charts.jsx';
import { makeRng } from '@shared/rng.js';
import lsmSrc from '../python/lsm.py?raw';

// Упрощённая модель LSM: прогоны (runs) — множества ключей; считаем записанные на диск ключи.
function simulateLSM({ policy, T, mem, inserts, keySpace, seed }) {
  const rng = makeRng(seed);
  const levels = []; // levels[i] = массив прогонов (Set)
  let memtable = new Set(), written = 0, user = 0, maxRuns = 0;
  const cap = (i) => mem * Math.pow(T, i + 1);
  const merge = (runs) => { const s = new Set(); runs.forEach((x) => x.forEach((k) => s.add(k))); return s; };
  const push = (i, run) => {
    levels[i] = levels[i] || [];
    if (policy === 'leveling') {
      // в уровне ровно один прогон: новый сливается с ним, уровень переписывается целиком
      const m = merge([...levels[i], run]);
      written += m.size;
      levels[i] = [m];
      if (m.size > cap(i)) { levels[i] = []; push(i + 1, m); }
    } else {
      // tiering: копим до T прогонов, потом сливаем их в один и отправляем ниже
      levels[i].push(run);
      if (levels[i].length >= T) { const m = merge(levels[i]); written += m.size; levels[i] = []; push(i + 1, m); }
    }
  };
  const timeline = [];
  for (let n = 0; n < inserts; n++) {
    memtable.add(Math.floor(rng.rand() * keySpace)); user++;
    if (memtable.size >= mem) { written += memtable.size; push(0, memtable); memtable = new Set(); }
    const runs = levels.reduce((a, l) => a + (l ? l.length : 0), 0);
    maxRuns = Math.max(maxRuns, runs);
    if (n % Math.ceil(inserts / 60) === 0) timeline.push([n, written / Math.max(1, user)]);
  }
  const stored = levels.reduce((a, l) => a + (l ? l.reduce((b, x) => b + x.size, 0) : 0), 0) + memtable.size;
  const unique = merge([...levels.flat().filter(Boolean), memtable]).size;
  return { levels, wa: written / user, runs: levels.reduce((a, l) => a + (l ? l.length : 0), 0), maxRuns, space: stored / Math.max(1, unique), timeline, memtable: memtable.size };
}

function LSMWidget() {
  const [policy, setPolicy] = useState('leveling');
  const [T, setT] = useState(4);
  const [mem, setMem] = useState(200);
  const [inserts, setInserts] = useState(20000);
  const [keySpace, setKeySpace] = useState(50000);
  const res = useMemo(() => simulateLSM({ policy, T, mem, inserts, keySpace, seed: 5 }), [policy, T, mem, inserts, keySpace]);
  const other = useMemo(() => simulateLSM({ policy: policy === 'leveling' ? 'tiering' : 'leveling', T, mem, inserts, keySpace, seed: 5 }), [policy, T, mem, inserts, keySpace]);
  const maxSize = Math.max(1, ...res.levels.flat().filter(Boolean).map((x) => x.size));
  return (
    <Widget title="Симулятор LSM-дерева: уровни, компакция, усиление записи">
      <div className="controls">
        <button className={'btn small' + (policy === 'leveling' ? ' primary' : '')} onClick={() => setPolicy('leveling')}>leveling (RocksDB по умолчанию)</button>
        <button className={'btn small' + (policy === 'tiering' ? ' primary' : '')} onClick={() => setPolicy('tiering')}>tiering (Cassandra STCS)</button>
      </div>
      <div className="controls">
        <Slider label="коэффициент роста T" value={T} min={2} max={10} onChange={setT} />
        <Slider label="размер memtable, ключей" value={mem} min={50} max={1000} step={50} onChange={setMem} />
        <Slider label="вставок" value={inserts} min={1000} max={60000} step={1000} onChange={setInserts} />
        <Slider label="различных ключей" value={keySpace} min={1000} max={200000} step={1000} onChange={setKeySpace} />
      </div>
      <div style={{ fontSize: 13 }}>
        <div className="bar-row"><span className="lbl">memtable</span><span className="track"><span className="fill" style={{ width: `${(100 * res.memtable) / mem}%`, display: 'block', background: 'var(--c2)' }} /></span><span className="val">{res.memtable}</span></div>
        {res.levels.map((l, i) => (
          <div key={i} className="bar-row">
            <span className="lbl">L{i}</span>
            <span style={{ flex: 1, display: 'flex', gap: 3 }}>
              {(l || []).map((run, j) => <span key={j} title={`${run.size} ключей`} style={{ height: 16, width: `${Math.max(2, (90 * run.size) / maxSize)}%`, background: 'var(--c1)', borderRadius: 3, display: 'inline-block' }} />)}
              {(!l || !l.length) && <span className="muted">пусто</span>}
            </span>
            <span className="val">{(l || []).length} пр.</span>
          </div>
        ))}
      </div>
      <div className="stats">
        <Stat k="усиление записи (WA)" v={fmt(res.wa, 2) + '×'} />
        <Stat k="прогонов сейчас (≈ чтений на поиск)" v={res.runs} />
        <Stat k="макс. прогонов" v={res.maxRuns} />
        <Stat k="усиление места" v={fmt(res.space, 2) + '×'} />
        <Stat k={`WA у ${policy === 'leveling' ? 'tiering' : 'leveling'}`} v={fmt(other.wa, 2) + '×'} />
      </div>
      <LineChart height={180} series={[{ data: res.timeline, color: 'var(--c1)', label: 'WA по мере вставок' }]} xLabel="вставок" legend={false} />
      <p className="small muted">Усиление записи — сколько ключей записано на диск на каждый ключ, записанный пользователем. Leveling переписывает уровень при каждом слиянии: WA больше, зато в каждом уровне один прогон — быстрые чтения и мало дубликатов. Tiering сливает прогоны реже: WA меньше, но поиск проверяет больше прогонов, а старые версии ключей живут дольше (усиление места). Модель упрощённая: прогоны — множества ключей, без учёта размеров значений и WAL.</p>
    </Widget>
  );
}

function BloomWidget() {
  const [bpk, setBpk] = useState(10);
  const [kSel, setK] = useState(0);
  const kOpt = Math.max(1, Math.round(bpk * Math.LN2));
  const k = kSel || kOpt;
  const fp = Math.pow(1 - Math.exp(-k / bpk), k);
  const curve = Array.from({ length: 12 }, (_, i) => { const kk = i + 1; return [kk, 100 * Math.pow(1 - Math.exp(-kk / bpk), kk)]; });
  // живая демонстрация на маленьком фильтре
  const [words, setWords] = useState('кот пёс дом сон мяч лес');
  const [q, setQ] = useState('рыба');
  const m = 32, kk = 3;
  const hash = (s, seed) => { let h = 2166136261 ^ seed; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % m; };
  const pos = (s) => [0, 1, 2].map((i) => hash(s, i * 7919));
  const bits = new Array(m).fill(0);
  words.split(/\s+/).filter(Boolean).forEach((w) => pos(w).forEach((p) => (bits[p] = 1)));
  const qp = pos(q);
  const maybe = qp.every((p) => bits[p]);
  const truly = words.split(/\s+/).includes(q);
  return (
    <Widget title="Bloom-фильтр: «точно нет» или «возможно да»">
      <div className="row">
        <div className="col">
          <p className="small">Слова в фильтре: <input type="text" value={words} onChange={(e) => setWords(e.target.value)} style={{ width: '100%' }} /></p>
          <p className="small">Проверить: <input type="text" value={q} onChange={(e) => setQ(e.target.value.trim())} /></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, margin: '8px 0' }}>
            {bits.map((b, i) => <span key={i} className="mono" style={{ width: 18, textAlign: 'center', fontSize: 11, borderRadius: 3, background: qp.includes(i) ? (b ? 'var(--amber-soft)' : 'var(--red-soft)') : b ? 'var(--accent-soft)' : 'var(--bg-soft)', border: '1px solid var(--border)' }}>{b}</span>)}
          </div>
          <p className="small"><b>«{q}»</b>: биты {qp.join(', ')} → {maybe ? (truly ? 'возможно есть (и правда есть)' : 'возможно есть — ЛОЖНОЕ срабатывание!') : 'точно нет'}</p>
          <p className="small muted">m = {m} бит, k = {kk} хеш-функций. Добавьте побольше слов — фильтр «забьётся», и ложных срабатываний станет больше.</p>
        </div>
        <div className="col">
          <Slider label="бит на ключ (m/n)" value={bpk} min={2} max={20} onChange={setBpk} />
          <Slider label={`хеш-функций k (0 = оптимум ${kOpt})`} value={kSel} min={0} max={12} onChange={setK} />
          <div className="stats"><Stat k="вероятность ложного срабатывания" v={fmt(100 * fp, 3) + '%'} /><Stat k="k" v={k} /></div>
          <LineChart height={170} series={[{ data: curve, color: 'var(--c1)', points: true }]} xLabel="k" yLabel="ложных, %" legend={false} extra={(sx, sy) => <circle cx={sx(k)} cy={sy(100 * fp)} r={6} fill="var(--c2)" />} />
        </div>
      </div>
    </Widget>
  );
}

export default function LSM() {
  return (
    <>
      <h1>LSM-деревья и Bloom-фильтры</h1>
      <p className="lead">B+-дерево обновляет страницы на месте: каждая вставка — случайная запись. Если записей очень много, выгоднее никогда не перезаписывать данные, а только дописывать и периодически сливать. Так устроены LevelDB, RocksDB, Cassandra, HBase.</p>

      <h2>Идея</h2>
      <p>
        О'Нил и др. <Cite id="oneil1996" /> предложили Log-Structured Merge-Tree, развивая идею лог-структурированной файловой системы Розенблюма и Остерхаута <Cite id="rosenblum1992" />: превратить случайные записи в последовательные.
        Эту же схему использовал Bigtable <Cite id="chang2006" />, из которого выросли LevelDB и RocksDB.
      </p>
      <ol>
        <li><b>WAL.</b> Запись сначала дописывается в журнал (последовательно) — для долговечности.</li>
        <li><b>Memtable.</b> Затем — в отсортированную структуру в памяти (skip-list или красно-чёрное дерево).</li>
        <li><b>Flush.</b> Когда memtable заполнен, он целиком записывается на диск как <b>SSTable</b> (sorted string table) — неизменяемый отсортированный файл с индексом и Bloom-фильтром. Одна большая последовательная запись.</li>
        <li><b>Compaction.</b> SSTable накапливаются; фоновый процесс сливает их (как в сортировке слиянием), выбрасывая перезаписанные версии и удалённые ключи.</li>
      </ol>
      <p><b>Чтение</b>: memtable → SSTable от новых к старым, первая найденная версия — актуальная. <b>Удаление</b>: запись специального значения-«надгробия» (tombstone); реально ключ исчезнет только при компакции самого нижнего уровня.</p>

      <h2>Уровни и компакция</h2>
      <p>SSTable организованы по уровням, каждый следующий в <M t="T" /> раз больше. Две основные стратегии <Cite id="luo2020" />:</p>
      <ul>
        <li><b>Leveling</b>: на уровне один отсортированный прогон. Каждый ключ переписывается порядка <M t="T" /> раз на каждом из <M t="L" /> уровней: <M t={r`\text{WA}\approx T\cdot L`} />, зато поиск проверяет ≤ 1 прогон на уровень.</li>
        <li><b>Tiering</b>: на уровне до <M t="T" /> прогонов, которые сливаются разом: <M t={r`\text{WA}\approx L`} />, но поиск проверяет до <M t={r`T\cdot L`} /> прогонов.</li>
      </ul>
      <Eq t={r`L \approx \log_T\frac{N}{M_{\text{memtable}}}`} label="число уровней" />
      <LSMWidget />

      <h2>Bloom-фильтр</h2>
      <p>
        Поиск отсутствующего ключа (очень частая операция — например, проверка уникальности при вставке) пришлось бы делать во всех прогонах. Bloom <Cite id="bloom1970" /> предложил структуру, которая отвечает
        «точно нет» или «возможно да»: массив из <M t="m" /> бит и <M t="k" /> хеш-функций. Добавление — установить <M t="k" /> бит; проверка — все ли <M t="k" /> бит установлены.
      </p>
      <Eq t={r`p_{\text{ложн}} \approx \left(1 - e^{-kn/m}\right)^k,\qquad k_{\text{опт}} = \frac{m}{n}\ln 2,\qquad p_{\text{опт}} \approx 0.6185^{m/n}`} />
      <p>10 бит на ключ дают ≈1% ложных срабатываний; каждые следующие ~4.8 бита уменьшают их ещё в 10 раз. Даян и др. <Cite id="dayan2017" /> (Monkey) показали, что выгоднее давать разным уровням разное число бит: больше — маленьким верхним уровням.</p>
      <BloomWidget />

      <h2>B+-дерево или LSM</h2>
      <table>
        <thead><tr><th></th><th>B+-дерево</th><th>LSM-дерево</th></tr></thead>
        <tbody>
          <tr><td>Запись</td><td>случайная, на месте; WA ≈ размер страницы / размер строки</td><td>последовательная; WA от компакции (≈10–30 у leveling)</td></tr>
          <tr><td>Точечное чтение</td><td>предсказуемое: h чтений</td><td>несколько прогонов; спасают Bloom-фильтры и кэш</td></tr>
          <tr><td>Диапазон</td><td>отлично: идём по листьям</td><td>нужно слить итераторы всех прогонов</td></tr>
          <tr><td>Место</td><td>фрагментация страниц (~30% пустоты)</td><td>хорошо сжимается, но живут старые версии</td></tr>
          <tr><td>Где</td><td>PostgreSQL, MySQL/InnoDB, SQLite, Oracle</td><td>RocksDB, LevelDB, Cassandra, HBase, ScyllaDB, CockroachDB (Pebble)</td></tr>
        </tbody>
      </table>
      <p>Это частный случай гипотезы RUM <Cite id="athanassoulis2016" />: улучшая скорость записи, мы платим чтением или местом.</p>

      <h2>Реализация</h2>
      <p>Полное LSM-хранилище: журнал с <code>fsync</code>, memtable, SSTable с разреженным индексом и Bloom-фильтром, компакция, надгробия, восстановление после «падения».</p>
      <Code title="books/db/python/lsm.py" collapse>{lsmSrc}</Code>
      <Code lang="bash" title="вывод python lsm.py">{`
после 6000 операций: SSTable на диске: 1, в memtable: 476, сбросов 10, компакций 3
write amplification ≈ 2.97 (байт на диск / байт от пользователя)
  восстановление: из WAL проиграно 531 записей
после «падения» и перезапуска все данные на месте ✓
3000 запросов отсутствующих ключей → открытий файлов SSTable: 60 (без Bloom-фильтра было бы 6000; ожидаем ≈1% ложных срабатываний)
`}</Code>
      <p className="small muted">531 запись WAL против 476 ключей в memtable: часть ключей в журнале встречается несколько раз — при проигрывании выживает последняя версия.</p>
      <Quiz q="Почему в LSM удаление — это запись «надгробия», а не удаление ключа из файла?" options={['Так проще', 'SSTable неизменяемы; кроме того, в более старых прогонах может лежать старая версия ключа, и её надо «перекрыть»', 'Чтобы ускорить чтение', 'Из-за Bloom-фильтра']} answer={1}
        explain="Если просто убрать ключ из memtable, при чтении найдётся старая версия в нижнем уровне. Надгробие перекрывает её, пока компакция не уберёт оба." />
      <Quiz q="Bloom-фильтр ответил «возможно есть». Что дальше?" options={['Ключ точно есть', 'Нужно прочитать SSTable и проверить: это может быть ложное срабатывание', 'Ключа точно нет', 'Нужно перестроить фильтр']} answer={1}
        explain="Ложноотрицательных ответов не бывает, а ложноположительные — бывают с вероятностью p." />
    </>
  );
}
