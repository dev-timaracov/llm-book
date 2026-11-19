import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt, Stat } from '../components/ui.jsx';
import { LineChart } from '../components/charts.jsx';
import { makeRng } from '../lib/rng.js';
import modelSrc from '../../python/model.py?raw';
import { extract } from './11_MultiHead.jsx';

function BlockDiagram() {
  return (
    <svg viewBox="0 0 520 470" className="diagram" style={{ maxWidth: 460, margin: '0 auto' }} role="img" aria-label="Схема блока трансформера">
      <defs><marker id="ah12" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker></defs>
      {/* остаточный поток */}
      <line x1="120" y1="455" x2="120" y2="15" stroke="var(--accent)" strokeWidth="5" opacity="0.35" />
      <text x="105" y="240" textAnchor="middle" transform="rotate(-90 105 240)" style={{ fill: 'var(--accent)' }} fontWeight="600">остаточный поток x</text>
      <text x="120" y="468" textAnchor="middle" className="sm">вход (B, T, C)</text>
      {/* ветка внимания */}
      <path className="arrow" d="M120 400 L 300 400 L 300 380" markerEnd="url(#ah12)" />
      <rect x="230" y="340" width="140" height="38" rx="8" className="box hl3" /><text x="300" y="364" textAnchor="middle">LayerNorm 1</text>
      <path className="arrow" d="M300 340 L300 318" markerEnd="url(#ah12)" />
      <rect x="200" y="270" width="200" height="46" rx="8" className="box hl" /><text x="300" y="290" textAnchor="middle" fontWeight="600">Causal Self-Attention</text><text x="300" y="306" textAnchor="middle" className="sm">токены общаются</text>
      <path className="arrow" d="M300 270 L300 250 L 132 250" markerEnd="url(#ah12)" />
      <circle cx="120" cy="250" r="11" className="box" style={{ fill: 'var(--panel)', stroke: 'var(--accent)' }} /><text x="120" y="255" textAnchor="middle" fontWeight="700">+</text>
      {/* ветка MLP */}
      <path className="arrow" d="M120 210 L 300 210 L 300 190" markerEnd="url(#ah12)" />
      <rect x="230" y="150" width="140" height="38" rx="8" className="box hl3" /><text x="300" y="174" textAnchor="middle">LayerNorm 2</text>
      <path className="arrow" d="M300 150 L300 128" markerEnd="url(#ah12)" />
      <rect x="200" y="62" width="200" height="64" rx="8" className="box hl2" /><text x="300" y="82" textAnchor="middle" fontWeight="600">MLP</text>
      <text x="300" y="99" textAnchor="middle" className="sm">Linear C→4C · GELU · Linear 4C→C</text><text x="300" y="115" textAnchor="middle" className="sm">каждый токен отдельно «думает»</text>
      <path className="arrow" d="M300 62 L300 45 L 132 45" markerEnd="url(#ah12)" />
      <circle cx="120" cy="45" r="11" className="box" style={{ fill: 'var(--panel)', stroke: 'var(--accent)' }} /><text x="120" y="50" textAnchor="middle" fontWeight="700">+</text>
      <text x="120" y="10" textAnchor="middle" className="sm">выход (B, T, C) → следующий блок</text>
      <text x="430" y="280" className="sm">x = x + Attn(LN₁(x))</text>
      <text x="430" y="95" className="sm">x = x + MLP(LN₂(x))</text>
    </svg>
  );
}

function LayerNormWidget() {
  const [x, setX] = useState([3, 1, -2, 6, 0.5, 2]);
  const [g, setG] = useState(1), [b, setB] = useState(0);
  const mu = x.reduce((a, v) => a + v, 0) / x.length;
  const v = x.reduce((a, t) => a + (t - mu) ** 2, 0) / x.length;
  const y = x.map((t) => ((t - mu) / Math.sqrt(v + 1e-5)) * g + b);
  const bar = (vals, color) => (
    <svg viewBox="0 0 240 120" style={{ width: '100%', maxWidth: 260 }}>
      <line x1="0" y1="60" x2="240" y2="60" stroke="var(--border)" />
      {vals.map((t, i) => { const h = Math.max(-58, Math.min(58, t * 8)); return <rect key={i} x={10 + i * 38} width="28" y={h > 0 ? 60 - h : 60} height={Math.abs(h)} fill={color} rx="3" />; })}
    </svg>
  );
  return (
    <Widget title="LayerNorm на одном векторе">
      <div className="row">
        <div className="col">
          {x.map((t, i) => <Slider key={i} label={`x${i + 1}`} value={t} min={-7} max={7} step={0.1} onChange={(nv) => { const n = [...x]; n[i] = nv; setX(n); }} />)}
          <Slider label="γ (масштаб)" value={g} min={0} max={3} step={0.05} onChange={setG} />
          <Slider label="β (сдвиг)" value={b} min={-3} max={3} step={0.05} onChange={setB} />
        </div>
        <div className="col">
          <p className="small">вход x {bar(x, 'var(--c2)')}</p>
          <p className="small">выход LN(x) {bar(y, 'var(--c1)')}</p>
          <div className="stats"><Stat k="μ входа" v={fmt(mu, 2)} /><Stat k="σ входа" v={fmt(Math.sqrt(v), 2)} /><Stat k="μ выхода" v={fmt(y.reduce((a, t) => a + t, 0) / y.length, 2)} /></div>
          <p className="small muted">Умножьте все входы на 10 или прибавьте ко всем 5 — выход не изменится. LayerNorm убирает масштаб и сдвиг, оставляя только «форму» вектора, а γ и β позволяют сети вернуть нужный масштаб.</p>
        </div>
      </div>
    </Widget>
  );
}

function DepthWidget() {
  const [L, setL] = useState(24);
  const [resid, setResid] = useState(true);
  const [scale, setScale] = useState(true);
  // симуляция: норма активации и градиента через L слоёв случайных линейных отображений
  const C = 64, rng = makeRng(3);
  let x = Array.from({ length: C }, () => rng.randn());
  const norms = [[0, Math.hypot(...x) / Math.sqrt(C)]];
  for (let l = 0; l < L; l++) {
    const std = (scale ? 1 / Math.sqrt(2 * L) : 1) / Math.sqrt(C);
    const ln = (() => { const m = x.reduce((a, b) => a + b, 0) / C; const s = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / C + 1e-5); return x.map((t) => (t - m) / s); })();
    const f = Array.from({ length: C }, () => ln.reduce((s, t) => s + t * rng.randn() * std, 0));
    x = resid ? x.map((t, i) => t + f[i]) : f;
    norms.push([l + 1, Math.hypot(...x) / Math.sqrt(C)]);
  }
  return (
    <Widget title="Остаточный поток в глубокой сети" badge="эксперимент">
      <div className="controls">
        <Slider label="число слоёв" value={L} min={2} max={96} onChange={setL} />
        <label className="small"><input type="checkbox" checked={resid} onChange={() => setResid(!resid)} /> остаточные связи</label>
        <label className="small"><input type="checkbox" checked={scale} onChange={() => setScale(!scale)} /> масштаб инициализации 1/√(2L)</label>
      </div>
      <LineChart height={200} series={[{ data: norms, color: 'var(--c1)' }]} legend={false} xLabel="слой" yLabel="RMS активации" />
      <p className="small muted">Каждый слой — LayerNorm + случайная линейная проекция (как в pre-LN блоке при инициализации). С остаточными связями и масштабом 1/√(2L) (GPT-2) норма потока растёт плавно и предсказуемо. Без масштаба поток раздувается с глубиной; без остатка сигнал на выходе не связан со входом — и градиент к ранним слоям проходит только через все слои подряд.</p>
    </Widget>
  );
}

export default function Block() {
  return (
    <>
      <h1>Блок трансформера</h1>
      <p className="lead">Внимание — это «общение» токенов. Но блоку GPT нужны ещё три детали: остаточные связи, нормализация и MLP. Без любой из них глубокая сеть не обучится.</p>

      <BlockDiagram />
      <Eq t={r`\begin{aligned}\mathbf x &\leftarrow \mathbf x + \mathrm{MultiHeadAttn}(\mathrm{LN}_1(\mathbf x))\\ \mathbf x &\leftarrow \mathbf x + \mathrm{MLP}(\mathrm{LN}_2(\mathbf x))\end{aligned}`} label="блок GPT-2 (pre-LN)" />

      <h2>Остаточные связи и остаточный поток</h2>
      <p>
        Идея из ResNet <Cite id="he2016resnet" />: слой вычисляет не новое представление, а <b>поправку</b> к старому: <M t={r`\mathbf y = \mathbf x + f(\mathbf x)`} />. Производная:
      </p>
      <Eq t={r`\frac{\partial\mathbf y}{\partial\mathbf x} = I + \frac{\partial f}{\partial\mathbf x}`} />
      <p>
        Единичная матрица означает, что градиент от выхода доходит до входа <b>напрямую</b>, минуя все нелинейности, — даже если <M t="f" /> «плохой». Для <M t="L" /> блоков подряд градиент к первому слою
        содержит слагаемое <M t="I" /> плюс сумму вкладов отдельных блоков, а не только произведение <M t="L" /> якобианов (которое затухает или взрывается экспоненциально).
      </p>
      <p>
        Элхаге и др. <Cite id="elhage2021" /> предлагают полезный взгляд: есть <b>остаточный поток</b> — «шина» ширины <M t="C" />, проходящая через всю модель. Каждый блок <i>читает</i> из потока (через LayerNorm и
        проекции), что-то вычисляет и <i>пишет</i> результат обратно, прибавляя его. Итоговый вектор — сумма эмбеддинга и вкладов всех блоков.
      </p>
      <DepthWidget />

      <h2>LayerNorm</h2>
      <p>Ба, Кирос и Хинтон <Cite id="ba2016" />: нормируем каждый вектор токена по его собственным <M t="C" /> компонентам:</p>
      <Eq t={r`\mu = \frac1C\sum_{i=1}^C x_i,\quad \sigma^2 = \frac1C\sum_{i=1}^C(x_i-\mu)^2,\quad \mathrm{LN}(\mathbf x)_i = \gamma_i\frac{x_i-\mu}{\sqrt{\sigma^2+\epsilon}} + \beta_i`} />
      <LayerNormWidget />
      <ul>
        <li>В отличие от BatchNorm <Cite id="ioffe2015" />, статистики считаются по признакам одного примера, а не по батчу. Поведение одинаково при обучении и генерации, не зависит от размера батча и длины последовательности — идеально для языковых моделей.</li>
        <li><M t={r`\gamma, \beta\in\mathbb R^C`} /> — обучаемые; инициализируются как 1 и 0 (тождественное преобразование после нормировки).</li>
        <li><M t={r`\epsilon\approx 10^{-5}`} /> защищает от деления на ноль.</li>
      </ul>

      <h3>Pre-LN или Post-LN</h3>
      <p>
        В оригинальном трансформере <Cite id="vaswani2017" /> нормализация стояла <i>после</i> сложения: <M t={r`\mathbf x\leftarrow\mathrm{LN}(\mathbf x + f(\mathbf x))`} /> (Post-LN). Такая схема требует аккуратного разогрева LR,
        иначе обучение расходится. Начиная с GPT-2 <Cite id="radford2019" /> LN ставят <i>перед</i> подблоком (Pre-LN), а в конце всей модели добавляют финальный LN. Сюн и др. <Cite id="xiong2020" /> показали теоретически:
        в Pre-LN градиенты при инициализации хорошо обусловлены, и остаточный поток остаётся «чистым» путём от выхода ко входу.
      </p>

      <h2>MLP (feed-forward)</h2>
      <Eq t={r`\mathrm{MLP}(\mathbf x) = \mathrm{GELU}(\mathbf xW_1 + \mathbf b_1)W_2 + \mathbf b_2,\qquad W_1\in\mathbb R^{C\times 4C},\; W_2\in\mathbb R^{4C\times C}`} />
      <p>
        Применяется к каждой позиции независимо (одни и те же веса для всех токенов). Скрытый слой в 4 раза шире — это соотношение из оригинального трансформера (512 → 2048) <Cite id="vaswani2017" />. На MLP приходится
        <b> ⅔ параметров</b> каждого блока (<M t={r`8C^2`} /> из <M t={r`12C^2`} />). Интуиция: внимание переносит информацию <i>между</i> токенами, а MLP обрабатывает собранную информацию <i>внутри</i> токена и, по-видимому,
        хранит значительную часть «фактических знаний» модели.
      </p>
      <p>
        <b>GELU</b> <Cite id="hendrycks2016" />: <M t={r`\mathrm{GELU}(x) = x\,\Phi(x)`} />, где <M t={r`\Phi`} /> — функция распределения стандартной нормальной величины. GPT-2 использует быструю аппроксимацию
        <M t={r`0.5x\big(1+\tanh\big(\sqrt{2/\pi}(x+0.044715x^3)\big)\big)`} /> — именно её вычисляет <code>F.gelu(x, approximate="tanh")</code> и функция <code>gelu</code> в нашем JS-движке.
      </p>

      <h2>Dropout</h2>
      <p>
        При обучении каждый элемент активации с вероятностью <M t="p" /> обнуляется, остальные умножаются на <M t={r`1/(1-p)`} /> (чтобы ожидание не менялось) <Cite id="srivastava2014" />. Это мешает сети полагаться на отдельные
        нейроны и снижает переобучение. В GPT dropout ставят после softmax внимания, после проекций в остаточный поток и после эмбеддингов. Для маленьких датасетов (Шекспир, 1 МБ) <M t="p=0.1..0.2" /> заметно помогает; при обучении
        больших моделей на огромных корпусах, где каждый пример виден ~1 раз, dropout обычно отключают (<M t="p=0" />). При генерации <code>model.eval()</code> выключает dropout.
      </p>

      <h2>Код</h2>
      <Code title="python/model.py — LayerNorm">{extract(modelSrc, 'class LayerNorm', 'class CausalSelfAttention')}</Code>
      <Code title="python/model.py — MLP и Block">{extract(modelSrc, 'class MLP', 'class GPT(')}</Code>
      <Quiz q="Какая доля параметров блока GPT (без LayerNorm и bias) приходится на MLP?" options={['1/4', '1/3', '1/2', '2/3']} answer={3}
        explain="Внимание: W_attn (3C²) + W_proj (C²) = 4C². MLP: 4C² + 4C² = 8C². Итого 12C², из них 8C² — MLP." />
      <Quiz q="Чем LayerNorm отличается от BatchNorm?" options={['LN нормирует по признакам каждого примера отдельно, BN — по батчу для каждого признака', 'Ничем', 'LN не имеет обучаемых параметров', 'LN работает только при генерации']} answer={0}
        explain="Поэтому LN не зависит от размера батча и одинаково работает при обучении и генерации." />
    </>
  );
}
