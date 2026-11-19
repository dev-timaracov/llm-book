import React, { useEffect, useMemo, useRef, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt, Stat } from '../components/ui.jsx';
import { LineChart } from '../components/charts.jsx';
import { MLP } from '../lib/autograd.js';
import { makeRng } from '../lib/rng.js';

const erf = (x) => { // аппроксимация Абрамовица — Стиган 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
};
const ACTS = {
  ReLU: { f: (x) => Math.max(0, x), d: (x) => (x > 0 ? 1 : 0) },
  tanh: { f: Math.tanh, d: (x) => 1 - Math.tanh(x) ** 2 },
  sigmoid: { f: (x) => 1 / (1 + Math.exp(-x)), d: (x) => { const s = 1 / (1 + Math.exp(-x)); return s * (1 - s); } },
  GELU: { f: (x) => 0.5 * x * (1 + erf(x / Math.SQRT2)), d: (x) => 0.5 * (1 + erf(x / Math.SQRT2)) + (x * Math.exp(-x * x / 2)) / Math.sqrt(2 * Math.PI) },
};

function Activations() {
  const [act, setAct] = useState('GELU');
  const A = ACTS[act];
  const xs = Array.from({ length: 161 }, (_, i) => -4 + i * 0.05);
  return (
    <Widget title="Функции активации и их производные">
      <div className="controls">{Object.keys(ACTS).map((k) => <button key={k} className={'btn small' + (k === act ? ' primary' : '')} onClick={() => setAct(k)}>{k}</button>)}</div>
      <LineChart height={240} xDomain={[-4, 4]} yDomain={[-1.2, 2.5]} series={[
        { data: xs.map((x) => [x, A.f(x)]), color: 'var(--c1)', label: act + '(x)' },
        { data: xs.map((x) => [x, A.d(x)]), color: 'var(--c2)', dashed: true, label: 'производная' },
      ]} />
      <p className="small muted">
        {act === 'ReLU' && 'ReLU: max(0, x). Дёшево, производная 1 для x > 0 — градиент не затухает. Минус: «мёртвые» нейроны с x < 0 навсегда получают нулевой градиент.'}
        {act === 'tanh' && 'tanh: выход в (−1, 1). При |x| > 3 производная почти 0 — насыщение, градиент затухает в глубоких сетях.'}
        {act === 'sigmoid' && 'Сигмоида: выход в (0, 1), максимум производной всего 0.25 — в глубоких сетях градиент быстро затухает. Сейчас используется в основном для вероятностей и «ворот».'}
        {act === 'GELU' && 'GELU(x) = x·Φ(x), где Φ — функция распределения N(0,1) (Hendrycks & Gimpel, 2016). Гладкий вариант ReLU; используется в GPT-2/3 и BERT.'}
      </p>
    </Widget>
  );
}

function FitWidget() {
  const [running, setRunning] = useState(false);
  const [lr, setLr] = useState(0.05);
  const [hidden, setHidden] = useState(10);
  const [target, setTarget] = useState('sin');
  const state = useRef(null);
  const [, force] = useState(0);
  const targets = { sin: (x) => Math.sin(2 * x), abs: (x) => Math.abs(x) - 1, step: (x) => (x > 0 ? 0.8 : -0.8), poly: (x) => 0.4 * x ** 3 - x };
  const data = useMemo(() => Array.from({ length: 24 }, (_, i) => { const x = -2 + (4 * i) / 23; return [x, targets[target](x)]; }), [target]);
  const reset = () => { state.current = { net: new MLP([1, hidden, hidden, 1], makeRng(7)), step: 0, loss: NaN, hist: [] }; force((n) => n + 1); };
  useEffect(reset, [hidden, target]);
  useEffect(() => {
    if (!running) return;
    let raf;
    const tick = () => {
      const s = state.current;
      for (let k = 0; k < 4; k++) {
        let loss = null;
        for (const [x, y] of data) { const d = s.net.forward([x])[0].sub(y); const l = d.mul(d); loss = loss ? loss.add(l) : l; }
        loss = loss.mul(1 / data.length);
        loss.backward();
        for (const p of s.net.parameters()) p.data -= lr * p.grad;
        s.step++; s.loss = loss.data;
        if (s.step % 5 === 0) s.hist.push([s.step, s.loss]);
      }
      force((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, lr, data]);
  const s = state.current;
  const pred = s ? Array.from({ length: 81 }, (_, i) => { const x = -2.2 + (4.4 * i) / 80; return [x, s.net.forward([x])[0].data]; }) : [];
  return (
    <Widget title="Обучаем MLP приблизить функцию (скалярный autograd прямо в браузере)">
      <div className="controls">
        <button className="btn primary" onClick={() => setRunning(!running)}>{running ? '⏸ пауза' : '▶ обучать'}</button>
        <button className="btn" onClick={reset}>сбросить веса</button>
        {Object.keys(targets).map((k) => <button key={k} className={'btn small' + (k === target ? ' primary' : '')} onClick={() => setTarget(k)}>{k}</button>)}
      </div>
      <div className="controls">
        <Slider label="η" value={lr} min={0.005} max={0.3} step={0.005} onChange={setLr} />
        <Slider label="нейронов в скрытом слое" value={hidden} min={1} max={16} onChange={setHidden} />
      </div>
      <div className="row">
        <div className="col" style={{ flex: 2 }}>
          <LineChart height={240} xDomain={[-2.2, 2.2]} yDomain={[-1.6, 1.6]} series={[
            { data: pred, color: 'var(--c1)', label: 'сеть' },
            { data, color: 'var(--c2)', points: true, width: 0, label: 'данные' },
          ]} />
        </div>
        <div className="col">
          {s && s.hist.length > 1 && <LineChart height={200} logY series={[{ data: s.hist, color: 'var(--c3)' }]} xLabel="шаг" yLabel="loss" legend={false} />}
          <div className="stats"><Stat k="шаг" v={s?.step ?? 0} /><Stat k="MSE" v={fmt(s?.loss, 4)} /><Stat k="параметров" v={s ? s.net.parameters().length : 0} /></div>
        </div>
      </div>
      <p className="small muted">Сеть 1 → {hidden} → {hidden} → 1 с tanh. Каждый шаг строит вычислительный граф из ~{24 * (hidden * hidden + 3 * hidden) * 2} узлов-скаляров и проходит по нему назад (как — глава 5).
        Поставьте 1 нейрон — сеть почти не может изогнуться. Попробуйте «step»: разрыв приближается крутым склоном.</p>
    </Widget>
  );
}

export default function Neuron() {
  return (
    <>
      <h1>Нейрон и многослойная сеть</h1>
      <p className="lead">Нейронная сеть — это композиция простых функций «линейное преобразование → нелинейность». Поймём, почему этого достаточно, чтобы приблизить почти что угодно.</p>

      <h2>Искусственный нейрон</h2>
      <p>Нейрон принимает вектор входов <M t={r`\mathbf x\in\mathbb R^n`} />, считает взвешенную сумму и применяет нелинейную функцию активации <M t={r`\varphi`} />:</p>
      <Eq t={r`y = \varphi\Big(\sum_{i=1}^n w_i x_i + b\Big) = \varphi(\mathbf w\cdot\mathbf x + b)`} />
      <p>
        <M t={r`\mathbf w`} /> — веса, <M t="b" /> — смещение (bias). Без нелинейности это просто линейная функция, а условие <M t={r`\mathbf w\cdot\mathbf x+b>0`} /> задаёт гиперплоскость, делящую пространство
        пополам: так работал перцептрон Розенблатта <Cite id="rosenblatt1958" />. Знаменитый пример задачи, которую один нейрон решить не может, — XOR: точки (0,0),(1,1) против (0,1),(1,0)
        не разделяются одной прямой. Нужен скрытый слой (см. <code>python/micrograd.py</code>, где сеть 2→8→1 решает XOR).
      </p>

      <h2>Слой и многослойный перцептрон (MLP)</h2>
      <p>Слой из <M t="m" /> нейронов — это сразу матричное умножение: веса всех нейронов складываются в строки матрицы <M t={r`W\in\mathbb R^{m\times n}`} />:</p>
      <Eq t={r`\mathbf h = \varphi(W\mathbf x + \mathbf b)`} />
      <p>MLP — несколько слоёв подряд:</p>
      <Eq t={r`\mathbf h_1 = \varphi(W_1\mathbf x + \mathbf b_1),\quad \mathbf h_2 = \varphi(W_2\mathbf h_1 + \mathbf b_2),\quad \dots,\quad \hat{\mathbf y} = W_L\mathbf h_{L-1} + \mathbf b_L`} />

      <h3>Зачем нелинейность</h3>
      <p>Без <M t={r`\varphi`} /> несколько слоёв схлопываются в один:</p>
      <Eq t={r`W_2(W_1\mathbf x + \mathbf b_1) + \mathbf b_2 = \underbrace{(W_2W_1)}_{W'}\mathbf x + \underbrace{(W_2\mathbf b_1 + \mathbf b_2)}_{\mathbf b'}`} />
      <p>Композиция линейных функций — линейная функция. Глубина без нелинейности ничего не даёт. Нелинейность «сгибает» пространство, и каждый следующий слой работает с уже изогнутым представлением.</p>
      <Activations />

      <h3>Теорема об универсальной аппроксимации</h3>
      <p>
        Цыбенко <Cite id="cybenko1989" /> и Хорник, Стинчкомб, Уайт <Cite id="hornik1989" /> доказали: сеть с одним скрытым слоем и достаточно большим числом нейронов может сколь угодно точно
        приблизить любую непрерывную функцию на ограниченной области. Интуиция: каждый нейрон с крутой сигмоидой — «ступенька»; две ступеньки дают «бугорок»; из бугорков можно сложить
        любую кривую. Теорема не говорит, <i>как найти</i> такие веса и сколько нужно нейронов, — на практике глубокие сети гораздо эффективнее широких. Поиск весов — задача
        обучения (главы 5–6).
      </p>
      <FitWidget />

      <h2>Функция потерь</h2>
      <p>Чтобы учить сеть, нужно число, показывающее, насколько она ошибается. Для регрессии — среднеквадратичная ошибка, для классификации — кросс-энтропия (глава 3):</p>
      <Eq t={r`\mathrm{MSE} = \frac{1}{N}\sum_{i=1}^N (\hat y_i - y_i)^2, \qquad \mathrm{CE} = -\frac{1}{N}\sum_{i=1}^N \log \mathrm{softmax}(\mathbf z_i)_{y_i}`} />
      <p>Обучение = минимизация потерь по параметрам <M t={r`\theta = \{W_1, \mathbf b_1, \dots\}`} /> градиентным спуском. Осталось научиться эффективно считать <M t={r`\nabla_\theta L`} /> — для этого следующая глава.</p>

      <h2>Инициализация весов</h2>
      <p>
        Если веса слишком большие, активации растут от слоя к слою и tanh насыщается (градиент ≈ 0); если слишком маленькие — сигнал затухает. Рассмотрим
        <M t={r`h = \sum_{i=1}^n w_i x_i`} /> с независимыми <M t={r`w_i, x_i`} />, нулевым средним: <M t={r`\mathrm{Var}(h) = n\,\mathrm{Var}(w)\,\mathrm{Var}(x)`} />. Чтобы дисперсия не менялась,
        нужно <M t={r`\mathrm{Var}(w) = 1/n`} />, т.е. <M t={r`w\sim\mathcal N(0, 1/n)`} />.
      </p>
      <ul>
        <li><b>Glorot/Xavier</b> <Cite id="glorot2010" />: <M t={r`\mathrm{Var}(w) = 2/(n_{in}+n_{out})`} /> — компромисс между прямым и обратным проходом.</li>
        <li><b>He/Kaiming</b> <Cite id="he2015init" />: <M t={r`\mathrm{Var}(w) = 2/n_{in}`} /> для ReLU (ReLU обнуляет половину входов — дисперсию надо удвоить).</li>
        <li><b>GPT-2</b> <Cite id="radford2019" />: <M t={r`\mathcal N(0, 0.02^2)`} /> для всех матриц плюс масштаб <M t={r`1/\sqrt{2N_{layers}}`} /> для проекций в остаточный поток (глава 13). Для <M t="C=768" /> значение 0.02 близко к <M t={r`1/\sqrt{768}\approx 0.036`} />.</li>
      </ul>

      <Code title="python — MLP на PyTorch">{`
import torch
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self, n_in, n_hidden, n_out):
        super().__init__()
        self.fc1 = nn.Linear(n_in, n_hidden)     # W1: (n_hidden, n_in), b1: (n_hidden,)
        self.fc2 = nn.Linear(n_hidden, n_hidden)
        self.fc3 = nn.Linear(n_hidden, n_out)

    def forward(self, x):                        # x: (N, n_in) — сразу N примеров
        x = torch.tanh(self.fc1(x))              # fc1(x) = x @ W1.T + b1
        x = torch.tanh(self.fc2(x))
        return self.fc3(x)                       # без активации на выходе

torch.manual_seed(0)
X = torch.linspace(-2, 2, 64).unsqueeze(1)      # (64, 1)
Y = torch.sin(2 * X)
net = MLP(1, 32, 1)
opt = torch.optim.SGD(net.parameters(), lr=0.1)
for step in range(2000):
    loss = ((net(X) - Y) ** 2).mean()
    opt.zero_grad()      # обнулить градиенты с прошлого шага (они накапливаются!)
    loss.backward()      # посчитать d loss / d параметр для всех параметров
    opt.step()           # p -= lr * p.grad
print(loss.item())       # ~1e-4
`}</Code>
      <Quiz q="Сеть из 10 линейных слоёв без функций активации может выразить..." options={['любую непрерывную функцию', 'только линейные (аффинные) функции', 'только многочлены 10-й степени', 'только константы']} answer={1}
        explain="Композиция аффинных отображений — аффинное отображение W'x + b'. Глубина без нелинейности бесполезна." />
      <Quiz q="Почему веса нельзя инициализировать одинаковыми (например, все нули)?" options={['Будет деление на ноль', 'Все нейроны слоя получат одинаковые градиенты и останутся одинаковыми — симметрия не нарушится', 'PyTorch не позволит', 'Можно, это стандартная практика']} answer={1}
        explain="Одинаковые нейроны вычисляют одно и то же и получают одинаковые градиенты, поэтому навсегда остаются копиями друг друга. Случайная инициализация ломает симметрию." />
    </>
  );
}
