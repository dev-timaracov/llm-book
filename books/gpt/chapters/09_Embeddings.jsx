import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt } from '@shared/ui.jsx';
import { Heatmap, LineChart } from '@shared/charts.jsx';

// игрушечные 2D-эмбеддинги с «полом» и «возрастом/статусом» в качестве осей
const WORDS = { король: [0.9, 0.85], королева: [-0.85, 0.85], мужчина: [0.85, 0.05], женщина: [-0.85, 0.05], принц: [0.75, 0.45], принцесса: [-0.7, 0.45], мальчик: [0.7, -0.6], девочка: [-0.7, -0.6] };

function AnalogyWidget() {
  const [a, setA] = useState('король'), [b, setB] = useState('мужчина'), [c, setC] = useState('женщина');
  const v = WORDS[a].map((x, i) => x - WORDS[b][i] + WORDS[c][i]);
  const cos = (p, q) => (p[0] * q[0] + p[1] * q[1]) / (Math.hypot(...p) * Math.hypot(...q));
  const best = Object.keys(WORDS).filter((w) => ![a, b, c].includes(w)).sort((x, y) => cos(WORDS[y], v) - cos(WORDS[x], v))[0];
  const S = 120, cx = 150, cy = 140, P = ([x, y]) => [cx + x * S, cy - y * S];
  const sel = (val, set) => <select value={val} onChange={(e) => set(e.target.value)}>{Object.keys(WORDS).map((w) => <option key={w}>{w}</option>)}</select>;
  return (
    <Widget title="Арифметика смыслов: игрушечные эмбеддинги">
      <div className="controls">{sel(a, setA)} − {sel(b, setB)} + {sel(c, setC)} ≈ <b>{best}</b></div>
      <svg viewBox="0 0 300 260" style={{ width: 360, maxWidth: '100%' }}>
        <line x1={cx} y1={0} x2={cx} y2={260} stroke="var(--border)" /><line x1={0} y1={cy} x2={300} y2={cy} stroke="var(--border)" />
        <text x={292} y={cy - 4} textAnchor="end" className="sm" style={{ fontSize: 10 }}>«мужское» →</text>
        <text x={cx + 4} y={12} className="sm" style={{ fontSize: 10 }}>↑ «статус/возраст»</text>
        {Object.entries(WORDS).map(([w, p]) => <g key={w}><circle cx={P(p)[0]} cy={P(p)[1]} r={4} fill={w === best ? 'var(--c3)' : 'var(--c1)'} /><text x={P(p)[0] + 6} y={P(p)[1] + 4} fontSize="11">{w}</text></g>)}
        <circle cx={P(v)[0]} cy={P(v)[1]} r={7} fill="none" stroke="var(--c2)" strokeWidth={2} />
        <line x1={P(WORDS[b])[0]} y1={P(WORDS[b])[1]} x2={P(WORDS[a])[0]} y2={P(WORDS[a])[1]} stroke="var(--c2)" strokeDasharray="3 3" />
        <line x1={P(WORDS[c])[0]} y1={P(WORDS[c])[1]} x2={P(v)[0]} y2={P(v)[1]} stroke="var(--c2)" strokeDasharray="3 3" />
      </svg>
      <p className="small muted">Здесь оси заданы вручную, чтобы было видно идею. В настоящей модели размерность сотни и тысячи, и «направления смысла» не выровнены по осям — но word2vec действительно находил «король − мужчина + женщина ≈ королева» (Mikolov и др., 2013).</p>
    </Widget>
  );
}

function SinusoidWidget() {
  const [d, setD] = useState(32);
  const [T, setT] = useState(48);
  const [p0, setP0] = useState(20);
  const pe = useMemo(() => Array.from({ length: T }, (_, pos) => Array.from({ length: d }, (_, i) => {
    const k = Math.floor(i / 2), freq = 1 / Math.pow(10000, (2 * k) / d);
    return i % 2 === 0 ? Math.sin(pos * freq) : Math.cos(pos * freq);
  })), [d, T]);
  const sim = pe.map((row) => row.reduce((s, v, i) => s + v * pe[p0][i], 0) / (d / 2));
  return (
    <Widget title="Синусоидальное позиционное кодирование">
      <div className="controls">
        <Slider label="размерность d" value={d} min={8} max={64} step={2} onChange={setD} />
        <Slider label="позиций T" value={T} min={8} max={64} onChange={setT} />
        <Slider label="позиция p для сравнения" value={p0} min={0} max={T - 1} onChange={setP0} />
      </div>
      <p className="small muted">Строки — позиции 0…{T - 1}, столбцы — компоненты вектора. Левые столбцы колеблются быстро (высокая частота), правые — медленно.</p>
      <div style={{ overflowX: 'auto' }}><Heatmap values={pe} diverging showValues={false} cell={9} lo={-1} hi={1} highlight={(i) => i === p0} /></div>
      <LineChart height={200} series={[{ data: sim.map((s, i) => [i, s]), color: 'var(--c1)', points: true }]} xLabel="позиция" yLabel={`сходство с p=${p0}`} legend={false} />
      <p className="small muted">Скалярное произведение PE(p)·PE(q) зависит только от разности p − q (см. вывод в тексте): график симметричен относительно p и одинаков по форме для любого p.</p>
    </Widget>
  );
}

export default function Embeddings() {
  return (
    <>
      <h1>Эмбеддинги и позиции</h1>
      <p className="lead">Токен — это целое число. Первый слой GPT превращает его в вектор и добавляет информацию о том, где в тексте он стоит.</p>

      <h2>Таблица эмбеддингов</h2>
      <p>Матрица <M t={r`W_{te}\in\mathbb R^{V\times C}`} /> хранит по строке на токен. Эмбеддинг токена <M t="x" /> — его строка:</p>
      <Eq t={r`\mathbf e_x = W_{te}[x] = \mathrm{onehot}(x)^\top W_{te}`} />
      <p>
        Формально это умножение one-hot вектора на матрицу, но никто не умножает: просто берут строку по индексу (<code>nn.Embedding</code>). Обратный проход — тоже простой: градиент приходит
        только в те строки, чьи токены были в батче (scatter-add, глава 5). Значения в таблице — обычные параметры, они учатся вместе со всей сетью. Никто не говорит модели, что «кот» и «пёс»
        похожи, — она обнаруживает это сама, потому что их похожие векторы помогают предсказывать похожие продолжения <Cite id="bengio2003,mikolov2013" />.
      </p>
      <AnalogyWidget />
      <Callout type="note" title="Связанные веса (weight tying)">
        <p>На выходе GPT стоит матрица <M t={r`W_{out}\in\mathbb R^{C\times V}`} />, превращающая вектор в логиты: логит токена <M t="j" /> — скалярное произведение итогового вектора на «выходной эмбеддинг» токена <M t="j" />.
          Пресс и Вольф <Cite id="press2017" /> показали, что можно использовать одну матрицу: <M t={r`W_{out} = W_{te}^\top`} />. Это экономит <M t={r`V\cdot C`} /> параметров (для GPT-2 small — 38.6 млн из 124 млн!) и улучшает качество. Так сделано в GPT-2 и в нашем <code>model.py</code>.</p>
      </Callout>

      <h2>Зачем нужны позиции</h2>
      <p>
        В следующей главе мы увидим, что внимание — это взвешенная сумма по токенам, где веса зависят от скалярных произведений. Если переставить входные токены, выходы просто переставятся так же
        (внимание <b>эквивариантно к перестановкам</b>): <M t={r`\mathrm{Attn}(PX) = P\,\mathrm{Attn}(X)`} /> для любой матрицы перестановки <M t="P" />. Проверка:
        <M t={r`\mathrm{softmax}(PQ(PK)^\top)PV = P\,\mathrm{softmax}(QK^\top)P^\top P V = P\,\mathrm{softmax}(QK^\top)V`} /> (softmax по строкам коммутирует с перестановкой строк и столбцов, <M t={r`P^\top P = I`} />).
        Значит, без дополнительной информации «собака кусает человека» и «человек кусает собаку» для модели — один и тот же мешок слов. Нужно сообщить модели позицию каждого токена.
      </p>

      <h2>Синусоидальное кодирование (оригинальный трансформер)</h2>
      <p>Васвани и др. <Cite id="vaswani2017" /> прибавляют к эмбеддингу фиксированный вектор:</p>
      <Eq t={r`PE_{(p, 2k)} = \sin\!\Big(\frac{p}{10000^{2k/C}}\Big),\qquad PE_{(p, 2k+1)} = \cos\!\Big(\frac{p}{10000^{2k/C}}\Big)`} />
      <p>Каждая пара компонент — «стрелка часов», вращающаяся со своей частотой <M t={r`\omega_k = 10000^{-2k/C}`} />: от одного оборота за ~6 позиций до одного оборота за ~60 000 позиций. Вместе они как двоичный счётчик, только непрерывный.</p>
      <SinusoidWidget />
      <Callout type="math" title="Почему кодирование «относительное»">
        <p>Для пары компонент с частотой <M t={r`\omega`} /> по формуле косинуса разности:</p>
        <Eq t={r`\sin(\omega p)\sin(\omega q) + \cos(\omega p)\cos(\omega q) = \cos(\omega(p - q))`} />
        <p>Значит <M t={r`PE(p)\cdot PE(q) = \sum_k\cos(\omega_k(p-q))`} /> — зависит только от расстояния. Более того, <M t={r`PE(p+\Delta)`} /> получается из <M t={r`PE(p)`} /> линейным преобразованием (поворотом каждой пары на угол <M t={r`\omega_k\Delta`} />), так что модели легко научиться «смотреть на 3 токена назад».</p>
      </Callout>

      <h2>Обучаемые позиции (GPT-1/2/3)</h2>
      <p>
        GPT <Cite id="radford2018,radford2019" /> поступает проще: ещё одна таблица <M t={r`W_{pe}\in\mathbb R^{T_{max}\times C}`} />, обучаемая как обычные параметры. Вход первого блока:
      </p>
      <Eq t={r`\mathbf x_t^{(0)} = W_{te}[\text{token}_t] + W_{pe}[t]`} />
      <p>Минус: модель не может работать с последовательностями длиннее <M t={r`T_{max}`} /> (у GPT-2 — 1024), строки для дальних позиций обучаются реже. Плюс — простота, и на практике качество не хуже синусоид.</p>
      <p>Почему <b>складывать</b>, а не склеивать (concat)? В пространстве размерности 768 случайные векторы почти ортогональны, так что сумма «токен + позиция» почти без потерь хранит оба слагаемых, а последующие линейные слои могут их «расплести». Склеивание потребовало бы увеличить ширину.</p>

      <h2>RoPE — то, что используют сейчас</h2>
      <p>
        Современные модели (LLaMA <Cite id="touvron2023" /> и большинство открытых LLM) используют <b>ротационные позиционные эмбеддинги</b> RoPE <Cite id="su2021" />. Вместо прибавления к входу, векторы запросов
        и ключей <i>внутри внимания</i> поворачиваются на угол, пропорциональный позиции: пара компонент <M t={r`(q_{2k}, q_{2k+1})`} /> на позиции <M t="p" /> поворачивается на <M t={r`p\,\omega_k`} />.
      </p>
      <Eq t={r`\langle R_p\mathbf q, R_s\mathbf k\rangle = \langle\mathbf q, R_p^\top R_s\mathbf k\rangle = \langle\mathbf q, R_{s-p}\mathbf k\rangle`} />
      <p>Скалярное произведение запроса и ключа зависит только от <i>относительного</i> сдвига <M t="s-p" /> — ровно то, что нужно вниманию. Подробнее и с кодом — в главе 18.</p>

      <Code title="python — эмбеддинги в GPT">{`
import torch, torch.nn as nn
V, T_max, C = 65, 256, 384
wte = nn.Embedding(V, C)          # токены
wpe = nn.Embedding(T_max, C)      # позиции

idx = torch.tensor([[20, 43, 50, 50, 53]])        # (B=1, T=5) — номера токенов
pos = torch.arange(idx.size(1))                    # [0, 1, 2, 3, 4]
x = wte(idx) + wpe(pos)                            # (1, 5, C) + (5, C) -> бродкаст -> (1, 5, C)
print(x.shape)

# синусоиды из оригинального трансформера
def sinusoidal(T, C):
    pos = torch.arange(T).unsqueeze(1)                       # (T, 1)
    freq = torch.exp(-torch.arange(0, C, 2) * (torch.log(torch.tensor(10000.0)) / C))  # (C/2,)
    pe = torch.zeros(T, C)
    pe[:, 0::2] = torch.sin(pos * freq)
    pe[:, 1::2] = torch.cos(pos * freq)
    return pe
`}</Code>
      <Quiz q="Что произойдёт, если убрать позиционные эмбеддинги из GPT?" options={['Ничего, внимание само знает порядок', 'Модель не сможет различать порядок токенов (кроме косвенно — через каузальную маску)', 'Обучение станет невозможным', 'Модель будет видеть будущее']} answer={1}
        explain="Внимание эквивариантно к перестановкам. Интересная тонкость: каузальная маска даёт косвенный сигнал о позиции (токен видит ровно t предшественников), и модели могут частично этим пользоваться — но явные позиции работают гораздо лучше." />
    </>
  );
}
