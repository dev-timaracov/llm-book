import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt } from '@shared/ui.jsx';
import { Heatmap, LineChart } from '@shared/charts.jsx';
import { makeRng } from '@shared/rng.js';

const TOKENS = ['Кот', 'сел', 'на', 'ковёр', ',', 'потому', 'что', 'он', 'устал'];

// Игрушечные Q и K, построенные так, чтобы «он» искал существительное-подлежащее
function makeToy(dk, seed) {
  const rng = makeRng(seed);
  const rand = () => Array.from({ length: dk }, () => rng.randn());
  const subj = rand(), verb = rand();
  const K = TOKENS.map((t, i) => {
    const base = rand().map((v) => v * 0.4);
    if (t === 'Кот') return subj.map((v, j) => v + base[j]);
    if (t === 'ковёр') return subj.map((v, j) => 0.5 * v + base[j]);
    if (t === 'сел' || t === 'устал') return verb.map((v, j) => v + base[j]);
    return base;
  });
  const Q = TOKENS.map((t) => {
    const base = rand().map((v) => v * 0.4);
    if (t === 'он') return subj.map((v, j) => 1.2 * v + base[j]);
    if (t === 'устал' || t === 'сел') return subj.map((v, j) => 0.8 * v + base[j]);
    return base;
  });
  return { Q, K };
}

function AttentionWidget() {
  const [dk, setDk] = useState(16);
  const [scaleOn, setScaleOn] = useState(true);
  const [causal, setCausal] = useState(true);
  const [temp, setTemp] = useState(1);
  const [row, setRow] = useState(7);
  const { Q, K } = useMemo(() => makeToy(dk, 5), [dk]);
  const T = TOKENS.length;
  const S = Q.map((q) => K.map((k) => q.reduce((s, v, j) => s + v * k[j], 0) / (scaleOn ? Math.sqrt(dk) : 1)));
  const A = S.map((rowS, i) => {
    const z = rowS.map((v, j) => (causal && j > i ? -Infinity : v / temp));
    const m = Math.max(...z);
    const e = z.map((v) => (v === -Infinity ? 0 : Math.exp(v - m)));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  });
  return (
    <Widget title="Матрица внимания: кто на кого смотрит">
      <div className="controls">
        <Slider label="размерность ключей dₖ" value={dk} min={2} max={128} step={2} onChange={setDk} />
        <Slider label="доп. температура" value={temp} min={0.2} max={3} step={0.05} onChange={setTemp} />
        <label className="small"><input type="checkbox" checked={scaleOn} onChange={() => setScaleOn(!scaleOn)} /> делить на √dₖ</label>
        <label className="small"><input type="checkbox" checked={causal} onChange={() => setCausal(!causal)} /> каузальная маска</label>
      </div>
      <div className="row">
        <div className="col" style={{ flex: 2 }}>
          <Heatmap values={A} rowLabels={TOKENS} colLabels={TOKENS} lo={0} hi={1} cell={40} digits={2} onCellClick={(i) => setRow(i)} highlight={(i) => i === row} />
        </div>
        <div className="col">
          <p className="small"><b>Запрос «{TOKENS[row]}»</b> (щёлкните по строке) распределяет внимание:</p>
          {TOKENS.map((t, j) => (
            <div key={j} className="bar-row"><span className="lbl">{t}</span><span className="track"><span className="fill" style={{ width: `${A[row][j] * 100}%`, display: 'block' }} /></span><span className="val">{fmt(A[row][j], 2)}</span></div>
          ))}
          <p className="small muted">Сырые оценки q·k{scaleOn ? '/√dₖ' : ''} для этой строки: от {fmt(Math.min(...S[row]), 1)} до {fmt(Math.max(...S[row]), 1)}.</p>
        </div>
      </div>
      <p className="small muted">Векторы q и k здесь подобраны вручную так, чтобы «он» искал подлежащее — в обученной модели такие головы возникают сами. Выключите деление на √dₖ и увеличьте dₖ: разброс оценок растёт как √dₖ, softmax «схлопывается» в one-hot, и градиенты почти исчезают. Каждая строка — распределение: сумма весов равна 1. С маской верхний треугольник — нули: токен не видит будущего.</p>
    </Widget>
  );
}

function VarianceWidget() {
  const [dk, setDk] = useState(64);
  const res = useMemo(() => {
    const rng = makeRng(11);
    const xs = [];
    for (let n = 0; n < 2000; n++) { let s = 0; for (let i = 0; i < dk; i++) s += rng.randn() * rng.randn(); xs.push(s); }
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    const bins = 40, lo = -4 * Math.sqrt(dk), hi = 4 * Math.sqrt(dk);
    const h = Array(bins).fill(0);
    xs.forEach((x) => { const b = Math.floor(((x - lo) / (hi - lo)) * bins); if (b >= 0 && b < bins) h[b]++; });
    return { v, hist: h.map((c, i) => [lo + ((i + 0.5) * (hi - lo)) / bins, c]) };
  }, [dk]);
  return (
    <Widget title="Почему делить на √dₖ: дисперсия скалярного произведения" badge="эксперимент">
      <Slider label="dₖ" value={dk} min={1} max={512} onChange={setDk} />
      <LineChart height={190} series={[{ data: res.hist, color: 'var(--c1)' }]} legend={false} xLabel="q·k для случайных q, k ~ N(0, I)" />
      <p className="mono small">выборочная дисперсия q·k = {fmt(res.v, 1)} (теория: dₖ = {dk}); после деления на √dₖ: {fmt(res.v / dk, 3)} (теория: 1)</p>
    </Widget>
  );
}

export default function Attention() {
  return (
    <>
      <h1>Механизм внимания</h1>
      <p className="lead">Внимание — способ, которым токены обмениваются информацией. Каждый токен формулирует «вопрос», сверяет его с «ярлыками» всех предыдущих токенов и собирает их «содержимое» пропорционально совпадению.</p>

      <h2>Идея: мягкий поиск по словарю</h2>
      <p>
        Представьте словарь (Python <code>dict</code>): по запросу находится ключ, возвращается значение. Внимание — «мягкая» версия: запрос сравнивается со <i>всеми</i> ключами, и возвращается
        <b> взвешенная смесь</b> всех значений, где веса тем больше, чем лучше совпадение. Поскольку всё гладкое (без жёсткого выбора), это можно обучать градиентным спуском. Впервые эту идею
        для нейросетей предложили Бахданау и др. для перевода <Cite id="bahdanau2014" />; трансформер <Cite id="vaswani2017" /> сделал её единственным механизмом обмена информацией между позициями.
      </p>
      <p>Каждый токен <M t="t" /> со своим вектором <M t={r`\mathbf x_t\in\mathbb R^{C}`} /> порождает три вектора с помощью трёх обучаемых матриц:</p>
      <Eq t={r`\mathbf q_t = \mathbf x_t W_Q\;\;(\text{query: «что я ищу»}),\qquad \mathbf k_t = \mathbf x_t W_K\;\;(\text{key: «что я содержу»}),\qquad \mathbf v_t = \mathbf x_t W_V\;\;(\text{value: «что я отдам»})`} />
      <p>
        Например, местоимение «он» может выдать запрос «ищу существительное мужского рода, подлежащее», «Кот» — ключ «я существительное, подлежащее», а значение «Кота» несёт сведения, которые
        полезно передать «он» (что это животное, что оно устало...). Разделение на ключ и значение важно: то, <i>по чему</i> ищут, и то, <i>что</i> передают, — разные вещи.
      </p>

      <h2>Scaled dot-product attention</h2>
      <p>Для токена <M t="t" />:</p>
      <Eq t={r`s_{ts} = \frac{\mathbf q_t\cdot\mathbf k_s}{\sqrt{d_k}},\qquad a_{ts} = \frac{e^{s_{ts}}}{\sum_{s'} e^{s_{ts'}}},\qquad \mathbf o_t = \sum_s a_{ts}\,\mathbf v_s`} />
      <p>Сложив векторы всех токенов в строки матриц <M t={r`Q, K, V\in\mathbb R^{T\times d_k}`} />, получаем знаменитую формулу из статьи «Attention Is All You Need» <Cite id="vaswani2017" />:</p>
      <Eq t={r`\boxed{\;\mathrm{Attention}(Q,K,V) = \mathrm{softmax}\!\Big(\frac{QK^\top}{\sqrt{d_k}} + M\Big)V\;}`} />
      <ul>
        <li><M t={r`QK^\top`} /> — матрица <M t={r`T\times T`} /> всех попарных сходств (глава 1).</li>
        <li><M t="M" /> — маска (см. ниже), softmax — по каждой строке.</li>
        <li>Умножение на <M t="V" /> — каждая строка результата есть взвешенная сумма строк <M t="V" />.</li>
      </ul>
      <AttentionWidget />

      <h2>Почему делить на √dₖ</h2>
      <p>Пусть компоненты <M t={r`\mathbf q, \mathbf k`} /> независимы, со средним 0 и дисперсией 1. Тогда</p>
      <Eq t={r`\mathbb E[\mathbf q\cdot\mathbf k] = \sum_{i=1}^{d_k}\mathbb E[q_i]\mathbb E[k_i] = 0,\qquad \mathrm{Var}(\mathbf q\cdot\mathbf k) = \sum_{i=1}^{d_k}\mathrm{Var}(q_ik_i) = \sum_{i=1}^{d_k}\mathbb E[q_i^2]\mathbb E[k_i^2] = d_k`} />
      <p>
        Стандартное отклонение растёт как <M t={r`\sqrt{d_k}`} />. При <M t={r`d_k = 64`} /> оценки типично порядка ±8, а <M t={r`e^{8}/e^{-8}\approx 9\cdot10^6`} /> — softmax почти one-hot.
        В этой области градиент softmax (якобиан <M t={r`\mathrm{diag}(\mathbf a) - \mathbf a\mathbf a^\top`} />, глава 3) почти нулевой — обучение застревает. Деление на <M t={r`\sqrt{d_k}`} /> возвращает дисперсию к 1 <Cite id="vaswani2017" />.
      </p>
      <VarianceWidget />

      <h2>Каузальная маска</h2>
      <p>
        GPT учится предсказывать токен <M t="t+1" /> по токенам <M t={r`1..t`} />. Если позиция <M t="t" /> сможет «подсмотреть» в <M t="t+1" />, задача станет тривиальной, и модель ничему не научится.
        Поэтому оценки для будущих позиций заменяют на <M t={r`-\infty`} /> до softmax:
      </p>
      <Eq t={r`M_{ts} = \begin{cases}0, & s\le t\\ -\infty, & s>t\end{cases}\qquad\Rightarrow\qquad e^{-\infty} = 0`} />
      <p>
        Маска — нижнетреугольная матрица (<code>torch.tril</code>). Красивое следствие: за один проход модель решает <M t="T" /> задач предсказания одновременно — позиция 1 предсказывает 2-й токен,
        позиция 2 — 3-й, и т.д., каждая видит ровно свой префикс. Поэтому обучение трансформера так эффективно: из одной последовательности длины <M t="T" /> мы получаем <M t="T" /> обучающих примеров, и все они считаются параллельно.
      </p>
      <Callout type="tip" title="Внимание как граф общения">
        <p>Можно думать о токенах как об узлах графа, а о внимании — как о передаче сообщений: каждый узел собирает взвешенную сумму сообщений от узлов, на которые у него есть рёбра. Каузальная маска делает граф «треугольным»: рёбра только из прошлого. В энкодерах (BERT) маски нет — все видят всех. Подробная математическая интерпретация — у Элхаге и др. <Cite id="elhage2021" />.</p>
      </Callout>

      <h2>Одна голова внимания в коде</h2>
      <Code title="python — одна голова, без оптимизаций">{`
import math, torch, torch.nn as nn, torch.nn.functional as F

class Head(nn.Module):
    def __init__(self, C, head_size, block_size):
        super().__init__()
        self.key   = nn.Linear(C, head_size, bias=False)   # W_K
        self.query = nn.Linear(C, head_size, bias=False)   # W_Q
        self.value = nn.Linear(C, head_size, bias=False)   # W_V
        self.register_buffer("tril", torch.tril(torch.ones(block_size, block_size)))

    def forward(self, x):                         # x: (B, T, C)
        B, T, C = x.shape
        k = self.key(x)                           # (B, T, hs)
        q = self.query(x)                         # (B, T, hs)
        v = self.value(x)                         # (B, T, hs)
        att = q @ k.transpose(-2, -1)             # (B, T, hs) @ (B, hs, T) -> (B, T, T)
        att = att / math.sqrt(k.size(-1))         # масштабирование
        att = att.masked_fill(self.tril[:T, :T] == 0, float("-inf"))   # каузальная маска
        att = F.softmax(att, dim=-1)              # каждая строка суммируется в 1
        return att @ v                            # (B, T, T) @ (B, T, hs) -> (B, T, hs)

torch.manual_seed(0)
h = Head(C=32, head_size=16, block_size=8)
x = torch.randn(4, 8, 32)
print(h(x).shape)                                 # torch.Size([4, 8, 16])
`}</Code>
      <Callout type="math" title="Обратный проход внимания">
        <p>Для <M t={r`O = PV`} />, <M t={r`P = \mathrm{softmax}(S)`} />, <M t={r`S = QK^\top/\sqrt{d_k}`} /> и пришедшего градиента <M t={r`\bar O`} />:</p>
        <Eq t={r`\bar V = P^\top\bar O,\quad \bar P = \bar O V^\top,\quad \bar S = P\odot(\bar P - \mathrm{rowsum}(\bar P\odot P)),\quad \bar Q = \bar S K/\sqrt{d_k},\quad \bar K = \bar S^\top Q/\sqrt{d_k}`} />
        <p>Все пять формул — применение таблицы из главы 5. Замаскированные элементы имеют <M t={r`P = 0`} />, поэтому градиент через них автоматически нулевой. Именно эти строки реализованы в <code>causalAttention</code> в <code>books/gpt/lib/tensor.js</code>.</p>
      </Callout>
      <p>
        Обратите внимание: матрица <M t={r`T\times T`} /> требует <M t={r`O(T^2)`} /> памяти и вычислений — главный бюджетный фактор длинных контекстов. FlashAttention <Cite id="dao2022" /> вычисляет ровно то же самое
        блоками, не храня <M t="P" /> целиком; в PyTorch он доступен через <code>F.scaled_dot_product_attention</code>, который использует наш <code>model.py</code>.
      </p>
      <Quiz q="Чему равна сумма элементов любой строки матрицы внимания (после softmax)?" options={['0', '1', 'T', 'dₖ']} answer={1}
        explain="Каждая строка — распределение вероятностей над позициями, на которые смотрит токен." />
      <Quiz q="Зачем делить QKᵀ на √dₖ?" options={['Чтобы ускорить вычисления', 'Чтобы дисперсия оценок не росла с dₖ и softmax не насыщался', 'Чтобы сделать матрицу симметричной', 'Для каузальности']} answer={1}
        explain="Var(q·k) = dₖ; после деления — 1. Иначе softmax становится почти one-hot, и градиенты затухают." />
      <Quiz q="Первая позиция (t=1) в каузальном внимании может смотреть на..." options={['все токены', 'только на себя', 'ни на кого', 'только на последний токен']} answer={1}
        explain="Для t=1 разрешено только s ≤ 1, т.е. сама позиция. Её вес внимания всегда равен 1." />
    </>
  );
}
