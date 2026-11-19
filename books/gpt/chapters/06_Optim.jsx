import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt } from '@shared/ui.jsx';
import { ContourCanvas, LineChart } from '@shared/charts.jsx';

const SURFACES = {
  'вытянутая долина': {
    f: (x, y) => 0.1 * x * x + 3 * y * y,
    g: (x, y) => [0.2 * x, 6 * y],
    domain: [-4, 4, -2.5, 2.5], start: [-3.6, 1.6],
  },
  'Розенброк': {
    f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2,
    g: (x, y) => [-2 * (1 - x) - 40 * x * (y - x * x), 20 * (y - x * x)],
    domain: [-2, 2, -1, 3], start: [-1.5, 2.5],
  },
  'седло': {
    f: (x, y) => x * x - y * y + 0.25 * y ** 4 + 1.2,
    g: (x, y) => [2 * x, -2 * y + y ** 3],
    domain: [-2, 2, -2.2, 2.2], start: [-1.8, 0.02],
  },
};

function runOpt(kind, g, start, lr, steps) {
  let [x, y] = start;
  const pts = [[x, y]];
  let vx = 0, vy = 0, sx = 0, sy = 0, mx = 0, my = 0;
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (let t = 1; t <= steps; t++) {
    const [gx, gy] = g(x, y);
    if (kind === 'SGD') { x -= lr * gx; y -= lr * gy; }
    if (kind === 'Momentum') { vx = 0.9 * vx + gx; vy = 0.9 * vy + gy; x -= lr * vx; y -= lr * vy; }
    if (kind === 'RMSProp') { sx = 0.99 * sx + 0.01 * gx * gx; sy = 0.99 * sy + 0.01 * gy * gy; x -= (lr * gx) / (Math.sqrt(sx) + eps); y -= (lr * gy) / (Math.sqrt(sy) + eps); }
    if (kind === 'Adam') {
      mx = b1 * mx + (1 - b1) * gx; my = b1 * my + (1 - b1) * gy;
      sx = b2 * sx + (1 - b2) * gx * gx; sy = b2 * sy + (1 - b2) * gy * gy;
      const c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
      x -= (lr * (mx / c1)) / (Math.sqrt(sx / c2) + eps); y -= (lr * (my / c1)) / (Math.sqrt(sy / c2) + eps);
    }
    if (!Number.isFinite(x) || Math.abs(x) > 50 || Math.abs(y) > 50) break;
    pts.push([x, y]);
  }
  return pts;
}

const COLORS = { SGD: '#e03131', Momentum: '#f08c00', RMSProp: '#2f9e44', Adam: '#7048e8' };

function OptimizerRace() {
  const [surf, setSurf] = useState('вытянутая долина');
  const [lrSgd, setLrSgd] = useState(0.15);
  const [lrAdam, setLrAdam] = useState(0.1);
  const [steps, setSteps] = useState(100);
  const [start, setStart] = useState(SURFACES[surf].start);
  const S = SURFACES[surf];
  const [on, setOn] = useState({ SGD: true, Momentum: true, RMSProp: true, Adam: true });
  const paths = useMemo(() => Object.keys(COLORS).filter((k) => on[k]).map((k) => ({
    k, color: COLORS[k], pts: runOpt(k, S.g, start, k === 'SGD' || k === 'Momentum' ? lrSgd * (k === 'Momentum' ? 0.1 : 1) : lrAdam, steps),
  })), [S, start, lrSgd, lrAdam, steps, on]);
  const f = useMemo(() => S.f, [S]);
  return (
    <Widget title="Гонка оптимизаторов">
      <div className="controls">
        {Object.keys(SURFACES).map((k) => <button key={k} className={'btn small' + (k === surf ? ' primary' : '')} onClick={() => { setSurf(k); setStart(SURFACES[k].start); }}>{k}</button>)}
      </div>
      <div className="row">
        <div style={{ flex: '0 0 340px', maxWidth: '100%' }}><ContourCanvas f={f} domain={S.domain} paths={paths} size={340} onClick={(x, y) => setStart([x, y])} /></div>
        <div className="col">
          <Slider label="η для SGD (Momentum: η/10)" value={lrSgd} min={0.01} max={0.34} step={0.01} onChange={setLrSgd} />
          <Slider label="η для RMSProp и Adam" value={lrAdam} min={0.005} max={0.5} step={0.005} onChange={setLrAdam} />
          <Slider label="число шагов" value={steps} min={5} max={400} onChange={setSteps} />
          {paths.map((p) => {
            const [x, y] = p.pts[p.pts.length - 1];
            return (
              <label key={p.k} className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={on[p.k]} onChange={() => setOn({ ...on, [p.k]: !on[p.k] })} />
                <span style={{ width: 14, height: 4, background: p.color, display: 'inline-block' }} />
                <b style={{ width: 80 }}>{p.k}</b> <span className="mono">f = {fmt(S.f(x, y), 4)}</span>
              </label>
            );
          })}
          {Object.keys(COLORS).filter((k) => !on[k]).map((k) => (
            <label key={k} className="small" style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={false} onChange={() => setOn({ ...on, [k]: true })} /> {k}</label>
          ))}
          <p className="small muted">Щёлкните по карте, чтобы задать старт. На «долине» SGD при большом η скачет поперёк узкого направления и медленно ползёт вдоль пологого. Momentum накапливает скорость вдоль долины.
            Adam нормирует шаг по каждой координате — двигается почти одинаково быстро по обеим осям. На «седле» стартуйте почти на гребне (y ≈ 0): SGD долго «сидит» в седловой точке.</p>
        </div>
      </div>
    </Widget>
  );
}

function NoiseWidget() {
  const [B, setB] = useState(8);
  // оценка среднего по выборке размера B: стандартная ошибка ~ σ/√B
  const sigma = 1;
  const data = Array.from({ length: 64 }, (_, i) => { const b = i + 1; return [b, sigma / Math.sqrt(b)]; });
  return (
    <Widget title="Шум мини-батча: почему градиент по батчу — честная, но шумная оценка">
      <Slider label="размер батча B" value={B} min={1} max={64} onChange={setB} />
      <LineChart height={200} series={[{ data, color: 'var(--c1)', label: 'σ/√B — стандартное отклонение оценки градиента' }]}
        extra={(sx, sy) => <circle cx={sx(B)} cy={sy(sigma / Math.sqrt(B))} r={6} fill="var(--c2)" />} xLabel="B" />
      <p className="small muted">При B = {B} шум в {fmt(Math.sqrt(B), 2)} раза меньше, чем при B = 1, но шаг в {B} раз дороже. Удвоение точности требует учетверения батча — поэтому огромные батчи дают убывающую отдачу.</p>
    </Widget>
  );
}

export default function Optim() {
  return (
    <>
      <h1>Оптимизация: от SGD до AdamW</h1>
      <p className="lead">Мы умеем считать градиент. Теперь — как по нему шагать, чтобы обучение было быстрым и устойчивым. GPT учат оптимизатором AdamW с разогревом и косинусным расписанием; разберём, откуда каждый элемент.</p>

      <h2>Стохастический градиентный спуск</h2>
      <p>Функция потерь — среднее по огромному датасету: <M t={r`L(\theta) = \frac1N\sum_{i=1}^N \ell(x_i;\theta)`} />. Считать её целиком на каждом шаге невозможно. Берём случайный <b>мини-батч</b> <M t="\mathcal B" /> из <M t="B" /> примеров:</p>
      <Eq t={r`\mathbf g = \frac1B\sum_{i\in\mathcal B}\nabla_\theta\,\ell(x_i;\theta),\qquad \mathbb E[\mathbf g] = \nabla_\theta L,\qquad \theta\leftarrow\theta - \eta\,\mathbf g`} />
      <p>Оценка несмещённая (в среднем равна истинному градиенту), а её шум убывает как <M t={r`1/\sqrt B`} />. Шум даже полезен: помогает выскакивать из узких минимумов и седловых точек.</p>
      <NoiseWidget />

      <h2>Momentum (импульс)</h2>
      <p>Поляк <Cite id="polyak1964" /> предложил «тяжёлый шарик»: копить скорость как экспоненциальное среднее прошлых градиентов.</p>
      <Eq t={r`\mathbf v_t = \mu\,\mathbf v_{t-1} + \mathbf g_t,\qquad \theta_t = \theta_{t-1} - \eta\,\mathbf v_t\qquad(\mu\approx 0.9)`} />
      <p>Колебания поперёк долины гасятся (знаки градиента чередуются и взаимно сокращаются), движение вдоль долины ускоряется (до <M t={r`1/(1-\mu) = 10`} /> раз). Важность импульса и инициализации для глубоких сетей подробно разобрана у Суцкевера и др. <Cite id="sutskever2013" />.</p>

      <h2>RMSProp: свой шаг для каждого параметра</h2>
      <p>Разные параметры имеют градиенты совершенно разного масштаба (эмбеддинг редкого токена против LayerNorm). RMSProp <Cite id="hinton2012rmsprop" /> делит шаг на скользящее среднеквадратичное градиента:</p>
      <Eq t={r`\mathbf s_t = \beta\,\mathbf s_{t-1} + (1-\beta)\,\mathbf g_t^2,\qquad \theta_t = \theta_{t-1} - \eta\,\frac{\mathbf g_t}{\sqrt{\mathbf s_t}+\epsilon}`} />
      <p>Все операции поэлементные. Там, где градиенты большие, шаг уменьшается; где маленькие — увеличивается. Шаг становится примерно «единичным» в каждой координате.</p>

      <h2>Adam = Momentum + RMSProp + поправка смещения</h2>
      <p>Кингма и Ба <Cite id="kingma2014" />:</p>
      <Eq t={r`\begin{aligned}
\mathbf m_t &= \beta_1\mathbf m_{t-1} + (1-\beta_1)\,\mathbf g_t &&\text{(первый момент — среднее)}\\
\mathbf v_t &= \beta_2\mathbf v_{t-1} + (1-\beta_2)\,\mathbf g_t^2 &&\text{(второй момент — «дисперсия»)}\\
\hat{\mathbf m}_t &= \mathbf m_t/(1-\beta_1^t),\quad \hat{\mathbf v}_t = \mathbf v_t/(1-\beta_2^t) &&\text{(поправка смещения)}\\
\theta_t &= \theta_{t-1} - \eta\,\hat{\mathbf m}_t/(\sqrt{\hat{\mathbf v}_t}+\epsilon)
\end{aligned}`} />
      <Callout type="math" title="Откуда поправка смещения">
        <p><M t={r`\mathbf m_0 = 0`} />, поэтому на первых шагах среднее занижено. Раскрыв рекурсию, <M t={r`\mathbf m_t = (1-\beta_1)\sum_{i=1}^t\beta_1^{t-i}\mathbf g_i`} />. Если градиенты стационарны, <M t={r`\mathbb E[\mathbf m_t] = \mathbb E[\mathbf g](1-\beta_1)\sum_{i=1}^{t}\beta_1^{t-i} = \mathbb E[\mathbf g](1-\beta_1^t)`} />.
          Деление на <M t={r`1-\beta_1^t`} /> возвращает несмещённую оценку. При <M t={r`\beta_2 = 0.999`} /> без поправки <M t={r`\hat{\mathbf v}`} /> был бы в ~1000 раз занижен на первом шаге, и первый шаг был бы огромным.</p>
      </Callout>
      <OptimizerRace />

      <h2>AdamW: правильный weight decay</h2>
      <p>
        <b>L2-регуляризация</b> добавляет к потере <M t={r`\frac\lambda2\lVert\theta\rVert^2`} />, т.е. к градиенту <M t={r`\lambda\theta`} />. Для SGD это эквивалентно «затуханию весов» <M t={r`\theta\leftarrow(1-\eta\lambda)\theta - \eta\mathbf g`} />.
        Но в Adam добавка <M t={r`\lambda\theta`} /> попадает под деление на <M t={r`\sqrt{\hat{\mathbf v}}`} /> — и параметры с большими градиентами регуляризуются слабее. Лощилов и Хуттер <Cite id="loshchilov2017" /> предложили
        <b> отделить</b> затухание от адаптивного шага:
      </p>
      <Eq t={r`\theta_t = \theta_{t-1} - \eta\Big(\frac{\hat{\mathbf m}_t}{\sqrt{\hat{\mathbf v}_t}+\epsilon} + \lambda\,\theta_{t-1}\Big)`} />
      <p>Это AdamW — стандарт для трансформеров. Типичные значения для GPT: <M t={r`\beta_1 = 0.9`} />, <M t={r`\beta_2 = 0.95`} /> (GPT-3 <Cite id="brown2020" />) или 0.99 для маленьких моделей, <M t={r`\lambda = 0.1`} />. Weight decay применяют только к матрицам весов, но не к смещениям и параметрам LayerNorm — их уменьшение к нулю не имеет смысла.</p>

      <h2>Расписание скорости обучения</h2>
      <ul>
        <li><b>Разогрев (warmup).</b> В начале оценки моментов Adam неточны, а сеть случайна — большие шаги опасны. LR линейно растёт от ~0 до максимума за первые сотни/тысячи шагов <Cite id="goyal2017" />. Для трансформеров с post-LN разогрев был критичен; pre-LN делает обучение устойчивее <Cite id="xiong2020" />.</li>
        <li><b>Косинусное затухание</b> <Cite id="loshchilov2016" />: <M t={r`\eta_t = \eta_{min} + \tfrac12(\eta_{max}-\eta_{min})(1+\cos(\pi t/T))`} />. В конце обучения маленький LR позволяет «осесть» в минимуме. Интерактивный график — в главе 14.</li>
      </ul>

      <h2>Обрезка градиента</h2>
      <p>Иногда отдельный батч даёт аномально большой градиент, и один шаг разрушает модель. Pascanu и др. <Cite id="pascanu2013" /> предложили масштабировать градиент, если его норма превышает порог <M t="c" />:</p>
      <Eq t={r`\mathbf g \leftarrow \mathbf g\cdot\min\Big(1, \frac{c}{\lVert\mathbf g\rVert}\Big)`} />
      <p>Направление сохраняется, меняется только длина. В GPT обычно <M t="c=1.0" />. Норма градиента — полезная метрика для мониторинга: резкие всплески предвещают проблемы.</p>

      <Code title="python — AdamW руками (сверяем с torch.optim.AdamW)">{`
import torch

def adamw_step(p, g, m, v, t, lr=1e-3, b1=0.9, b2=0.99, eps=1e-8, wd=0.1):
    m.mul_(b1).add_((1 - b1) * g)            # m = b1*m + (1-b1)*g
    v.mul_(b2).add_((1 - b2) * g * g)        # v = b2*v + (1-b2)*g^2
    m_hat = m / (1 - b1 ** t)
    v_hat = v / (1 - b2 ** t)
    p.mul_(1 - lr * wd)                      # раздельный weight decay (сначала, как в PyTorch)
    p.sub_(lr * m_hat / (v_hat.sqrt() + eps))

torch.manual_seed(0)
w1 = torch.randn(5, requires_grad=True)
w2 = w1.detach().clone()
opt = torch.optim.AdamW([w1], lr=1e-3, betas=(0.9, 0.99), eps=1e-8, weight_decay=0.1)
m, v = torch.zeros(5), torch.zeros(5)
for t in range(1, 101):
    loss = (w1 ** 2).sum(); opt.zero_grad(); loss.backward(); opt.step()
    g = 2 * w2;  adamw_step(w2, g, m, v, t)
print((w1 - w2).abs().max())   # ~1e-9: реализации совпадают
`}</Code>
      <Quiz q="Зачем Adam делит шаг на √v?" options={['Чтобы ускорить вычисления', 'Чтобы шаг в каждой координате был примерно одного масштаба независимо от величины градиента', 'Это регуляризация', 'Чтобы градиент стал несмещённым']} answer={1}
        explain="√v — оценка типичной величины градиента по координате. m/√v ≈ ±1 при стабильном направлении, так что η задаёт размер шага почти напрямую." />
      <Quiz q="Чем AdamW отличается от Adam с L2-регуляризацией?" options={['Ничем', 'В AdamW затухание весов не проходит через деление на √v — все веса затухают одинаково относительно η·λ', 'AdamW не использует моменты', 'AdamW не делает поправку смещения']} answer={1}
        explain="В Adam+L2 член λθ нормируется адаптивно, и регуляризация оказывается неравномерной. AdamW применяет decay отдельно (Loshchilov & Hutter)." />
    </>
  );
}
