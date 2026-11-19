import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';
import bpeSrc from '../python/bpe.py?raw';

const SAMPLE = 'низкий низкий низкий ниже нижний новый новый новейший широкий широкий шире старый старейший';
const COLORS = ['#ffd8a8', '#c5f6fa', '#d3f9d8', '#e5dbff', '#ffe3e3', '#fff3bf', '#d0ebff', '#f3d9fa'];

// BPE над символами (а не байтами) — чтобы слияния было удобно читать.
function trainBPE(text, nMerges) {
  const words = text.split(/(?=\s)/).filter(Boolean); // пробел приклеиваем к началу слова, как в GPT-2
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  let chunks = [...freq.entries()].map(([w, f]) => ({ toks: [...w], f }));
  const merges = [];
  for (let k = 0; k < nMerges; k++) {
    const pc = new Map();
    for (const { toks, f } of chunks) for (let i = 0; i < toks.length - 1; i++) { const key = toks[i] + '\u0000' + toks[i + 1]; pc.set(key, (pc.get(key) || 0) + f); }
    if (!pc.size) break;
    let best = null, bc = 0;
    for (const [key, c] of pc) if (c > bc) { best = key; bc = c; }
    if (bc < 2) break;
    const [a, b] = best.split('\u0000');
    merges.push({ a, b, count: bc });
    chunks = chunks.map(({ toks, f }) => {
      const out = [];
      for (let i = 0; i < toks.length; i++) {
        if (i < toks.length - 1 && toks[i] === a && toks[i + 1] === b) { out.push(a + b); i++; } else out.push(toks[i]);
      }
      return { toks: out, f };
    });
  }
  return merges;
}
function encode(text, merges) {
  const words = text.split(/(?=\s)/).filter(Boolean);
  const rank = new Map(merges.map((m, i) => [m.a + '\u0000' + m.b, i]));
  return words.flatMap((w) => {
    let toks = [...w];
    while (toks.length > 1) {
      let bi = -1, br = Infinity;
      for (let i = 0; i < toks.length - 1; i++) { const rr = rank.get(toks[i] + '\u0000' + toks[i + 1]); if (rr !== undefined && rr < br) { br = rr; bi = i; } }
      if (bi < 0) break;
      toks = [...toks.slice(0, bi), toks[bi] + toks[bi + 1], ...toks.slice(bi + 2)];
    }
    return toks;
  });
}

function BPEWidget() {
  const [text, setText] = useState(SAMPLE);
  const [n, setN] = useState(8);
  const all = useMemo(() => trainBPE(text, 60), [text]);
  const merges = all.slice(0, n);
  const toks = encode(text, merges);
  const vocab = new Set(toks);
  return (
    <Widget title="BPE шаг за шагом">
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <Slider label="число слияний" value={n} min={0} max={Math.max(1, all.length)} onChange={setN} />
      <div className="stats">
        <Stat k="символов" v={[...text].length} />
        <Stat k="токенов" v={toks.length} />
        <Stat k="сжатие" v={fmt([...text].length / toks.length, 2) + '×'} />
        <Stat k="разных токенов в тексте" v={vocab.size} />
      </div>
      <div style={{ lineHeight: 2 }}>
        {toks.map((t, i) => <span key={i} className="token" style={{ background: COLORS[i % COLORS.length], color: '#222' }}>{t.replace(/ /g, '␣')}</span>)}
      </div>
      <p className="small" style={{ marginTop: 10 }}><b>Выученные слияния</b> (в порядке обучения):</p>
      <div className="mono small" style={{ columns: 3, columnGap: 16 }}>
        {merges.map((m, i) => <div key={i}>{i + 1}. «{m.a.replace(/ /g, '␣')}» + «{m.b.replace(/ /g, '␣')}» ×{m.count}</div>)}
        {merges.length === 0 && <div className="muted">пока нет — только отдельные символы</div>}
      </div>
      <p className="small muted">Первыми сливаются самые частые пары («␣» + «н», «и» + «й»...), потом из них — более длинные куски: суффиксы «ий», «ейший», корни. Так BPE сам находит морфемы, хотя ничего о русской грамматике не знает.</p>
    </Widget>
  );
}

function BytesWidget() {
  const [s, setS] = useState('Кот 🐈 cat');
  const enc = new TextEncoder();
  const chars = [...s];
  return (
    <Widget title="Текст → байты UTF-8">
      <input type="text" value={s} onChange={(e) => setS(e.target.value)} style={{ width: '100%' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {chars.map((c, i) => {
          const b = [...enc.encode(c)];
          return (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 18 }}>{c === ' ' ? '␣' : c}</div>
              <div className="mono" style={{ fontSize: 11 }}>{b.join(' ')}</div>
            </div>
          );
        })}
      </div>
      <p className="small muted">Всего {enc.encode(s).length} байт на {chars.length} символов. Латиница — 1 байт, кириллица — 2, эмодзи — 4. Байтовый BPE стартует с 256 «буквами»-байтами, поэтому может закодировать что угодно, а частые многобайтовые последовательности быстро сливаются в один токен.</p>
    </Widget>
  );
}

export default function Tokenization() {
  return (
    <>
      <h1>Токенизация и BPE</h1>
      <p className="lead">Нейросеть работает с числами, а не с буквами. Токенизатор решает, на какие кусочки резать текст. Это решение влияет на длину контекста, скорость, качество и даже на то, почему LLM плохо считает буквы в словах.</p>

      <h2>Три уровня</h2>
      <table>
        <thead><tr><th>Уровень</th><th>Словарь</th><th>Плюсы</th><th>Минусы</th></tr></thead>
        <tbody>
          <tr><td>Символы</td><td>десятки–сотни</td><td>нет неизвестных слов, просто</td><td>длинные последовательности: внимание стоит <M t={r`O(T^2)`} />, модель тратит ресурсы на «склеивание» букв</td></tr>
          <tr><td>Слова</td><td>сотни тысяч</td><td>короткие последовательности</td><td>огромный словарь, неизвестные слова (<code>&lt;unk&gt;</code>), «кот» и «коты» не связаны</td></tr>
          <tr><td>Подслова (BPE, WordPiece, Unigram)</td><td>32–200 тыс.</td><td>частые слова — один токен, редкие — из кусочков</td><td>артефакты разбиения</td></tr>
        </tbody>
      </table>

      <h2>Byte Pair Encoding</h2>
      <p>
        BPE придумал Филип Гейдж в 1994 году как алгоритм сжатия <Cite id="gage1994" />: найти самую частую пару соседних байтов, заменить её новым байтом, повторить. Сеннрих, Хэддоу и Бёрч
        <Cite id="sennrich2016" /> применили его для построения словаря подслов в нейросетевом переводе. Алгоритм обучения:
      </p>
      <ol>
        <li>Начать со словаря из отдельных символов (или байтов).</li>
        <li>Посчитать частоты всех пар соседних токенов в корпусе.</li>
        <li>Самую частую пару <M t="(a,b)" /> объявить новым токеном <M t="ab" />, записать правило слияния, заменить все вхождения.</li>
        <li>Повторять, пока словарь не достигнет нужного размера <M t="V" />.</li>
      </ol>
      <p><b>Кодирование</b> нового текста: разбить на символы и применять выученные слияния в том же порядке, в котором они выучены (на каждом шаге — пару с наименьшим номером слияния).</p>
      <BPEWidget />

      <h2>Байтовый BPE (GPT-2)</h2>
      <p>
        GPT-2 <Cite id="radford2019" /> применяет BPE не к символам Юникода (их ~150 000), а к <b>байтам UTF-8</b>. Базовый словарь — ровно 256 байтов, так что любая строка на любом языке
        кодируется без неизвестных токенов. Словарь GPT-2: 256 байтов + 50 000 слияний + 1 специальный токен <code>&lt;|endoftext|&gt;</code> = 50 257.
      </p>
      <BytesWidget />
      <h3>Предварительное разбиение</h3>
      <p>
        Если позволить слияния через любые границы, появятся токены вида «собака.», «собака!», «собака?» — словарь тратится на комбинации слова с пунктуацией. Поэтому GPT-2 сначала режет текст
        регулярным выражением на куски (буквы, цифры, пунктуация, пробелы; пробел приклеивается к <i>началу</i> следующего слова), и пары сливаются только внутри куска. Поэтому в словаре GPT
        «␣кот» и «кот» — разные токены.
      </p>
      <h3>Специальные токены</h3>
      <p>
        <code>&lt;|endoftext|&gt;</code> разделяет документы в обучающем потоке: модель учится, что после него начинается новый, не связанный текст. Чат-модели добавляют токены ролей
        (начало реплики пользователя/ассистента). Специальные токены не участвуют в BPE и добавляются в словарь отдельно.
      </p>

      <h2>Реализация с нуля</h2>
      <p>Полный байтовый BPE-токенизатор с обучением, кодированием, декодированием и сохранением — около 100 строк. Его использует <code>prepare.py</code> при <code>--tokenizer bpe</code>:</p>
      <Code title="books/gpt/python/bpe.py">{bpeSrc}</Code>
      <Callout type="tip" title="Оптимизация обучения BPE">
        <p>Наивный алгоритм пересчитывает пары по всему корпусу на каждом слиянии. Мы сначала собираем <i>уникальные</i> куски с их частотами (в Шекспире ~1 млн символов, но всего ~15 тыс. разных кусков-слов) — это ускоряет обучение в десятки раз. Промышленные реализации (tiktoken, HuggingFace tokenizers) дополнительно обновляют счётчики пар инкрементально и написаны на Rust.</p>
      </Callout>

      <h2>Почему токенизация важна</h2>
      <ul>
        <li><b>Длина контекста</b> измеряется в токенах. Хороший токенизатор (~4 символа на токен для английского у GPT-2) даёт модели «видеть» в 4 раза больше текста при той же стоимости.</li>
        <li><b>Неравенство языков.</b> Токенизатор, обученный в основном на английском, режет русский текст на большее число токенов — русский текст «дороже» и в обучении, и в API. Обучайте свой токенизатор на своём языке (глава 17).</li>
        <li><b>Артефакты.</b> Модель не видит букв внутри токена — отсюда трудности с подсчётом букв, обращением слов, арифметикой (числа режутся на куски непредсказуемо). Многие модели поэтому дробят числа на отдельные цифры.</li>
        <li><b>Альтернативы:</b> SentencePiece <Cite id="kudo2018" /> работает с сырым текстом (включая пробелы как символ «▁») и поддерживает униграммную модель — её используют LLaMA <Cite id="touvron2023" /> и многие другие.</li>
      </ul>
      <p>Размер словаря — компромисс: больше <M t="V" /> → короче последовательности, но больше матрица эмбеддингов (<M t={r`V\times C`} /> параметров) и реже встречается каждый токен. Для маленькой модели на маленьком корпусе разумно <M t="V" /> = 512–4096; GPT-2 — 50 257; современные многоязычные модели — 100–250 тыс.</p>
      <Quiz q="Сколько токенов в базовом словаре байтового BPE до слияний?" options={['26', '65', '256', '50 257']} answer={2}
        explain="Байт принимает 256 значений, они и образуют начальный словарь. Затем добавляются слияния." />
      <Quiz q="Почему LLM часто ошибаются, считая буквы «р» в слове «пространство»?" options={['Мало параметров', 'Слово превращается в 1–3 токена, и модель не видит отдельных букв напрямую', 'Ошибка в softmax', 'Им запрещено считать']} answer={1}
        explain="Модель получает идентификаторы токенов. Сведения о буквах внутри токена она может знать только косвенно, из статистики обучения." />
    </>
  );
}
