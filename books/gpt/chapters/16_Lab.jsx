import React, { useEffect, useRef, useState } from 'react';
import { M, r, Cite, Callout, Code, Widget, Slider, fmt, Stat } from '@shared/ui.jsx';
import { LineChart, Heatmap } from '@shared/charts.jsx';
import { TinyGPT, AdamW, backward, clipGradNorm } from '../lib/tensor.js';
import { makeRng } from '@shared/rng.js';
import tensorSrc from '../lib/tensor.js?raw';
import SHAKESPEARE from '../lib/shakespeare.js';

const CORPORA = {
  'Шекспир (40 КБ)': SHAKESPEARE,
  'Пушкин (отрывок)': `Мой дядя самых честных правил,
Когда не в шутку занемог,
Он уважать себя заставил
И лучше выдумать не мог.
Его пример другим наука;
Но, боже мой, какая скука
С больным сидеть и день и ночь,
Не отходя ни шагу прочь!
Какое низкое коварство
Полуживого забавлять,
Ему подушки поправлять,
Печально подносить лекарство,
Вздыхать и думать про себя:
Когда же черт возьмет тебя!

Так думал молодой повеса,
Летя в пыли на почтовых,
Всевышней волею Зевеса
Наследник всех своих родных.
Друзья Людмилы и Руслана!
С героем моего романа
Без предисловий, сей же час
Позвольте познакомить вас:
Онегин, добрый мой приятель,
Родился на брегах Невы,
Где, может быть, родились вы
Или блистали, мой читатель;
Там некогда гулял и я:
Но вреден север для меня.
`,
  'Сложение чисел': Array.from({ length: 400 }, (_, i) => { const g = makeRng(i + 1); const a = Math.floor(g.rand() * 50), b = Math.floor(g.rand() * 50); return `${a}+${b}=${a + b}`; }).join('\n') + '\n',
};

export default function Lab() {
  const [corpusName, setCorpusName] = useState('Шекспир (40 КБ)');
  const [text, setText] = useState(CORPORA['Шекспир (40 КБ)']);
  const [cfg, setCfg] = useState({ nLayer: 2, nHead: 4, nEmbd: 48, blockSize: 32 });
  const [lr, setLr] = useState(3e-3);
  const [batch, setBatch] = useState(8);
  const [temp, setTemp] = useState(0.8);
  const [running, setRunning] = useState(false);
  const [sample, setSample] = useState('');
  const [prompt, setPrompt] = useState('');
  const [attView, setAttView] = useState({ layer: 0, head: 0 });
  const S = useRef(null);
  const [, force] = useState(0);

  const init = () => {
    const chars = [...new Set(text)].sort();
    const stoi = Object.fromEntries(chars.map((c, i) => [c, i]));
    const data = [...text].map((c) => stoi[c]);
    const nVal = Math.max(cfg.blockSize + 2, Math.floor(data.length * 0.1));
    const rng = makeRng(1234);
    const model = new TinyGPT({ vocabSize: chars.length, ...cfg }, rng);
    // для обучения нужны окна длины block_size и в train, и в val, и хотя бы два разных символа
    const minLen = 3 * cfg.blockSize + 10;
    const tooSmall = chars.length < 2 || data.length < minLen;
    S.current = { chars, stoi, train: data.slice(0, -nVal), val: data.slice(-nVal), model, opt: new AdamW(model.parameters(), { lr }), rng, step: 0, hist: [], valHist: [], gnorm: 0, att: null, tps: 0, tooSmall, minLen };
    setSample('');
    force((n) => n + 1);
  };
  useEffect(() => { setRunning(false); init(); /* eslint-disable-next-line */ }, [text, cfg]);

  const getBatch = (split, B, T) => {
    const s = S.current, d = split === 'train' ? s.train : s.val;
    const X = [], Y = [];
    for (let b = 0; b < B; b++) {
      const o = Math.floor(s.rng.rand() * (d.length - T - 1));
      for (let t = 0; t < T; t++) { X.push(d[o + t]); Y.push(d[o + t + 1]); }
    }
    return [X, Y];
  };

  useEffect(() => {
    if (!running || S.current?.tooSmall) return;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const s = S.current, T = cfg.blockSize, t0 = performance.now();
      let n = 0;
      while (performance.now() - t0 < 60) {
        const [X, Y] = getBatch('train', batch, T);
        const { loss } = s.model.forward(X, batch, T, Y);
        backward(loss);
        s.gnorm = clipGradNorm(s.model.parameters(), 1.0);
        const warm = Math.min(1, (s.step + 1) / 50);
        s.opt.step(lr * warm);
        s.step++; n++;
        s.hist.push([s.step, loss.data[0]]);
        if (s.step % 25 === 0) {
          const [vx, vy] = getBatch('val', 8, T);
          s.valHist.push([s.step, s.model.forward(vx, 8, T, vy).loss.data[0]]);
        }
      }
      s.tps = (n * batch * T) / ((performance.now() - t0) / 1000);
      if (s.hist.length > 3000) s.hist = s.hist.filter((_, i) => i % 2 === 0);
      force((k) => k + 1);
      setTimeout(loop, 0);
    };
    loop();
    return () => { alive = false; };
  }, [running, batch, lr, cfg]);

  const generate = (n = 300) => {
    const s = S.current, T = cfg.blockSize;
    const rng = makeRng(Date.now() % 100000);
    let ctx = [...prompt].map((c) => s.stoi[c]).filter((v) => v !== undefined);
    if (!ctx.length) ctx = [s.stoi['\n'] ?? 0];
    const out = [...ctx];
    let lastAtt = null;
    for (let i = 0; i < n; i++) {
      const win = out.slice(-T);
      const { logits, atts } = s.model.forward(win, 1, win.length);
      lastAtt = { atts, tokens: win.map((id) => s.chars[id]) };
      const V = s.chars.length, row = logits.data.subarray((win.length - 1) * V, win.length * V);
      const z = Array.from(row, (v) => v / temp), m = Math.max(...z);
      const e = z.map((v) => Math.exp(v - m)), sum = e.reduce((a, b) => a + b, 0);
      out.push(rng.choice(e.map((v) => v / sum)));
    }
    s.att = lastAtt;
    setSample(out.map((id) => s.chars[id]).join(''));
    force((k) => k + 1);
  };

  const s = S.current;
  if (!s) return null;
  const smooth = (h) => { const out = []; let ema = h[0]?.[1]; h.forEach(([x, y]) => { ema = 0.95 * ema + 0.05 * y; out.push([x, ema]); }); return out; };
  const lastLoss = s.hist.length ? smooth(s.hist).slice(-1)[0][1] : NaN;
  const att = s.att;
  const A = att && att.atts[attView.layer]?.[0]?.[attView.head];
  const Tw = att ? att.tokens.length : 0;
  const tail = Math.min(Tw, 16);
  const attMat = A ? Array.from({ length: tail }, (_, i) => Array.from({ length: tail }, (_, j) => A[(Tw - tail + i) * Tw + (Tw - tail + j)])) : null;
  const lbl = (c) => (c === '\n' ? '⏎' : c === ' ' ? '␣' : c);

  return (
    <>
      <h1>Лаборатория: GPT в браузере</h1>
      <p className="lead">Ниже — настоящий трансформер, который обучается прямо на этой странице. Никакого PyTorch: только JavaScript-движок из ~350 строк, написанный по формулам из глав 5–13. Нажмите «обучать» и наблюдайте.</p>

      <Widget title="Обучение мини-GPT" badge="живая модель">
        <div className="controls">
          {Object.keys(CORPORA).map((k) => <button key={k} className={'btn small' + (k === corpusName ? ' primary' : '')} onClick={() => { setCorpusName(k); setText(CORPORA[k]); }}>{k}</button>)}
          <button className={'btn small' + (corpusName === 'свой' ? ' primary' : '')} onClick={() => setCorpusName('свой')}>свой текст</button>
        </div>
        {s.tooSmall && <p className="small" style={{ color: 'var(--red)' }}>Текст слишком короткий для обучения: нужно не меньше {s.minLen} символов (три окна по block_size = {cfg.blockSize} — на обучение и проверку) и хотя бы два разных символа. Сейчас: {[...text].length}.</p>}
        {corpusName === 'свой' && <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Вставьте сюда любой текст (желательно от 2000 символов)" />}
        <div className="controls">
          <Slider label="n_layer" value={cfg.nLayer} min={1} max={4} onChange={(v) => setCfg({ ...cfg, nLayer: v })} />
          <Slider label="n_head" value={cfg.nHead} min={1} max={8} onChange={(v) => setCfg({ ...cfg, nHead: v, nEmbd: Math.max(v, Math.round(cfg.nEmbd / v) * v) })} />
          <Slider label="n_embd" value={cfg.nEmbd} min={cfg.nHead * 2} max={96} step={cfg.nHead} onChange={(v) => setCfg({ ...cfg, nEmbd: v })} />
          <Slider label="block_size" value={cfg.blockSize} min={8} max={64} step={8} onChange={(v) => setCfg({ ...cfg, blockSize: v })} />
        </div>
        <div className="controls">
          <Slider label="learning rate" value={lr} min={1e-4} max={1e-2} step={1e-4} onChange={setLr} format={(v) => v.toExponential(1)} />
          <Slider label="batch size" value={batch} min={1} max={32} onChange={setBatch} />
          <button className="btn primary" disabled={s.tooSmall} onClick={() => setRunning(!running)}>{running ? '⏸ пауза' : '▶ обучать'}</button>
          <button className="btn" onClick={() => { setRunning(false); init(); }}>⟲ заново</button>
        </div>
        <div className="stats">
          <Stat k="параметров" v={s.model.numParams().toLocaleString('ru')} />
          <Stat k="словарь V" v={s.chars.length} />
          <Stat k="шаг" v={s.step} />
          <Stat k="train loss (EMA)" v={fmt(lastLoss, 3)} />
          <Stat k="val loss" v={s.valHist.length ? fmt(s.valHist[s.valHist.length - 1][1], 3) : '—'} />
          <Stat k="ln V (старт)" v={fmt(Math.log(s.chars.length), 3)} />
          <Stat k="норма градиента" v={fmt(s.gnorm, 2)} />
          <Stat k="токенов/с" v={Math.round(s.tps).toLocaleString('ru')} />
        </div>
        {s.hist.length > 2 && (
          <LineChart height={230} xLabel="шаг" series={[
            { data: s.hist, color: 'var(--border)', width: 1 },
            { data: smooth(s.hist), color: 'var(--c1)', label: 'train' },
            { data: s.valHist, color: 'var(--c2)', label: 'val', points: s.valHist.length < 40 },
          ]} />
        )}
        <div className="controls" style={{ marginTop: 10 }}>
          <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="затравка (можно пусто)" style={{ flex: 1, minWidth: 160 }} />
          <Slider label="temperature" value={temp} min={0.1} max={2} step={0.05} onChange={setTemp} />
          <button className="btn primary" disabled={s.tooSmall} onClick={() => generate()}>сгенерировать</button>
        </div>
        <div className="sample-out">{sample || 'Нажмите «сгенерировать». До обучения выйдет случайный набор символов; через 300–500 шагов появятся слова и структура реплик.'}</div>
        {attMat && (
          <>
            <div className="controls" style={{ marginTop: 12 }}>
              <span className="small"><b>Внимание</b> на последних {tail} символах генерации:</span>
              <Slider label="слой" value={attView.layer} min={0} max={cfg.nLayer - 1} onChange={(v) => setAttView({ ...attView, layer: v })} />
              <Slider label="голова" value={attView.head} min={0} max={cfg.nHead - 1} onChange={(v) => setAttView({ ...attView, head: v })} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <Heatmap values={attMat} rowLabels={att.tokens.slice(-tail).map(lbl)} colLabels={att.tokens.slice(-tail).map(lbl)} lo={0} hi={1} cell={22} showValues={false} />
            </div>
            <p className="small muted">Строка — символ-«запрос», столбец — на кого он смотрит. Часто встречаются головы «предыдущий символ» (диагональ под главной), «начало слова» (столбцы пробелов) и «начало строки».</p>
          </>
        )}
      </Widget>

      <h2>Что происходит</h2>
      <ol>
        <li>Текст разбивается на символы, каждому символу — номер. Последние 10% уходят на валидацию.</li>
        <li>Модель — <M t={r`L`} /> блоков pre-LN, многоголовое каузальное внимание, MLP с GELU, отдельная выходная матрица. Инициализация как в GPT-2: <M t={r`\mathcal N(0, 0.02^2)`} />, проекции в поток — <M t={r`0.02/\sqrt{2L}`} />.</li>
        <li>Каждые ~60 мс выполняется столько шагов, сколько успеет браузер: случайный батч → прямой проход → кросс-энтропия → обратный проход → обрезка градиента до 1 → AdamW (разогрев 50 шагов).</li>
        <li>Каждые 25 шагов считается loss на валидационном батче — оранжевая кривая. На маленьком корпусе (попробуйте отрывок Пушкина — всего ~1 КБ) она быстро начинает расходиться с train — живое переобучение (глава 14).</li>
      </ol>
      <Callout type="tip" title="Эксперименты">
        <ul>
          <li>Сравните n_layer = 1 и 3 при одинаковом числе шагов.</li>
          <li>Поставьте learning rate 1e−2 — увидите нестабильность; 1e−4 — очень медленное обучение.</li>
          <li>Выберите «Сложение чисел» и после ~1500 шагов дайте затравку <code>23+14=</code>. Маленький трансформер выучивает формат и частично — саму арифметику. Подумайте, почему сложение с переносом даётся труднее (подсказка: модель пишет ответ слева направо, а перенос идёт справа налево).</li>
          <li>Вставьте свой текст — например, сотню своих сообщений — и посмотрите, что выучит модель.</li>
        </ul>
      </Callout>
      <p>
        Наш движок медленный: он считает на одном ядре CPU в float32 без векторизации, со скоростью порядка 10⁴ токенов в секунду. PyTorch на видеокарте обрабатывает 10⁵–10⁶ токенов в секунду для моделей в тысячи раз крупнее.
        Но математика — <b>ровно та же</b>. В следующей главе вы запустите её в полную силу.
      </p>

      <h2>Исходный код движка</h2>
      <p>Каждая операция — прямой проход и функция <code>_backward</code>, реализующая формулы из главы 5. Правильность всех градиентов проверена сравнением с численными производными. Прочтите и сравните с <code>model.py</code>: структура одинакова.</p>
      <Code lang="javascript" title="books/gpt/lib/tensor.js" collapse>{tensorSrc}</Code>
      <p className="muted small">Отличие от <code>model.py</code>: здесь выходная матрица <code>head</code> не связана с эмбеддингами — так проще читать код. Упражнение: свяжите веса (подсказка: нужна операция «умножение на транспонированную матрицу» с соответствующим backward).</p>
    </>
  );
}
