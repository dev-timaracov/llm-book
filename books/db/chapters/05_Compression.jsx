import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';
import { makeRng } from '@shared/rng.js';
import colSrc from '../python/colcompress.py?raw';

const bits = (x) => Math.max(1, Math.ceil(Math.log2(Number(x) + 1)));

function genColumn(kind, n, rng) {
  if (kind === 'time') { let t = 1700000000000; return Array.from({ length: n }, () => (t += [1000, 1000, 1000, 999, 1001][Math.floor(rng.rand() * 5)])); }
  if (kind === 'country_sorted') return Array.from({ length: n }, () => ['RU', 'RU', 'RU', 'KZ', 'BY', 'DE', 'US'][Math.floor(rng.rand() * 7)]).sort();
  if (kind === 'country') return Array.from({ length: n }, () => ['RU', 'RU', 'RU', 'KZ', 'BY', 'DE', 'US'][Math.floor(rng.rand() * 7)]);
  if (kind === 'price') return Array.from({ length: n }, () => 100 + Math.floor(rng.rand() * 4900));
  if (kind === 'status') { const out = []; while (out.length < n) { const v = ['new', 'paid', 'shipped', 'done'][Math.floor(rng.rand() * 4)]; const len = 1 + Math.floor(rng.rand() * 40); for (let i = 0; i < len && out.length < n; i++) out.push(v); } return out; }
  return Array.from({ length: n }, () => Math.floor(rng.rand() * 2 ** 31) * 2 ** 20 + Math.floor(rng.rand() * 2 ** 20));
}

function encodeAll(col) {
  const n = col.length, isStr = typeof col[0] === 'string';
  const plain = isStr ? col.reduce((s, v) => s + v.length + 2, 0) : n * 8;
  const vsize = isStr ? plain / n : 8;
  const runs = []; for (const v of col) { if (runs.length && runs[runs.length - 1][0] === v) runs[runs.length - 1][1]++; else runs.push([v, 1]); }
  const rle = runs.length * (vsize + 4);
  const dict = [...new Set(col)].sort();
  const dictSize = dict.reduce((s, v) => s + (isStr ? v.length + 2 : 8), 0) + Math.ceil((n * bits(dict.length - 1)) / 8);
  const res = [['без сжатия', plain], ['RLE', rle], ['словарь + упаковка бит', dictSize]];
  const out = { runs, dict, isStr };
  if (!isStr) {
    const forSize = (arr) => { let s = 0; for (let i = 0; i < arr.length; i += 1024) { const b = arr.slice(i, i + 1024); const lo = Math.min(...b), hi = Math.max(...b); s += 11 + Math.ceil((b.length * bits(hi - lo)) / 8); } return s; };
    const deltas = col.slice(1).map((v, i) => v - col[i]);
    res.push(['FOR + упаковка бит', forSize(col)]);
    res.push(['дельта + FOR', 8 + forSize(deltas)]);
    const lo = Math.min(...col.slice(0, 1024)), hi = Math.max(...col.slice(0, 1024));
    out.forInfo = { lo, width: bits(hi - lo) };
    out.deltas = deltas;
  }
  return { res, plain, ...out };
}

function CompressionWidget() {
  const [kind, setKind] = useState('time');
  const [n, setN] = useState(10000);
  const col = useMemo(() => genColumn(kind, n, makeRng(4)), [kind, n]);
  const e = useMemo(() => encodeAll(col), [col]);
  const best = Math.min(...e.res.slice(1).map((x) => x[1]));
  const kinds = [['time', 'время событий'], ['country_sorted', 'страна (сорт.)'], ['country', 'страна (вперемешку)'], ['status', 'статус (серии)'], ['price', 'цена 100–5000'], ['hash', 'случайные хеши']];
  return (
    <Widget title="Сжимаем колонку разными схемами">
      <div className="controls">{kinds.map(([k, l]) => <button key={k} className={'btn small' + (k === kind ? ' primary' : '')} onClick={() => setKind(k)}>{l}</button>)}</div>
      <Slider label="значений" value={n} min={1000} max={50000} step={1000} onChange={setN} />
      <p className="mono small" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>первые значения: {col.slice(0, 8).join(', ')} …</p>
      {e.res.map(([name, size]) => (
        <div key={name} className="bar-row">
          <span className="lbl" style={{ width: 170, fontFamily: 'inherit' }}>{name}</span>
          <span className="track"><span className="fill" style={{ width: `${Math.min(100, (100 * size) / e.plain)}%`, display: 'block', background: size === best ? 'var(--green)' : size > e.plain ? 'var(--red)' : undefined }} /></span>
          <span className="val" style={{ width: 120 }}>{size >= 1e6 ? fmt(size / 1e6, 2) + ' МБ' : fmt(size / 1e3, 1) + ' КБ'} ×{fmt(e.plain / size, 1)}</span>
        </div>
      ))}
      <div className="small" style={{ marginTop: 8 }}>
        <div><b>RLE:</b> <span className="mono">{e.runs.slice(0, 4).map(([v, c]) => `(${v}×${c})`).join(' ')}{e.runs.length > 4 ? ' …' : ''}</span> — серий: {e.runs.length}</div>
        <div><b>Словарь:</b> <span className="mono">{e.dict.length <= 8 ? e.dict.map((v, i) => `${i}=${v}`).join(', ') : `${e.dict.length} различных значений`}</span> → код занимает {bits(e.dict.length - 1)} бит</div>
        {e.forInfo && <div><b>FOR (1-й блок):</b> минимум {e.forInfo.lo}, смещения укладываются в {e.forInfo.width} бит вместо 64</div>}
        {e.deltas && <div><b>Дельты:</b> <span className="mono">{e.deltas.slice(0, 8).join(', ')} …</span></div>}
      </div>
      <p className="small muted">Красный — «сжатие» увеличило размер. Схему выбирают по статистике колонки (часто — автоматически для каждого блока), и схемы можно комбинировать: словарь, потом RLE по кодам, потом упаковка бит.</p>
    </Widget>
  );
}

function ZoneMapWidget() {
  const [lo, setLo] = useState(5200);
  const [hi, setHi] = useState(5400);
  const blocks = useMemo(() => {
    const rng = makeRng(8);
    // данные почти отсортированы по времени вставки (как order_id) — зоны узкие
    return Array.from({ length: 24 }, (_, i) => { const a = i * 400 + Math.floor(rng.rand() * 60); return [a, a + 380 + Math.floor(rng.rand() * 80)]; });
  }, []);
  const hit = blocks.map(([a, b]) => !(b < lo || a > hi));
  return (
    <Widget title="Zone maps: пропуск блоков по min/max">
      <div className="controls">
        <Slider label="WHERE id ≥" value={lo} min={0} max={10000} step={50} onChange={(v) => { setLo(v); if (v > hi) setHi(v); }} />
        <Slider label="AND id ≤" value={hi} min={0} max={10000} step={50} onChange={(v) => { setHi(v); if (v < lo) setLo(v); }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {blocks.map(([a, b], i) => <div key={i} className="mono" style={{ fontSize: 10, padding: '3px 4px', borderRadius: 4, border: '1px solid var(--border)', background: hit[i] ? 'var(--amber-soft)' : 'var(--bg-soft)', opacity: hit[i] ? 1 : 0.5 }}>{a}–{b}</div>)}
      </div>
      <div className="stats"><Stat k="блоков читаем" v={`${hit.filter(Boolean).length} из ${blocks.length}`} /></div>
      <p className="small muted">Для каждого блока хранится минимум и максимум колонки (в Parquet — в метаданных страниц и групп строк, в ClickHouse — «засечки» первичного индекса). Блоки, чей диапазон не пересекается с условием, не читаются и не распаковываются. Работает, только если данные хоть как-то упорядочены по колонке.</p>
    </Widget>
  );
}

export default function Compression() {
  return (
    <>
      <h1>Сжатие колонок</h1>
      <p className="lead">В колоночном хранилище значения одного типа и смысла лежат подряд. Их можно сжать в разы и даже в тысячи раз — и, что важнее, часто обрабатывать, не распаковывая.</p>

      <h2>Зачем сжимать</h2>
      <p>
        Аналитический запрос упирается в пропускную способность: диска, сети, памяти. Сжатие в 5 раз означает в 5 раз меньше байт на чтение — если распаковка быстрее, чем сэкономленное время чтения. Поэтому колоночные СУБД используют
        <b> лёгкие</b> схемы, которые распаковываются со скоростью гигабайты в секунду на ядро, а тяжёлые универсальные (zstd, LZ4) применяют поверх или для холодных данных. Абади, Мэдден и Феррейра <Cite id="abadi2006" /> показали, что главный выигрыш — в возможности исполнять операторы прямо над сжатыми данными.
      </p>

      <h2>Основные схемы</h2>
      <ul>
        <li><b>RLE</b> (run-length encoding): последовательность одинаковых значений → <M t={r`(v, \text{длина})`} />. Идеальна для отсортированных колонок с повторами — отсюда важность порядка сортировки в колоночных СУБД (проекции C-Store <Cite id="stonebraker2005cstore" />, ключ сортировки MergeTree в ClickHouse).</li>
        <li><b>Словарь</b>: различные значения → номера 0..k−1; колонка хранит номера. Строки «Москва» превращаются в 3-битные коды. Отсортированный словарь сохраняет порядок: <code>WHERE city &lt; 'М'</code> можно проверять по кодам.</li>
        <li><b>Упаковка бит</b> (bit-packing): число из диапазона <M t={r`[0, 2^b)`} /> занимает ровно <M t="b" /> бит. SIMD-реализации распаковывают миллиарды целых в секунду <Cite id="lemire2015" />.</li>
        <li><b>FOR</b> (frame of reference): вычесть минимум блока, остатки упаковать. <b>PFOR</b> Зуковски и др. <Cite id="zukowski2006" /> выносит редкие выбросы в отдельный список, чтобы один большой элемент не раздувал ширину всего блока.</li>
        <li><b>Дельта-кодирование</b>: хранить разности соседей — для времени, автоинкрементов, отсортированных колонок. Дельта-от-дельты и XOR соседних чисел с плавающей точкой — основа Gorilla <Cite id="pelkonen2015" />.</li>
        <li><b>Строки</b>: помимо словаря, FSST <Cite id="boncz2020" /> заменяет частые подстроки однобайтовыми кодами и сохраняет случайный доступ к каждой строке.</li>
      </ul>
      <Eq t={r`\text{размер}_{\text{FOR}} \approx n\cdot\lceil\log_2(\max - \min + 1)\rceil\ \text{бит},\qquad \text{размер}_{\text{RLE}} \approx (\text{число серий})\cdot(|v| + |\text{длина}|)`} />
      <CompressionWidget />

      <h2>Вычисления над сжатыми данными</h2>
      <ul>
        <li><code>count(*) WHERE country = 'RU'</code> на RLE — сумма длин подходящих серий: работа пропорциональна числу серий, а не строк.</li>
        <li>Фильтр по словарной колонке: значение ищется в словаре один раз, дальше сравниваются маленькие целые коды (часто SIMD-ом сразу по 32–64 штуки).</li>
        <li><code>sum</code> по FOR-блоку: <M t={r`\sum (\min + d_i) = n\cdot\min + \sum d_i`} />.</li>
        <li><b>Позднее склеивание (late materialization)</b>: операторы передают друг другу списки позиций строк, а значения остальных колонок достают только для прошедших фильтр.</li>
      </ul>
      <ZoneMapWidget />

      <h2>Реализация</h2>
      <Code title="books/db/python/colcompress.py" collapse>{colSrc}</Code>
      <Code lang="bash" title="вывод python colcompress.py (сокращён)">{`
метка времени (мс), отсортирована (100,000 значений)
  zlib (универсальный)      267,847 байт   ×   3.0
  FOR + биты                251,078 байт   ×   3.2
  дельта + FOR               26,086 байт   ×  30.7  ← лучший
страна (отсортирована) (100,000 значений)
  zlib (универсальный)          442 байт   × 905.0
  RLE                            64 байт   ×6250.0  ← лучший
страна (вперемешку) (100,000 значений)
  zlib (универсальный)       52,046 байт   ×   7.7
  словарь + биты             37,532 байт   ×  10.7  ← лучший
цена, 100..5000 (100,000 значений)
  FOR + биты                163,578 байт   ×   4.9  ← лучший
случайные хеши (100,000 значений)
  zlib (универсальный)      800,251 байт   ×   1.0
`}</Code>
      <p className="small muted">Специализированная схема, выбранная под данные, обгоняет универсальный zlib — и при этом распаковывается на порядки быстрее. Случайные данные не сжимает ничто: это прямое следствие теории информации.</p>
      <Quiz q="Колонка «страна» в таблице, отсортированной по времени заказа. Какая схема, скорее всего, лучше?" options={['RLE', 'Словарь + упаковка бит', 'Дельта', 'FOR']} answer={1}
        explain="Значений мало, но они перемешаны — серий почти нет, RLE бесполезен. Словарь сжимает каждое значение до нескольких бит." />
      <Quiz q="Почему порядок сортировки таблицы так важен для колоночных СУБД?" options={['Иначе нельзя построить индекс', 'Отсортированные колонки образуют длинные серии (RLE) и узкие диапазоны блоков (zone maps) — и сжатие, и пропуск блоков резко улучшаются', 'Так требует SQL', 'Он не важен']} answer={1}
        explain="ClickHouse, Vertica, Snowflake (кластеризация) — все опираются на это." />
    </>
  );
}
