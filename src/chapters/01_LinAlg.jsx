import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt } from '../components/ui.jsx';

function DotProduct() {
  const [a, setA] = useState(60), [b, setB] = useState(20), [la, setLa] = useState(1.5), [lb, setLb] = useState(1.2);
  const va = [la * Math.cos((a * Math.PI) / 180), la * Math.sin((a * Math.PI) / 180)];
  const vb = [lb * Math.cos((b * Math.PI) / 180), lb * Math.sin((b * Math.PI) / 180)];
  const dot = va[0] * vb[0] + va[1] * vb[1];
  const cos = dot / (la * lb);
  const S = 70, cx = 150, cy = 150;
  const P = (v) => [cx + v[0] * S, cy - v[1] * S];
  const proj = (dot / (lb * lb));
  const pv = [vb[0] * proj, vb[1] * proj];
  return (
    <Widget title="Скалярное произведение: алгебра и геометрия">
      <div className="row">
        <svg viewBox="0 0 300 300" style={{ width: 280, maxWidth: '100%' }}>
          <g className="grid">{[-2, -1, 0, 1, 2].map((k) => <g key={k}><line x1={cx + k * S} x2={cx + k * S} y1={0} y2={300} /><line y1={cy + k * S} y2={cy + k * S} x1={0} x2={300} /></g>)}</g>
          <line x1={P(vb)[0]} y1={P(vb)[1]} x2={P(pv)[0]} y2={P(pv)[1]} stroke="var(--muted)" />
          <line x1={P(va)[0]} y1={P(va)[1]} x2={P(pv)[0]} y2={P(pv)[1]} stroke="var(--muted)" strokeDasharray="3 3" />
          <line x1={cx} y1={cy} x2={P(pv)[0]} y2={P(pv)[1]} stroke="var(--c3)" strokeWidth={6} opacity={0.4} />
          <line x1={cx} y1={cy} x2={P(va)[0]} y2={P(va)[1]} stroke="var(--c1)" strokeWidth={3} />
          <line x1={cx} y1={cy} x2={P(vb)[0]} y2={P(vb)[1]} stroke="var(--c2)" strokeWidth={3} />
          <circle cx={P(va)[0]} cy={P(va)[1]} r={5} fill="var(--c1)" /><circle cx={P(vb)[0]} cy={P(vb)[1]} r={5} fill="var(--c2)" />
          <text x={P(va)[0] + 6} y={P(va)[1] - 6} fontWeight="700" style={{ fill: 'var(--c1)' }}>a</text>
          <text x={P(vb)[0] + 6} y={P(vb)[1] - 6} fontWeight="700" style={{ fill: 'var(--c2)' }}>b</text>
        </svg>
        <div className="col">
          <Slider label="угол a" value={a} min={0} max={360} onChange={setA} format={(v) => v + '°'} />
          <Slider label="длина a" value={la} min={0.2} max={2} step={0.05} onChange={setLa} />
          <Slider label="угол b" value={b} min={0} max={360} onChange={setB} format={(v) => v + '°'} />
          <Slider label="длина b" value={lb} min={0.2} max={2} step={0.05} onChange={setLb} />
          <p className="mono small">
            a = [{fmt(va[0], 2)}, {fmt(va[1], 2)}]<br />
            b = [{fmt(vb[0], 2)}, {fmt(vb[1], 2)}]<br />
            a·b = {fmt(va[0], 2)}·{fmt(vb[0], 2)} + {fmt(va[1], 2)}·{fmt(vb[1], 2)} = <b>{fmt(dot, 3)}</b><br />
            |a|·|b|·cos θ = {fmt(la, 2)}·{fmt(lb, 2)}·{fmt(cos, 3)} = <b>{fmt(la * lb * cos, 3)}</b><br />
            косинусное сходство = <b>{fmt(cos, 3)}</b>
          </p>
        </div>
      </div>
      <p className="small muted">Зелёная полоса — проекция a на направление b. Поверните векторы перпендикулярно — произведение станет 0; в противоположные стороны — отрицательным.</p>
    </Widget>
  );
}

function MatrixTransform() {
  const [m, setM] = useState([1, 0.5, 0, 1]);
  const S = 50, cx = 150, cy = 150;
  const T = ([x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
  const P = ([x, y]) => [cx + x * S, cy - y * S];
  const lines = [];
  for (let k = -3; k <= 3; k++) {
    lines.push([T([k, -3]), T([k, 3])]);
    lines.push([T([-3, k]), T([3, k])]);
  }
  const det = m[0] * m[3] - m[1] * m[2];
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(T).map(P);
  const set = (i) => (v) => { const n = [...m]; n[i] = v; setM(n); };
  return (
    <Widget title="Матрица — это преобразование пространства">
      <div className="row">
        <svg viewBox="0 0 300 300" style={{ width: 280, maxWidth: '100%' }}>
          <g className="grid">{[-3, -2, -1, 0, 1, 2, 3].map((k) => <g key={k}><line x1={cx + k * S} x2={cx + k * S} y1={0} y2={300} /><line y1={cy + k * S} y2={cy + k * S} x1={0} x2={300} /></g>)}</g>
          {lines.map(([p, q], i) => <line key={i} x1={P(p)[0]} y1={P(p)[1]} x2={P(q)[0]} y2={P(q)[1]} stroke="var(--c1)" strokeOpacity={0.45} />)}
          <polygon points={sq.map((p) => p.join(',')).join(' ')} fill="var(--c2)" fillOpacity={0.3} stroke="var(--c2)" />
          <line x1={cx} y1={cy} x2={P(T([1, 0]))[0]} y2={P(T([1, 0]))[1]} stroke="var(--c3)" strokeWidth={3} />
          <line x1={cx} y1={cy} x2={P(T([0, 1]))[0]} y2={P(T([0, 1]))[1]} stroke="var(--c4)" strokeWidth={3} />
        </svg>
        <div className="col">
          <Slider label="W₁₁" value={m[0]} min={-2} max={2} step={0.05} onChange={set(0)} />
          <Slider label="W₁₂" value={m[1]} min={-2} max={2} step={0.05} onChange={set(1)} />
          <Slider label="W₂₁" value={m[2]} min={-2} max={2} step={0.05} onChange={set(2)} />
          <Slider label="W₂₂" value={m[3]} min={-2} max={2} step={0.05} onChange={set(3)} />
          <div className="controls" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => setM([1, 0, 0, 1])}>единичная</button>
            <button className="btn small" onClick={() => setM([0, -1, 1, 0])}>поворот 90°</button>
            <button className="btn small" onClick={() => setM([2, 0, 0, 0.5])}>растяжение</button>
            <button className="btn small" onClick={() => setM([1, 1, 1, 1])}>вырожденная</button>
          </div>
          <p className="small">Зелёный вектор — куда перешёл <M t={r`\mathbf{e}_1=(1,0)`} /> (это первый <i>столбец</i> W), фиолетовый — куда перешёл <M t={r`\mathbf{e}_2`} />.
            Определитель {fmt(det, 2)} — во сколько раз изменилась площадь оранжевого квадрата{Math.abs(det) < 1e-3 ? ' (0: пространство сплющилось в прямую — информация потеряна)' : ''}.</p>
        </div>
      </div>
    </Widget>
  );
}

function MatMulStepper() {
  const A = [[1, 2, 0], [0, 1, 3]], B = [[2, 1], [1, 0], [4, 2]];
  const C = A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)));
  const [cell, setCell] = useState([0, 0]);
  const [i, j] = cell;
  const Mat = ({ X, hl }) => (
    <span className="matrix" style={{ gridTemplateColumns: `repeat(${X[0].length}, auto)` }}>
      {X.flatMap((row, a) => row.map((v, b) => <span key={a + '-' + b} className={'mc' + (hl(a, b) ? ' hl' : '')}>{v}</span>))}
    </span>
  );
  return (
    <Widget title="Умножение матриц: строка × столбец">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 18 }}>
        <span>A<sub>2×3</sub></span><Mat X={A} hl={(a) => a === i} />
        <span>·</span>
        <span>B<sub>3×2</sub></span><Mat X={B} hl={(_, b) => b === j} />
        <span>=</span>
        <span className="matrix" style={{ gridTemplateColumns: 'repeat(2, auto)' }}>
          {C.flatMap((row, a) => row.map((v, b) => (
            <span key={a + '-' + b} className={'mc' + (a === i && b === j ? ' hl2' : '')} style={{ cursor: 'pointer' }} onClick={() => setCell([a, b])}>{v}</span>
          )))}
        </span>
      </div>
      <p className="mono small" style={{ marginTop: 12 }}>
        C[{i}][{j}] = {A[i].map((a, k) => `${a}·${B[k][j]}`).join(' + ')} = <b>{C[i][j]}</b>
      </p>
      <p className="small muted">Щёлкните по любой клетке результата. Каждый элемент C — скалярное произведение строки A на столбец B. Внутренние размеры (3 и 3) должны совпасть, внешние (2 и 2) дают форму результата.</p>
    </Widget>
  );
}

export default function LinAlg() {
  return (
    <>
      <h1>Векторы и матрицы</h1>
      <p className="lead">Всё, что делает GPT, — это умножение матриц, сложение векторов и несколько нелинейных функций. Освоим этот язык.</p>

      <h2>Вектор — список чисел</h2>
      <p>
        <b>Вектор</b> размерности <M t="n" /> — упорядоченный набор из <M t="n" /> чисел: <M t={r`\mathbf{x} = (x_1, x_2, \dots, x_n)`} />.
        Его можно понимать двумя способами: как <i>точку</i> (или стрелку из начала координат) в <M t="n" />-мерном пространстве и как <i>набор признаков</i>.
        В GPT каждый токен представлен вектором из <M t="C" /> чисел (у GPT-2 small <M t="C=768" /> <Cite id="radford2019" />). Мы не можем нарисовать 768-мерное
        пространство, но все операции работают так же, как в 2D.
      </p>
      <p>Две базовые операции выполняются поэлементно:</p>
      <Eq t={r`\mathbf{x} + \mathbf{y} = (x_1 + y_1, \dots, x_n + y_n), \qquad \alpha\mathbf{x} = (\alpha x_1, \dots, \alpha x_n)`} />
      <p>
        Сложение векторов — основа <b>остаточного потока</b> трансформера (глава 12): каждый слой не заменяет вектор токена, а <i>прибавляет</i> к нему поправку.
      </p>

      <h2>Скалярное произведение — мера сходства</h2>
      <Eq t={r`\mathbf{a}\cdot\mathbf{b} = \sum_{i=1}^{n} a_i b_i = \lVert\mathbf{a}\rVert\,\lVert\mathbf{b}\rVert\cos\theta`} />
      <p>
        Это самая важная операция учебника. Слева — алгебраическое определение (перемножить покомпонентно и сложить), справа — геометрический смысл:
        произведение длин на косинус угла между векторами. Длина (норма) вектора: <M t={r`\lVert\mathbf{a}\rVert = \sqrt{\mathbf{a}\cdot\mathbf{a}} = \sqrt{\textstyle\sum a_i^2}`} />.
      </p>
      <DotProduct />
      <p>Почему два определения совпадают? Возьмём теорему косинусов для треугольника со сторонами <M t={r`\mathbf a`} />, <M t={r`\mathbf b`} />, <M t={r`\mathbf a - \mathbf b`} />:</p>
      <Eq t={r`\lVert\mathbf a-\mathbf b\rVert^2 = \lVert\mathbf a\rVert^2 + \lVert\mathbf b\rVert^2 - 2\lVert\mathbf a\rVert\lVert\mathbf b\rVert\cos\theta`} />
      <p>Раскрывая левую часть покомпонентно, <M t={r`\sum (a_i - b_i)^2 = \sum a_i^2 + \sum b_i^2 - 2\sum a_i b_i`} />. Сравнивая, получаем <M t={r`\sum a_i b_i = \lVert\mathbf a\rVert\lVert\mathbf b\rVert\cos\theta`} />. ∎</p>
      <Callout type="tip">
        <p>Большое положительное скалярное произведение — «векторы смотрят в одну сторону», ноль — «не связаны», отрицательное — «противоположны».
          Механизм внимания (глава 10) — это буквально «посчитать скалярное произведение запроса с ключом каждого токена и обратить внимание на самые похожие».
          <b> Косинусное сходство</b> <M t={r`\cos\theta = \frac{\mathbf a\cdot\mathbf b}{\lVert\mathbf a\rVert\lVert\mathbf b\rVert}`} /> — то же самое, но без влияния длин; им сравнивают эмбеддинги слов <Cite id="mikolov2013" />.</p>
      </Callout>

      <h2>Матрица — таблица чисел и линейное преобразование</h2>
      <p>
        Матрица <M t={r`W \in \mathbb{R}^{m\times n}`} /> — таблица из <M t="m" /> строк и <M t="n" /> столбцов. Умножение матрицы на вектор
        <M t={r`\mathbf{y} = W\mathbf{x}`} /> даёт вектор размерности <M t="m" />, где каждая компонента — скалярное произведение строки <M t="W" /> на <M t={r`\mathbf x`} />:
      </p>
      <Eq t={r`y_i = \sum_{j=1}^{n} W_{ij}\, x_j, \qquad i = 1..m`} />
      <p>
        Геометрически матрица — это <b>линейное преобразование</b>: поворот, растяжение, сдвиг-скос, проекция и их комбинации. «Линейное» значит:
        <M t={r`W(\alpha\mathbf x + \beta\mathbf y) = \alpha W\mathbf x + \beta W\mathbf y`} />. Прямые линии остаются прямыми, начало координат остаётся на месте.
      </p>
      <MatrixTransform />
      <p>
        Каждый слой нейросети вида <M t={r`W\mathbf x + \mathbf b`} /> (в PyTorch — <code>nn.Linear</code>) переводит вектор в новое пространство признаков. В GPT такие
        слои превращают вектор токена в «запрос», «ключ» и «значение» (глава 10), расширяют его в 4 раза в MLP и сужают обратно (глава 12).
      </p>

      <h2>Умножение матриц</h2>
      <p>Произведение <M t={r`C = AB`} />, где <M t={r`A\in\mathbb R^{m\times k}`} />, <M t={r`B\in\mathbb R^{k\times n}`} />, — матрица <M t={r`m\times n`} />:</p>
      <Eq t={r`C_{ij} = \sum_{p=1}^{k} A_{ip} B_{pj}`} />
      <MatMulStepper />
      <ul>
        <li><b>Правило форм:</b> <code>(m, k) @ (k, n) → (m, n)</code>. Внутренние размеры «сокращаются». 90% ошибок в коде нейросетей — несовпадение форм, и это правило их ловит.</li>
        <li><b>Не коммутативно:</b> в общем случае <M t={r`AB \ne BA`} />. Но ассоциативно: <M t={r`(AB)C = A(BC)`} />.</li>
        <li><b>Смысл:</b> <M t="AB" /> — композиция преобразований: сначала <M t="B" />, потом <M t="A" />.</li>
        <li><b>Стоимость:</b> <M t={r`m\cdot k\cdot n`} /> умножений и столько же сложений, т.е. <M t={r`2mkn`} /> операций с плавающей точкой (FLOP). Эту формулу мы используем в главе 13, чтобы посчитать, сколько вычислений нужно GPT.</li>
      </ul>

      <h3>Транспонирование</h3>
      <p>
        <M t={r`(A^\top)_{ij} = A_{ji}`} /> — строки становятся столбцами. Свойство: <M t={r`(AB)^\top = B^\top A^\top`} />. Скалярное произведение можно записать как
        матричное: <M t={r`\mathbf a\cdot\mathbf b = \mathbf a^\top\mathbf b`} />. А матрица всех попарных скалярных произведений строк <M t="Q" /> и строк <M t="K" /> — это <M t={r`QK^\top`} />.
        Запомните это выражение: оно — сердце внимания.
      </p>

      <h2>Тензоры, батчи и бродкастинг</h2>
      <p>
        <b>Тензор</b> в машинном обучении — просто многомерный массив. Вектор — тензор ранга 1, матрица — ранга 2. В GPT активации имеют форму
        <code>(B, T, C)</code>: <M t="B" /> последовательностей в батче, по <M t="T" /> токенов, у каждого вектор из <M t="C" /> чисел. Внутри внимания появляется
        4-мерный тензор <code>(B, nh, T, hs)</code> (глава 11).
      </p>
      <p>
        <b>Пакетное умножение</b> (batched matmul): если у тензоров больше двух измерений, <code>@</code> умножает матрицы по последним двум осям, а остальные оси считает «пачкой»:
        <code>(B, T, C) @ (C, 3C) → (B, T, 3C)</code>. <b>Бродкастинг</b>: при сложении тензоров разных форм недостающие оси «размножаются» — так вектор смещения
        <code>(C,)</code> прибавляется к каждому из <M t="B\cdot T" /> векторов.
      </p>
      <Code title="python — то же самое на PyTorch">{`
import torch
a = torch.tensor([1.0, 2.0, 3.0])
b = torch.tensor([4.0, -1.0, 0.5])
print(a @ b)                       # скалярное произведение: 1*4 + 2*(-1) + 3*0.5 = 3.5
print(torch.cosine_similarity(a, b, dim=0))

A = torch.randn(2, 3); B = torch.randn(3, 4)
print((A @ B).shape)               # torch.Size([2, 4])

x = torch.randn(8, 16, 64)         # (B, T, C): 8 последовательностей по 16 токенов, C=64
W = torch.randn(64, 192)           # Linear: C -> 3C
bias = torch.randn(192)
y = x @ W + bias                   # батчевое умножение + бродкастинг смещения
print(y.shape)                     # torch.Size([8, 16, 192])

Q = torch.randn(16, 64); K = torch.randn(16, 64)
S = Q @ K.T                        # (16, 16): попарные сходства всех токенов — будущая матрица внимания
`}</Code>

      <Quiz q="Какой формы будет результат (4, 10, 32) @ (32, 128)?" options={['(4, 10, 32)', '(4, 10, 128)', '(4, 128)', 'ошибка форм']} answer={1}
        explain="Матричное умножение действует по последним двум осям: (10, 32) @ (32, 128) → (10, 128), а ось батча 4 сохраняется." />
      <Quiz q="Скалярное произведение двух векторов равно 0. Что это значит?" options={['Один из них нулевой', 'Векторы перпендикулярны (или один нулевой)', 'Векторы совпадают', 'Векторы противоположны']} answer={1}
        explain="a·b = |a||b|cos θ = 0 ⇔ cos θ = 0 (θ = 90°) либо одна из длин нулевая." />
      <p className="muted small">Хотите глубже: глава 2 книги «Deep Learning» <Cite id="goodfellow2016" /> — сжатый курс линейной алгебры для ML.</p>
    </>
  );
}
