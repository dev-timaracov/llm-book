import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Bars, fmt, Stat } from '@shared/ui.jsx';
import { Heatmap } from '@shared/charts.jsx';
import { makeRng } from '@shared/rng.js';
import bigramSrc from '../python/bigram.py?raw';

const DEFAULT_TEXT = `мама мыла раму. мама мыла пол. папа читал книгу. кот спал на окне. мама пила чай, а папа пил кофе. кот мыл лапу. дети читали сказки и пили молоко. на окне спал кот, а мама мыла чашку.`;

const show = (c) => (c === ' ' ? '␣' : c === '\n' ? '⏎' : c);

function BigramWidget() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [order, setOrder] = useState(1);
  const [alpha, setAlpha] = useState(1);
  const [seed, setSeed] = useState(1);
  const [ctx, setCtx] = useState('м');
  const model = useMemo(() => {
    const t = text.toLowerCase();
    const chars = [...new Set(t)].sort();
    const counts = new Map(); // context -> Map(next -> count)
    for (let i = order; i < t.length; i++) {
      const c = t.slice(i - order, i), n = t[i];
      if (!counts.has(c)) counts.set(c, new Map());
      const m = counts.get(c); m.set(n, (m.get(n) || 0) + 1);
    }
    const prob = (c, n) => {
      const m = counts.get(c); const tot = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0;
      return ((m?.get(n) || 0) + alpha) / (tot + alpha * chars.length);
    };
    let nll = 0, N = 0;
    for (let i = order; i < t.length; i++) { nll -= Math.log(prob(t.slice(i - order, i), t[i])); N++; }
    return { t, chars, counts, prob, nll: nll / Math.max(1, N) };
  }, [text, order, alpha]);
  const sample = useMemo(() => {
    const rng = makeRng(seed);
    let out = model.t.slice(0, order);
    for (let i = 0; i < 160; i++) {
      const c = out.slice(out.length - order);
      const p = model.chars.map((n) => model.prob(c, n));
      out += model.chars[rng.choice(p)];
    }
    return out;
  }, [model, seed, order]);
  // тепловая карта для биграмм — частые символы
  const freq = new Map();
  for (const c of model.t) freq.set(c, (freq.get(c) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map((e) => e[0]);
  const heat = order === 1 ? top.map((a) => top.map((b) => model.counts.get(a)?.get(b) || 0)) : null;
  const c = (ctx.toLowerCase() + ' '.repeat(order)).slice(0, order);
  const dist = model.chars.map((n) => ({ label: show(n), value: model.prob(c, n) })).sort((a, b) => b.value - a.value).slice(0, 8);
  return (
    <Widget title="n-граммная модель символов на вашем тексте">
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="controls" style={{ marginTop: 8 }}>
        <Slider label="длина контекста n−1" value={order} min={1} max={4} onChange={(v) => { setOrder(v); setCtx(model.t.slice(0, v)); }} />
        <Slider label="сглаживание α" value={alpha} min={0} max={2} step={0.05} onChange={setAlpha} />
      </div>
      <div className="stats">
        <Stat k="словарь V" v={model.chars.length} />
        <Stat k="средний NLL на обучающем тексте" v={fmt(model.nll, 3)} />
        <Stat k="перплексия" v={fmt(Math.exp(model.nll), 2)} />
        <Stat k="ln V (угадывание)" v={fmt(Math.log(model.chars.length), 3)} />
      </div>
      <div className="row">
        {heat && (
          <div className="col">
            <p className="small muted">Счётчики пар: строка — текущий символ, столбец — следующий.</p>
            <Heatmap values={heat} rowLabels={top.map(show)} colLabels={top.map(show)} cell={24} digits={0} onCellClick={(i) => setCtx(top[i])} highlight={(i) => top[i] === c} />
          </div>
        )}
        <div className="col">
          <p className="small">Контекст: <input type="text" value={ctx} maxLength={order} onChange={(e) => setCtx(e.target.value)} style={{ width: 70 }} /> → P(следующий символ):</p>
          <Bars items={dist} max={1} />
        </div>
      </div>
      <p className="small" style={{ marginTop: 10 }}>Сгенерированный текст <button className="btn small" onClick={() => setSeed(seed + 1)}>ещё</button></p>
      <div className="sample-out">{sample}</div>
      <p className="small muted">С n−1 = 1 получается бессмыслица со «словоподобными» кусками. С n−1 = 4 модель начинает цитировать обучающий текст дословно: контекстов мало, и каждый встречался 1–2 раза — классическое <b>переобучение</b>. Обратите внимание, как NLL на обучающем тексте падает — но это не значит, что модель стала лучше на <i>новом</i> тексте. При α = 0 непредставленные продолжения получают вероятность 0 и NLL на новом тексте была бы бесконечной.</p>
    </Widget>
  );
}

export default function LangModel() {
  return (
    <>
      <h1>Языковая модель: биграммы и MLP</h1>
      <p className="lead">Прежде чем строить трансформер, построим самые простые языковые модели. Они покажут, что именно мы оптимизируем, — и где у простых подходов потолок.</p>

      <h2>Задача языкового моделирования</h2>
      <p>По цепному правилу вероятности (глава 3) любой текст <M t={r`x_1\dots x_T`} />:</p>
      <Eq t={r`P(x_1,\dots,x_T) = \prod_{t=1}^T P(x_t\mid x_1,\dots,x_{t-1})`} />
      <p>Модель с параметрами <M t={r`\theta`} /> выдаёт <M t={r`q_\theta(x_t\mid x_{<t})`} />. Обучение — минимизация средней отрицательной лог-вероятности (кросс-энтропии) на корпусе:</p>
      <Eq t={r`\mathcal L(\theta) = -\frac1T\sum_{t=1}^T \log q_\theta(x_t\mid x_{<t})`} />
      <p>Главный вопрос — как устроить <M t={r`q_\theta`} />, чтобы она учитывала длинный контекст и при этом обобщала на тексты, которых никогда не видела.</p>

      <h2>n-граммы: марковское допущение</h2>
      <p>
        Самое простое — считать, что следующий символ зависит только от <M t="n-1" /> предыдущих: <M t={r`P(x_t\mid x_{<t})\approx P(x_t\mid x_{t-n+1},\dots,x_{t-1})`} />. Так Шеннон ещё в 1948 году
        генерировал «приближения английского языка» <Cite id="shannon1948" />. Оценка максимального правдоподобия для n-граммы — просто частоты:
      </p>
      <Eq t={r`\hat P(b\mid a) = \frac{\mathrm{count}(a, b)}{\mathrm{count}(a)}`} />
      <p>Чтобы невиденные пары не получали нулевую вероятность (и бесконечную потерю), добавляют <b>сглаживание Лапласа</b>: <M t={r`\hat P(b\mid a) = \frac{\mathrm{count}(a,b)+\alpha}{\mathrm{count}(a)+\alpha V}`} />.</p>
      <BigramWidget />
      <Callout type="warn" title="Проклятие размерности">
        <p>Для контекста длины <M t="k" /> нужно <M t={r`V^k`} /> строк таблицы. Для словаря в 50 000 токенов и <M t="k=3" /> — <M t={r`1.25\cdot10^{14}`} /> строк, почти все пустые.
          n-граммы не умеют <b>обобщать</b>: «кот спал на окне» ничего не говорит модели про «пёс спал на диване», потому что «кот» и «пёс» — просто разные индексы.</p>
      </Callout>

      <h2>Та же биграмма — как нейросеть</h2>
      <p>
        Заведём матрицу логитов <M t={r`W\in\mathbb R^{V\times V}`} />. Для текущего символа <M t="a" /> логиты следующего — строка <M t={r`W_a`} />, вероятности — <M t={r`\mathrm{softmax}(W_a)`} />.
        Формально это one-hot вектор, умноженный на матрицу: <M t={r`\mathrm{onehot}(a)^\top W = W_a`} /> — выбор строки. Обучим <M t="W" /> градиентным спуском по кросс-энтропии.
      </p>
      <p>
        Результат: потеря сходится к той же величине, что у подсчёта частот (≈2.45–2.50 на Шекспире). Это не совпадение: для такой модели максимум правдоподобия достигается ровно при
        <M t={r`\mathrm{softmax}(W_a) = \hat P(\cdot\mid a)`} />. Градиентный спуск нашёл то же решение, что и подсчёт, — но теперь у нас есть <i>гибкий</i> способ задать модель, который
        масштабируется на сколь угодно сложные архитектуры.
      </p>
      <Code title="books/gpt/python/bigram.py">{bigramSrc}</Code>
      <p className="small muted">Запуск: <code>python prepare.py</code> (скачает Шекспира в <code>data/input.txt</code>), затем <code>python bigram.py</code>. Ожидаемый вывод: NLL подсчётом ≈ 2.455, нейросеть ≈ 2.50 через 300 шагов (и продолжает приближаться).</p>

      <h2>Нейросетевая модель Бенджио (2003)</h2>
      <p>Бенджио и соавторы <Cite id="bengio2003" /> решили проблему обобщения двумя идеями, которые живут в GPT до сих пор:</p>
      <ol>
        <li><b>Эмбеддинги.</b> Каждому токену сопоставляется обучаемый вектор <M t={r`\mathbf e_x\in\mathbb R^d`} /> (строка матрицы <M t={r`E\in\mathbb R^{V\times d}`} />). Похожие слова получают похожие векторы, и знание о «коте» переносится на «пса».</li>
        <li><b>Нейросеть поверх контекста.</b> Векторы <M t="k" /> предыдущих токенов склеиваются и подаются в MLP, который выдаёт логиты следующего.</li>
      </ol>
      <Eq t={r`\mathbf h = \tanh\big(W_h[\mathbf e_{x_{t-k}};\dots;\mathbf e_{x_{t-1}}] + \mathbf b_h\big),\qquad q(\cdot\mid x_{<t}) = \mathrm{softmax}(W_o\mathbf h + \mathbf b_o)`} />
      <p>Число параметров теперь растёт линейно по <M t="k" />, а не экспоненциально. Но окно по-прежнему фиксировано, и каждой позиции окна соответствуют <i>свои</i> веса в <M t={r`W_h`} /> — модель не понимает, что «слово на позиции 3» и «слово на позиции 4» — одно и то же понятие.</p>
      <Code title="python — MLP-модель Бенджио на символах">{`
import torch, torch.nn as nn, torch.nn.functional as F

text = open("data/input.txt", encoding="utf-8").read()
chars = sorted(set(text)); V = len(chars); stoi = {c: i for i, c in enumerate(chars)}
data = torch.tensor([stoi[c] for c in text])

k, d, H = 8, 24, 256                         # окно, размер эмбеддинга, скрытый слой
X = torch.stack([data[i:i + k] for i in range(len(data) - k)])   # (N, k)
Y = data[k:]                                                     # (N,)

class BengioLM(nn.Module):
    def __init__(self):
        super().__init__()
        self.emb = nn.Embedding(V, d)        # матрица E: (V, d)
        self.hidden = nn.Linear(k * d, H)
        self.out = nn.Linear(H, V)
    def forward(self, x):                    # x: (B, k)
        e = self.emb(x).view(x.size(0), -1)  # (B, k, d) -> (B, k*d): склеили векторы
        return self.out(torch.tanh(self.hidden(e)))

model = BengioLM()
opt = torch.optim.AdamW(model.parameters(), lr=3e-3)
for step in range(3000):
    ix = torch.randint(0, len(X), (128,))
    loss = F.cross_entropy(model(X[ix]), Y[ix])
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 500 == 0: print(step, loss.item())
# к 3000 шагам loss ≈ 1.8–1.9 — заметно лучше биграммы (2.45)
`}</Code>

      <h2>Рекуррентные сети и их пределы</h2>
      <p>
        Чтобы снять ограничение фиксированного окна, придумали рекуррентные сети: скрытое состояние <M t={r`\mathbf h_t = f(\mathbf h_{t-1}, \mathbf e_{x_t})`} /> несёт «память» о всём прошлом.
        LSTM <Cite id="hochreiter1997" /> с механизмом «ворот» стала стандартом 2010-х, на ней работали первые нейросетевые переводчики <Cite id="sutskever2014" />. Знаменитый пост Карпаты <Cite id="karpathy2015" /> показал, как
        символьная LSTM пишет «под Шекспира». Но у RNN две фундаментальные проблемы:
      </p>
      <ul>
        <li><b>Последовательность вычислений.</b> <M t={r`\mathbf h_t`} /> нельзя посчитать, не посчитав <M t={r`\mathbf h_{t-1}`} />. На GPU, которые сильны в параллельных вычислениях, это очень медленно.</li>
        <li><b>Узкое горлышко памяти.</b> Вся история сжимается в один вектор фиксированного размера. Информация о далёких токенах проходит через десятки нелинейностей и размывается; градиенты затухают или взрываются <Cite id="pascanu2013" />.</li>
      </ul>
      <p>
        Решение пришло из машинного перевода: Бахданау, Чо и Бенджио <Cite id="bahdanau2014" /> позволили декодеру на каждом шаге «смотреть» на все состояния энкодера с обучаемыми весами — механизм <b>внимания</b>.
        А в 2017 году Васвани и др. <Cite id="vaswani2017" /> показали, что рекуррентность вообще не нужна: «Attention Is All You Need». К этому мы идём в части IV.
        Но сначала разберёмся, на какие кусочки резать текст.
      </p>
      <Quiz q="Нейросетевая биграмма обучилась до loss 2.46, а подсчёт частот дал 2.455. Почему результаты почти совпали?" options={['Случайность', 'Обе модели имеют одинаковую выразительность (таблица V×V), и максимум правдоподобия для неё — частоты', 'Нейросеть всегда хуже', 'Из-за сглаживания']} answer={1}
        explain="Таблица логитов W может выразить любую условную таблицу P(b|a), а кросс-энтропия минимизируется ровно на эмпирических частотах." />
      <Quiz q="Главное преимущество эмбеддингов по сравнению с n-граммами:" options={['Они быстрее считаются', 'Похожие токены получают похожие векторы, и статистика переносится между ними (обобщение)', 'Они занимают меньше памяти', 'Они не требуют обучения']} answer={1}
        explain="Это ключевая идея Бенджио и др. (2003): распределённые представления позволяют обобщать на невиденные комбинации." />
    </>
  );
}
