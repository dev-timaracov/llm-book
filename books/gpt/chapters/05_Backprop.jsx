import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt } from '@shared/ui.jsx';
import { Value } from '../lib/autograd.js';
import microgradSrc from '../python/micrograd.py?raw';

// Рисуем вычислительный граф L = (a*b + c) * f, с возможностью шагать по backward
function GraphWidget() {
  const [av, setA] = useState(2), [bv, setB] = useState(-3), [cv, setC] = useState(10), [fv, setF] = useState(-2);
  const [step, setStep] = useState(0);
  const g = useMemo(() => {
    const a = new Value(av, [], '', 'a'), b = new Value(bv, [], '', 'b'), c = new Value(cv, [], '', 'c'), f = new Value(fv, [], '', 'f');
    const e = a.mul(b); e.label = 'e = a·b';
    const d = e.add(c); d.label = 'd = e + c';
    const L = d.mul(f); L.label = 'L = d·f';
    const order = L.backward(); // заполнит градиенты
    return { a, b, c, f, e, d, L, order };
  }, [av, bv, cv, fv]);
  // порядок «открытия» градиентов при обратном проходе
  const seq = [g.L, g.d, g.f, g.e, g.c, g.a, g.b];
  const shown = new Set(seq.slice(0, step));
  const nodes = [
    { v: g.a, x: 20, y: 20 }, { v: g.b, x: 20, y: 110 }, { v: g.c, x: 200, y: 190 }, { v: g.f, x: 380, y: 190 },
    { v: g.e, x: 200, y: 65 }, { v: g.d, x: 380, y: 95 }, { v: g.L, x: 560, y: 140 },
  ];
  const pos = new Map(nodes.map((n) => [n.v, n]));
  const W = 140, H = 54;
  const edges = [[g.a, g.e], [g.b, g.e], [g.e, g.d], [g.c, g.d], [g.d, g.L], [g.f, g.L]];
  const explain = [
    'Нажмите «шаг назад», чтобы пройти backward по графу.',
    'dL/dL = 1 — начальная точка.',
    'L = d·f ⇒ dL/dd = f = ' + fmt(fv, 0) + '.',
    'L = d·f ⇒ dL/df = d = ' + fmt(g.d.data, 0) + '.',
    'd = e + c ⇒ dd/de = 1, поэтому dL/de = dL/dd · 1 = ' + fmt(g.e.grad, 0) + ' (сложение «раздаёт» градиент без изменений).',
    'Аналогично dL/dc = dL/dd · 1 = ' + fmt(g.c.grad, 0) + '.',
    'e = a·b ⇒ dL/da = dL/de · b = ' + fmt(g.e.grad, 0) + '·' + fmt(bv, 0) + ' = ' + fmt(g.a.grad, 0) + ' (умножение «меняет местами» входы).',
    'dL/db = dL/de · a = ' + fmt(g.e.grad, 0) + '·' + fmt(av, 0) + ' = ' + fmt(g.b.grad, 0) + '. Готово: мы знаем, как L зависит от каждого входа.',
  ];
  return (
    <Widget title="Вычислительный граф и обратный проход шаг за шагом">
      <div className="controls">
        <Slider label="a" value={av} min={-5} max={5} onChange={setA} /><Slider label="b" value={bv} min={-5} max={5} onChange={setB} />
        <Slider label="c" value={cv} min={-10} max={10} onChange={setC} /><Slider label="f" value={fv} min={-5} max={5} onChange={setF} />
      </div>
      <svg viewBox="0 0 720 260" className="diagram">
        <defs><marker id="ah5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker></defs>
        {edges.map(([u, v], i) => { const p = pos.get(u), q = pos.get(v); return <path key={i} className="arrow" d={`M${p.x + W} ${p.y + H / 2} L${q.x - 2} ${q.y + H / 2}`} markerEnd="url(#ah5)" />; })}
        {nodes.map(({ v, x, y }, i) => (
          <g key={i}>
            <rect x={x} y={y} width={W} height={H} rx={8} className={'box ' + (shown.has(v) ? 'hl2' : '')} />
            <text x={x + W / 2} y={y + 20} textAnchor="middle" fontWeight="600">{v.label}</text>
            <text x={x + W / 2} y={y + 36} textAnchor="middle" className="mono" fontSize="12">значение {fmt(v.data, 0)}</text>
            <text x={x + W / 2} y={y + 50} textAnchor="middle" className="mono" fontSize="12" style={{ fill: 'var(--green)' }}>{shown.has(v) ? `grad ${fmt(v.grad, 0)}` : 'grad ?'}</text>
          </g>
        ))}
      </svg>
      <div className="controls">
        <button className="btn" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← вперёд</button>
        <button className="btn primary" onClick={() => setStep(Math.min(seq.length, step + 1))} disabled={step === seq.length}>шаг назад →</button>
        <button className="btn" onClick={() => setStep(seq.length)}>весь backward</button>
      </div>
      <p className="small">{explain[step]}</p>
    </Widget>
  );
}

function NumericCheck() {
  const [x, setX] = useState(0.7);
  const f = (t) => { const v = new Value(t); return v.mul(v).tanh().mul(v).add(v.exp()).log(); };
  const out = f(x);
  const order = out.topo(); out.backward();
  const leaf = order[0];
  const h = 1e-5, num = (f(x + h).data - f(x - h).data) / (2 * h);
  return (
    <Widget title="Проверка autograd численной производной" badge="проверка">
      <Slider label="x" value={x} min={-0.7} max={2} step={0.01} onChange={setX} />
      <p className="mono small"><M t={r`L(x) = \ln\big(\tanh(x^2)\cdot x + e^x\big)`} /> <span className="muted">(определена при x &gt; ≈ −0.76: аргумент логарифма должен быть положительным)</span><br />
        autograd: dL/dx = <b>{fmt(leaf.grad, 8)}</b><br />
        численно (L(x+h) − L(x−h)) / 2h = <b>{fmt(num, 8)}</b><br />
        узлов в графе: {order.length}
      </p>
    </Widget>
  );
}

export default function Backprop() {
  return (
    <>
      <h1>Обратное распространение и autograd</h1>
      <p className="lead">Как за один проход посчитать производную функции потерь по миллиарду параметров? Ответ — обратный режим автоматического дифференцирования. Напишем его с нуля.</p>

      <h2>Три способа считать производные</h2>
      <ol>
        <li><b>Символьно</b> (как в учебнике матанализа) — выражения разрастаются экспоненциально.</li>
        <li><b>Численно</b> <M t={r`(L(\theta+h e_i) - L(\theta - h e_i))/2h`} /> — нужно 2 прохода <i>на каждый параметр</i>. Для GPT-2 (124M параметров) — 248 миллионов прогонов на один шаг. Непрактично, но идеально для проверки.</li>
        <li><b>Автоматически</b> — разбиваем вычисление на элементарные операции с известными производными и комбинируем их по цепному правилу <Cite id="baydin2015" />.
          В <b>обратном режиме</b> (reverse mode) градиент по всем параметрам получается за один прямой и один обратный проход — стоимостью порядка 2–3 прямых проходов, независимо от числа параметров.
          В контексте нейросетей это и называется <b>backpropagation</b> <Cite id="rumelhart1986" />.</li>
      </ol>

      <h2>Вычислительный граф</h2>
      <p>
        Любое вычисление можно записать как направленный ациклический граф: листья — входы и параметры, внутренние узлы — операции. Прямой проход вычисляет значения от листьев к корню.
        Обратный проход идёт от корня <M t="L" /> к листьям, и в каждом узле <M t="v" /> хранит <b>сопряжённую переменную</b> (adjoint) <M t={r`\bar v = \partial L/\partial v`} />.
      </p>
      <p>Правило для узла <M t={r`v = g(u_1, \dots, u_k)`} />: зная <M t={r`\bar v`} />, добавить к каждому входу</p>
      <Eq t={r`\bar u_i \mathrel{+}= \bar v\cdot\frac{\partial g}{\partial u_i}`} />
      <p>Чтобы к моменту обработки узла его <M t={r`\bar v`} /> был полностью накоплен (от всех потребителей), узлы обходят в <b>обратном топологическом порядке</b>.</p>
      <GraphWidget />
      <Callout type="tip" title="Шаблоны, которые стоит запомнить">
        <ul>
          <li><b>Сложение</b> — «распределитель»: копирует градиент всем входам. Поэтому остаточные связи <M t="x + f(x)" /> дают градиенту «скоростную магистраль» к ранним слоям <Cite id="he2016resnet" />.</li>
          <li><b>Умножение</b> — «переключатель»: градиент по одному входу = градиент выхода × <i>другой</i> вход.</li>
          <li><b>max/ReLU</b> — «маршрутизатор»: пропускает градиент только туда, где был максимум/положительное значение.</li>
          <li><b>Разветвление</b> (переменная используется дважды) — градиенты <b>складываются</b>.</li>
        </ul>
      </Callout>

      <h2>micrograd: autograd за 100 строк</h2>
      <p>
        Реализуем класс <code>Value</code> — число, которое помнит своё происхождение. Каждая операция создаёт новый <code>Value</code> и замыкание <code>_backward</code>, которое знает локальную
        производную. Метод <code>backward()</code> делает топологическую сортировку и вызывает замыкания в обратном порядке. Идея и название — из учебного проекта Андрея Карпаты; код ниже написан для этого учебника
        и лежит в <code>books/gpt/python/micrograd.py</code>.
      </p>
      <Code title="books/gpt/python/micrograd.py">{microgradSrc}</Code>
      <p>Тот же класс на JavaScript (<code>books/gpt/lib/autograd.js</code>) работает в виджетах этой и прошлой главы. Проверим его:</p>
      <NumericCheck />

      <h2>От скаляров к тензорам</h2>
      <p>
        Скалярный autograd создаёт узел на каждое умножение — для GPT это миллиарды узлов. Настоящие фреймворки (PyTorch <Cite id="paszke2019" />) работают с <b>тензорными</b> операциями:
        узел графа — целое матричное умножение, а его backward — тоже матричные умножения. Выведем главные формулы, которые понадобятся в трансформере.
        Пусть <M t={r`G = \partial L/\partial Y`} /> — градиент, пришедший сверху (той же формы, что <M t="Y" />).
      </p>
      <table>
        <thead><tr><th>Операция</th><th>Прямой проход</th><th>Обратный проход</th></tr></thead>
        <tbody>
          <tr><td>Матричное умножение</td><td><M t={r`Y = XW`} /></td><td><M t={r`\bar X = G W^\top,\;\; \bar W = X^\top G`} /></td></tr>
          <tr><td>Смещение (бродкаст)</td><td><M t={r`Y = X + \mathbf b`} /></td><td><M t={r`\bar X = G,\;\; \bar{\mathbf b} = \sum_{\text{строки}} G`} /></td></tr>
          <tr><td>Поэлементная функция</td><td><M t={r`Y = \varphi(X)`} /></td><td><M t={r`\bar X = G\odot\varphi'(X)`} /></td></tr>
          <tr><td>Эмбеддинг (выбор строк)</td><td><M t={r`Y_i = E_{x_i}`} /></td><td><M t={r`\bar E_{x_i} \mathrel{+}= G_i`} /> (scatter-add)</td></tr>
          <tr><td>Softmax по строкам</td><td><M t={r`P = \mathrm{softmax}(S)`} /></td><td><M t={r`\bar S = P\odot(G - \mathrm{rowsum}(G\odot P))`} /></td></tr>
          <tr><td>Softmax + CE</td><td><M t={r`L = -\frac1N\sum_i\log P_{i,y_i}`} /></td><td><M t={r`\bar Z = (P - \mathrm{onehot}(y))/N`} /></td></tr>
        </tbody>
      </table>
      <p>
        Проверка форм для <M t={r`Y = XW`} />: <M t="X" /> — <code>(N, k)</code>, <M t="W" /> — <code>(k, m)</code>, <M t="G" /> — <code>(N, m)</code>. <M t={r`GW^\top`} /> — <code>(N, m)(m, k) = (N, k)</code> ✓.
        <M t={r`X^\top G`} /> — <code>(k, N)(N, m) = (k, m)</code> ✓. Совет: если не помните формулу, выведите её из требования «формы должны сойтись» — почти всегда это единственный вариант.
      </p>
      <Callout type="math" title="Backward для LayerNorm (используется в каждом блоке GPT)">
        <p>Для строки <M t={r`\mathbf x\in\mathbb R^C`} />: <M t={r`\mu = \frac1C\sum x_j`} />, <M t={r`\sigma^2 = \frac1C\sum(x_j-\mu)^2`} />, <M t={r`\hat x_j = (x_j-\mu)/\sqrt{\sigma^2+\epsilon}`} />, <M t={r`y_j = \gamma_j\hat x_j + \beta_j`} />.
          Обозначив <M t={r`\bar{\hat x}_j = \bar y_j\gamma_j`} />, после аккуратного дифференцирования (μ и σ зависят от всех <M t="x_j" />) получаем:</p>
        <Eq t={r`\bar x_j = \frac{1}{\sqrt{\sigma^2+\epsilon}}\Big(\bar{\hat x}_j - \frac1C\sum_k\bar{\hat x}_k - \hat x_j\cdot\frac1C\sum_k\bar{\hat x}_k\hat x_k\Big),\quad \bar\gamma_j = \sum \bar y_j\hat x_j,\quad \bar\beta_j = \sum\bar y_j`} />
        <p>Именно так написана функция <code>layernorm</code> в <code>books/gpt/lib/tensor.js</code>; правильность проверена численным градиентом.</p>
      </Callout>

      <h2>Что делает PyTorch при <code>loss.backward()</code></h2>
      <Code title="python">{`
import torch
a = torch.tensor(2.0, requires_grad=True)
b = torch.tensor(-3.0, requires_grad=True)
c = torch.tensor(10.0, requires_grad=True)
f = torch.tensor(-2.0, requires_grad=True)
L = (a * b + c) * f        # PyTorch на лету строит граф (define-by-run)
print(L.grad_fn)           # <MulBackward0> — узел графа с замыканием backward
L.backward()               # обратный проход
print(a.grad, b.grad, c.grad, f.grad)   # tensor(6.) tensor(-4.) tensor(-2.) tensor(4.)
# ровно те же числа, что в виджете выше при a=2, b=-3, c=10, f=-2
`}</Code>
      <Callout type="danger" title="Частые ошибки">
        <ul>
          <li>Забыть <code>optimizer.zero_grad()</code> — градиенты с прошлых шагов продолжат накапливаться (из-за <code>+=</code>).</li>
          <li>Менять тензор «на месте» (<code>x += 1</code>), который нужен для backward, — PyTorch выдаст ошибку о версии тензора.</li>
          <li>Считать метрики без <code>torch.no_grad()</code> — граф строится зря и тратит память.</li>
        </ul>
      </Callout>
      <Quiz q="Сколько обратных проходов нужно, чтобы получить градиент скалярной потери по 1 млрд параметров?" options={['1 млрд', '2 млрд', '1', 'зависит от числа слоёв']} answer={2}
        explain="В этом сила обратного режима: один backward даёт ∂L/∂θ сразу для всех θ. Цена — нужно хранить промежуточные активации прямого прохода." />
      <Quiz q="Y = XW, X имеет форму (32, 64), W — (64, 10). Какой формы ∂L/∂W и как он считается?" options={['(32, 10), G·Wᵀ', '(64, 10), Xᵀ·G', '(10, 64), Gᵀ·X', '(64, 32), Xᵀ']} answer={1}
        explain="Градиент всегда имеет форму параметра — (64, 10). Xᵀ (64, 32) на G (32, 10) даёт (64, 10)." />
    </>
  );
}
