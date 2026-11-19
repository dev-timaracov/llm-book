import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt } from '../components/ui.jsx';
import { LineChart, ContourCanvas } from '../components/charts.jsx';

const FUNCS = {
  'x²': { f: (x) => x * x, d: (x) => 2 * x, tex: r`f(x)=x^2,\; f'(x)=2x` },
  'x³ − 2x': { f: (x) => x ** 3 - 2 * x, d: (x) => 3 * x * x - 2, tex: r`f(x)=x^3-2x,\; f'(x)=3x^2-2` },
  'sin x': { f: Math.sin, d: Math.cos, tex: r`f(x)=\sin x,\; f'(x)=\cos x` },
  'tanh x': { f: Math.tanh, d: (x) => 1 - Math.tanh(x) ** 2, tex: r`f(x)=\tanh x,\; f'(x)=1-\tanh^2 x` },
  'eˣ': { f: Math.exp, d: Math.exp, tex: r`f(x)=e^x,\; f'(x)=e^x` },
};

function Tangent() {
  const [name, setName] = useState('x³ − 2x');
  const [x0, setX0] = useState(1);
  const [h, setH] = useState(0.5);
  const F = FUNCS[name];
  const curve = useMemo(() => Array.from({ length: 200 }, (_, i) => { const x = -2.5 + (5 * i) / 199; return [x, F.f(x)]; }), [F]);
  const slope = F.d(x0), secant = (F.f(x0 + h) - F.f(x0)) / h;
  const ys = curve.map((p) => p[1]);
  const yd = [Math.max(-6, Math.min(...ys)), Math.min(8, Math.max(...ys))];
  return (
    <Widget title="Производная = наклон касательной = предел наклона секущей">
      <div className="controls">
        {Object.keys(FUNCS).map((k) => <button key={k} className={'btn small' + (k === name ? ' primary' : '')} onClick={() => setName(k)}>{k}</button>)}
      </div>
      <div className="controls">
        <Slider label="точка x₀" value={x0} min={-2} max={2} step={0.01} onChange={setX0} />
        <Slider label="шаг h секущей" value={h} min={0.001} max={1.5} step={0.001} onChange={setH} />
      </div>
      <LineChart xDomain={[-2.5, 2.5]} yDomain={yd} height={280}
        series={[
          { data: curve, color: 'var(--c1)', label: 'f(x)' },
          { data: [[-2.5, F.f(x0) + slope * (-2.5 - x0)], [2.5, F.f(x0) + slope * (2.5 - x0)]], color: 'var(--c3)', label: 'касательная', width: 2 },
          { data: [[-2.5, F.f(x0) + secant * (-2.5 - x0)], [2.5, F.f(x0) + secant * (2.5 - x0)]], color: 'var(--c2)', dashed: true, label: 'секущая' },
        ]}
        extra={(sx, sy) => (<>
          <circle cx={sx(x0)} cy={sy(F.f(x0))} r={5} fill="var(--c3)" />
          <circle cx={sx(x0 + h)} cy={sy(F.f(x0 + h))} r={4} fill="var(--c2)" />
        </>)} />
      <p className="mono small">
        <M t={F.tex} /><br />
        точная производная f′({fmt(x0, 2)}) = <b>{fmt(slope, 4)}</b>; наклон секущей (f(x₀+h)−f(x₀))/h = <b>{fmt(secant, 4)}</b>; ошибка {fmt(Math.abs(secant - slope), 4)}
      </p>
      <p className="small muted">Уменьшайте h — секущая прижимается к касательной, а ошибка убывает примерно пропорционально h.</p>
    </Widget>
  );
}

function GD1D() {
  const [lr, setLr] = useState(0.1);
  const [x0, setX0] = useState(-2.2);
  const f = (x) => 0.5 * x ** 4 - x ** 2 + 0.3 * x + 1.2, d = (x) => 2 * x ** 3 - 2 * x + 0.3;
  const traj = useMemo(() => { const p = [x0]; for (let i = 0; i < 30; i++) { const x = p[p.length - 1]; const n = x - lr * d(x); p.push(Math.abs(n) > 10 ? Math.sign(n) * 10 : n); } return p; }, [lr, x0]);
  const curve = Array.from({ length: 200 }, (_, i) => { const x = -2.4 + (4.8 * i) / 199; return [x, f(x)]; });
  return (
    <Widget title="Градиентный спуск в одном измерении">
      <div className="controls">
        <Slider label="скорость обучения η" value={lr} min={0.01} max={0.6} step={0.01} onChange={setLr} />
        <Slider label="старт x₀" value={x0} min={-2.3} max={2.3} step={0.05} onChange={setX0} />
      </div>
      <LineChart xDomain={[-2.4, 2.4]} yDomain={[0, 5]} height={260} series={[{ data: curve, color: 'var(--c1)' }]}
        extra={(sx, sy) => (<>
          <path d={traj.map((x, i) => `${i ? 'L' : 'M'}${sx(x)},${sy(f(x))}`).join('')} fill="none" stroke="var(--c2)" strokeWidth={1.5} />
          {traj.map((x, i) => <circle key={i} cx={sx(x)} cy={sy(f(x))} r={i === traj.length - 1 ? 6 : 3} fill={i === traj.length - 1 ? 'var(--c3)' : 'var(--c2)'} />)}
        </>)} />
      <p className="mono small">после 30 шагов: x = {fmt(traj[traj.length - 1], 4)}, f(x) = {fmt(f(traj[traj.length - 1]), 4)}</p>
      <p className="small muted">Маленький η — медленно, но надёжно. Большой η (больше ≈ 0.4 = 2/f″ в минимуме) — «прыжки» через минимум и расходимость. Старт справа приводит в другой (локальный) минимум — у невыпуклых функций результат зависит от начала.</p>
    </Widget>
  );
}

function GD2D() {
  const [lr, setLr] = useState(0.08);
  const [start, setStart] = useState([-1.6, 1.4]);
  const f = (x, y) => 0.6 * x * x + 2.5 * y * y + 0.5 * x * y;
  const g = (x, y) => [1.2 * x + 0.5 * y, 5 * y + 0.5 * x];
  const pts = useMemo(() => { const p = [start]; for (let i = 0; i < 40; i++) { const [x, y] = p[p.length - 1]; const [gx, gy] = g(x, y); p.push([x - lr * gx, y - lr * gy]); } return p; }, [lr, start]);
  const paths = useMemo(() => [{ pts, color: '#e8590c' }], [pts]);
  const domain = useMemo(() => [-2, 2, -2, 2], []);
  const fn = useMemo(() => f, []);
  const last = pts[pts.length - 1];
  return (
    <Widget title="Градиент в 2D: шаг против направления наибольшего роста">
      <div className="row">
        <div style={{ flex: '0 0 300px', maxWidth: '100%' }}><ContourCanvas f={fn} domain={domain} paths={paths} size={300} onClick={(x, y) => setStart([x, y])} /></div>
        <div className="col">
          <Slider label="η" value={lr} min={0.01} max={0.42} step={0.01} onChange={setLr} />
          <p className="small"><M t={r`f(x,y)=0.6x^2+2.5y^2+0.5xy`} /></p>
          <p className="small"><M t={r`\nabla f = \left(\tfrac{\partial f}{\partial x}, \tfrac{\partial f}{\partial y}\right) = (1.2x+0.5y,\; 5y+0.5x)`} /></p>
          <p className="mono small">через 40 шагов: ({fmt(last[0], 3)}, {fmt(last[1], 3)}), f = {fmt(f(...last), 5)}</p>
          <p className="small muted">Щёлкните по карте, чтобы выбрать старт. Функция вытянута: вдоль y она в 4 раза круче. При большом η траектория «скачет» поперёк долины — эту проблему решают momentum и Adam (глава 6).</p>
        </div>
      </div>
    </Widget>
  );
}

export default function Calculus() {
  return (
    <>
      <h1>Производные и градиенты</h1>
      <p className="lead">Обучение нейросети — это поиск минимума функции потерь от миллионов переменных. Инструмент поиска — производная.</p>

      <h2>Производная</h2>
      <p>Производная функции <M t="f" /> в точке <M t="x" /> — скорость изменения <M t="f" /> при малом изменении <M t="x" />:</p>
      <Eq t={r`f'(x) = \frac{df}{dx} = \lim_{h\to 0} \frac{f(x+h) - f(x)}{h}`} />
      <p>
        Практический смысл: <M t={r`f(x+h) \approx f(x) + f'(x)\,h`} /> при малых <M t="h" />. Если <M t={r`f'(x) = 3`} />, то, сдвинув <M t="x" /> на 0.01, мы изменим <M t="f" /> примерно на 0.03.
        Знак производной говорит, в какую сторону функция растёт.
      </p>
      <Tangent />

      <h3>Правила, которых хватит на весь учебник</h3>
      <table>
        <thead><tr><th>Функция</th><th>Производная</th><th>Где встретится</th></tr></thead>
        <tbody>
          <tr><td><M t={r`x^n`} /></td><td><M t={r`n x^{n-1}`} /></td><td>квадратичная ошибка, нормировки</td></tr>
          <tr><td><M t={r`e^x`} /></td><td><M t={r`e^x`} /></td><td>softmax</td></tr>
          <tr><td><M t={r`\ln x`} /></td><td><M t={r`1/x`} /></td><td>кросс-энтропия</td></tr>
          <tr><td><M t={r`\tanh x`} /></td><td><M t={r`1-\tanh^2 x`} /></td><td>активации, GELU</td></tr>
          <tr><td><M t={r`\sigma(x)=\frac{1}{1+e^{-x}}`} /></td><td><M t={r`\sigma(x)(1-\sigma(x))`} /></td><td>логистическая регрессия</td></tr>
          <tr><td><M t={r`\max(0,x)`} /> (ReLU)</td><td><M t={r`1`} /> при <M t="x>0" />, иначе <M t="0" /></td><td>MLP</td></tr>
          <tr><td><M t={r`u+v`} /></td><td><M t={r`u'+v'`} /></td><td>остаточные связи</td></tr>
          <tr><td><M t={r`u\cdot v`} /></td><td><M t={r`u'v+uv'`} /></td><td>везде</td></tr>
        </tbody>
      </table>

      <h2>Цепное правило</h2>
      <p>Если <M t={r`y = f(g(x))`} />, то</p>
      <Eq t={r`\frac{dy}{dx} = \frac{dy}{dg}\cdot\frac{dg}{dx} = f'(g(x))\cdot g'(x)`} />
      <p>
        Интуиция: если <M t="g" /> меняется в 3 раза быстрее <M t="x" />, а <M t="f" /> — в 2 раза быстрее <M t="g" />, то <M t="f" /> меняется в <M t="2\cdot 3=6" /> раз быстрее <M t="x" />.
        Скорости перемножаются вдоль цепочки. Нейросеть — это длинная цепочка функций, и <b>обратное распространение ошибки</b> (глава 5) — не что иное,
        как аккуратное применение цепного правила от выхода к входу <Cite id="rumelhart1986" />.
      </p>
      <p>Пример: <M t={r`y = \ln(1 + e^{2x})`} />. Обозначим <M t={r`u = 2x`} />, <M t={r`v = 1 + e^u`} />, <M t={r`y = \ln v`} />. Тогда</p>
      <Eq t={r`\frac{dy}{dx} = \frac{dy}{dv}\cdot\frac{dv}{du}\cdot\frac{du}{dx} = \frac{1}{v}\cdot e^u\cdot 2 = \frac{2e^{2x}}{1+e^{2x}}`} />

      <h2>Частные производные и градиент</h2>
      <p>
        У функции многих переменных <M t={r`f(x_1, \dots, x_n)`} /> частная производная <M t={r`\partial f/\partial x_i`} /> — производная по одной переменной при остальных
        «замороженных». Вектор всех частных производных называется <b>градиентом</b>:
      </p>
      <Eq t={r`\nabla f = \left(\frac{\partial f}{\partial x_1}, \dots, \frac{\partial f}{\partial x_n}\right)`} />
      <p>Ключевой факт: градиент указывает направление <b>наискорейшего роста</b> функции. Почему? Для малого шага <M t={r`\boldsymbol\delta`} />:</p>
      <Eq t={r`f(\mathbf x + \boldsymbol\delta) \approx f(\mathbf x) + \nabla f\cdot\boldsymbol\delta = f(\mathbf x) + \lVert\nabla f\rVert\lVert\boldsymbol\delta\rVert\cos\theta`} />
      <p>При фиксированной длине шага изменение максимально при <M t="\theta=0" /> (шаг вдоль градиента) и минимально при <M t="\theta=\pi" /> (против градиента). Поэтому, чтобы уменьшить функцию, шагаем против градиента:</p>
      <Eq t={r`\boxed{\;\theta \leftarrow \theta - \eta\,\nabla_\theta L(\theta)\;}`} label="градиентный спуск; η — скорость обучения (learning rate)" />
      <GD1D />
      <GD2D />

      <h2>Многомерное цепное правило</h2>
      <p>Если переменная <M t="x" /> влияет на результат <M t="L" /> через несколько путей <M t={r`u_1, \dots, u_k`} />, вклады путей <b>складываются</b>:</p>
      <Eq t={r`\frac{\partial L}{\partial x} = \sum_{j=1}^{k} \frac{\partial L}{\partial u_j}\,\frac{\partial u_j}{\partial x}`} />
      <p>
        Это объясняет, почему в коде autograd градиенты <i>накапливаются</i> (<code>grad += ...</code>), а не присваиваются: если переменная используется дважды,
        её градиент — сумма двух вкладов. Пример: <M t={r`L = x\cdot x`} />. По правилу произведения <M t={r`\partial L/\partial x = x + x = 2x`} /> — ровно сумма двух путей.
      </p>
      <Callout type="math" title="Векторная форма (пригодится в главе 5)">
        <p>Для <M t={r`\mathbf y = W\mathbf x`} /> и скалярной потери <M t="L" />, зная <M t={r`\partial L/\partial\mathbf y`} /> (вектор той же формы, что <M t={r`\mathbf y`} />):</p>
        <Eq t={r`\frac{\partial L}{\partial \mathbf x} = W^\top \frac{\partial L}{\partial \mathbf y}, \qquad \frac{\partial L}{\partial W} = \frac{\partial L}{\partial \mathbf y}\,\mathbf x^\top`} />
        <p>Проверка по компонентам: <M t={r`y_i = \sum_j W_{ij}x_j \Rightarrow \partial y_i/\partial W_{ij} = x_j`} />, значит <M t={r`\partial L/\partial W_{ij} = (\partial L/\partial y_i)\, x_j`} />. А <M t={r`x_j`} /> влияет на все <M t={r`y_i`} />, поэтому <M t={r`\partial L/\partial x_j = \sum_i (\partial L/\partial y_i) W_{ij}`} /> — это и есть <M t={r`W^\top`} />. Именно эти формулы реализованы в <code>matmul</code> нашего JS-autograd (глава 16).</p>
      </Callout>

      <h2>Численная проверка</h2>
      <p>Аналитическую производную всегда можно проверить численно — центральной разностью, которая точнее односторонней (ошибка <M t={r`O(h^2)`} /> вместо <M t={r`O(h)`} />):</p>
      <Eq t={r`f'(x) \approx \frac{f(x+h) - f(x-h)}{2h}`} />
      <Code title="python">{`
import math

def f(x):
    return math.log(1 + math.exp(2 * x))

def df_analytic(x):
    return 2 * math.exp(2 * x) / (1 + math.exp(2 * x))

x, h = 0.3, 1e-5
numeric = (f(x + h) - f(x - h)) / (2 * h)
print(numeric, df_analytic(x))   # 1.29131... 1.29131... — совпадают до ~1e-10

# градиентный спуск для f(x) = (x - 3)^2
x = 0.0
for step in range(50):
    grad = 2 * (x - 3)
    x -= 0.1 * grad
print(x)   # ≈ 3.0
`}</Code>
      <Quiz q="Функция потерь L зависит от параметра w как L = (2w − 1)². Чему равен градиент при w = 1?" options={['1', '2', '4', '0']} answer={2}
        explain="По цепному правилу dL/dw = 2(2w − 1)·2 = 4(2w − 1); при w = 1 получаем 4." />
      <Quiz q="Почему в autograd градиенты складываются (grad += ...)?" options={['Для численной устойчивости', 'Переменная может влиять на результат по нескольким путям, и вклады путей суммируются', 'Так быстрее', 'Это ошибка, нужно присваивать']} answer={1}
        explain="Многомерное цепное правило: ∂L/∂x = Σ по путям. Каждая операция, использующая x, добавляет свой вклад." />
    </>
  );
}
