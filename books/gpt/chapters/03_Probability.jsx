import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Bars, fmt, Stat } from '@shared/ui.jsx';

const LABELS = ['кот', 'пёс', 'дом', 'сон', 'мяч'];

function SoftmaxWidget() {
  const [z, setZ] = useState([2.0, 1.0, 0.1, -1.0, 0.5]);
  const [T, setT] = useState(1);
  const [target, setTarget] = useState(0);
  const m = Math.max(...z.map((v) => v / T));
  const e = z.map((v) => Math.exp(v / T - m));
  const s = e.reduce((a, b) => a + b, 0);
  const p = e.map((v) => v / s);
  const H = -p.reduce((a, q) => a + (q > 0 ? q * Math.log(q) : 0), 0);
  const ce = -Math.log(p[target]);
  return (
    <Widget title="Softmax, температура и кросс-энтропия">
      <div className="row">
        <div className="col">
          <p className="small muted">Логиты (произвольные числа, которые выдаёт сеть):</p>
          {z.map((v, i) => (
            <Slider key={i} label={`z(${LABELS[i]})`} value={v} min={-4} max={4} step={0.1} onChange={(nv) => { const n = [...z]; n[i] = nv; setZ(n); }} />
          ))}
          <Slider label="температура T" value={T} min={0.1} max={5} step={0.05} onChange={setT} />
        </div>
        <div className="col">
          <p className="small muted">Вероятности <M t={r`p_i = e^{z_i/T} / \sum_j e^{z_j/T}`} />:</p>
          <Bars items={p.map((v, i) => ({ label: LABELS[i], value: v, color: i === target ? 'var(--c3)' : undefined }))} max={1} />
          <p className="small" style={{ marginTop: 10 }}>Правильный ответ (цель):{' '}
            <select value={target} onChange={(e) => setTarget(+e.target.value)}>{LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}</select>
          </p>
          <div className="stats">
            <Stat k="сумма p" v={fmt(p.reduce((a, b) => a + b, 0), 3)} />
            <Stat k="энтропия H(p), нат" v={fmt(H, 3)} />
            <Stat k={`потеря −ln p(${LABELS[target]})`} v={fmt(ce, 3)} />
          </div>
          <p className="small muted">Максимум энтропии для 5 вариантов: ln 5 = {fmt(Math.log(5), 3)}. Попробуйте T → 0 (почти argmax, энтропия → 0) и T → 5 (почти равномерное).
            Прибавьте ко всем логитам одно и то же число — вероятности не изменятся.</p>
        </div>
      </div>
    </Widget>
  );
}

function EntropyCoin() {
  const [p, setP] = useState(0.5);
  const H = (q) => (q <= 0 || q >= 1 ? 0 : -(q * Math.log2(q) + (1 - q) * Math.log2(1 - q)));
  return (
    <Widget title="Энтропия монеты: мера неопределённости">
      <Slider label="P(орёл)" value={p} min={0} max={1} step={0.01} onChange={setP} />
      <div className="stats">
        <Stat k="H, бит" v={fmt(H(p), 3)} />
        <Stat k="«неожиданность» орла −log₂p" v={p > 0 ? fmt(-Math.log2(p), 2) : '∞'} />
        <Stat k="«неожиданность» решки" v={p < 1 ? fmt(-Math.log2(1 - p), 2) : '∞'} />
      </div>
      <p className="small muted">Честная монета — 1 бит: нельзя предсказать лучше, чем наугад. Монета с P=0.99 почти предсказуема: энтропия {fmt(H(0.99), 3)} бит.
        Энтропия — минимальное среднее число бит на символ, которое нужно для кодирования источника (теорема Шеннона о кодировании <Cite id="shannon1948" />).</p>
    </Widget>
  );
}

export default function Probability() {
  return (
    <>
      <h1>Вероятность, softmax, энтропия</h1>
      <p className="lead">Языковая модель выдаёт не ответ, а распределение вероятностей. Учится она, минимизируя кросс-энтропию. Разберём оба понятия до последней буквы.</p>

      <h2>Распределение вероятностей</h2>
      <p>
        Дискретное распределение над множеством исходов (у нас — над словарём из <M t="V" /> токенов) — это набор чисел <M t={r`p_1, \dots, p_V`} />, таких что
        <M t={r`p_i \ge 0`} /> и <M t={r`\sum_i p_i = 1`} />. <b>Условная вероятность</b> <M t={r`P(A \mid B) = P(A, B)/P(B)`} /> — вероятность <M t="A" />, если известно, что <M t="B" /> произошло.
      </p>
      <h3>Цепное правило вероятности</h3>
      <p>Совместную вероятность последовательности всегда можно разложить в произведение условных — это просто многократное применение определения условной вероятности:</p>
      <Eq t={r`P(x_1, x_2, \dots, x_T) = P(x_1)\,P(x_2 \mid x_1)\,P(x_3 \mid x_1, x_2)\cdots = \prod_{t=1}^{T} P(x_t \mid x_{<t})`} />
      <p>
        Это <b>точное</b> равенство, без приближений. Вся идея авторегрессионной языковой модели (GPT) — научить сеть оценивать каждый множитель
        <M t={r`P(x_t \mid x_{<t})`} />. Если научиться предсказывать следующий токен, мы автоматически умеем оценивать вероятность любого текста и порождать новые тексты <Cite id="bengio2003,radford2019" />.
      </p>

      <h2>Softmax: из любых чисел — в вероятности</h2>
      <p>Последний слой сети выдаёт вектор произвольных вещественных чисел <M t={r`\mathbf z \in \mathbb R^V`} /> — <b>логитов</b>. Чтобы превратить их в распределение, используется softmax:</p>
      <Eq t={r`\mathrm{softmax}(\mathbf z)_i = \frac{e^{z_i}}{\sum_{j=1}^{V} e^{z_j}}`} />
      <ul>
        <li>Экспонента делает все числа положительными, деление на сумму — нормирует до 1.</li>
        <li>Сохраняет порядок: больший логит → большая вероятность. Отсюда название — «мягкий максимум».</li>
        <li><b>Инвариантность к сдвигу:</b> <M t={r`\mathrm{softmax}(\mathbf z + c) = \mathrm{softmax}(\mathbf z)`} />, так как <M t={r`e^{z_i+c}/\sum e^{z_j+c} = e^c e^{z_i}/(e^c\sum e^{z_j})`} />.</li>
        <li><b>Температура:</b> <M t={r`\mathrm{softmax}(\mathbf z/T)`} />. При <M t={r`T\to 0`} /> распределение стремится к one-hot на максимуме, при <M t={r`T\to\infty`} /> — к равномерному. Это тот самый параметр <code>temperature</code> в генерации (глава 15).</li>
      </ul>
      <SoftmaxWidget />
      <Callout type="danger" title="Численная устойчивость">
        <p><M t={r`e^{1000}`} /> не помещается во float32 (максимум ≈ <M t={r`3.4\cdot 10^{38}`} />, т.е. <M t={r`e^{88.7}`} />). Используя инвариантность к сдвигу, всегда вычитают максимум:
          <M t={r`\mathrm{softmax}(\mathbf z) = \mathrm{softmax}(\mathbf z - \max_j z_j)`} />. Теперь наибольшая экспонента равна <M t="e^0=1" />, переполнения нет. Так сделано во всех реализациях, включая наш JS-код.</p>
      </Callout>

      <h2>Информация и энтропия</h2>
      <p>
        Шеннон <Cite id="shannon1948" /> определил <b>количество информации</b> (неожиданность) исхода с вероятностью <M t="p" /> как <M t={r`-\log p`} />. Редкие события несут много информации,
        неизбежные (<M t="p=1" />) — ноль. <b>Энтропия</b> — средняя неожиданность:
      </p>
      <Eq t={r`H(p) = -\sum_i p_i \log p_i`} />
      <p>С логарифмом по основанию 2 энтропия измеряется в битах, с натуральным — в «натах» (nats). В ML почти всегда используют натуральный логарифм.</p>
      <EntropyCoin />

      <h2>Кросс-энтропия и KL-дивергенция</h2>
      <p>
        Пусть истинное распределение — <M t="p" />, а модель предсказывает <M t="q" />. <b>Кросс-энтропия</b> — средняя неожиданность, если события приходят из <M t="p" />, а мы оцениваем их через <M t="q" />:
      </p>
      <Eq t={r`H(p, q) = -\sum_i p_i \log q_i = H(p) + D_{\mathrm{KL}}(p\,\Vert\,q)`} />
      <Eq t={r`D_{\mathrm{KL}}(p\,\Vert\,q) = \sum_i p_i \log\frac{p_i}{q_i} \;\ge\; 0`} />
      <p>
        KL-дивергенция — «лишние наты» из-за того, что модель ошибается; она равна нулю только при <M t="q=p" /> (неравенство Гиббса). Поскольку <M t="H(p)" /> от модели не зависит,
        <b>минимизировать кросс-энтропию — то же самое, что приближать модель к истинному распределению</b>.
      </p>
      <p>
        В обучении языковой модели «истинное распределение» для каждой позиции — это one-hot: следующий токен в тексте известен, это <M t="y" />. Тогда сумма схлопывается в одно слагаемое:
      </p>
      <Eq t={r`\mathcal L = -\log q_y = -\log \mathrm{softmax}(\mathbf z)_y = -z_y + \log\sum_j e^{z_j}`} label="отрицательное лог-правдоподобие (NLL) правильного токена" />
      <p>
        Усредняя по всем позициям обучающего текста, получаем ту самую функцию потерь, которую минимизирует GPT. Минимизация средней NLL — это <b>метод максимального правдоподобия</b>:
        <M t={r`\arg\max_\theta \prod_t q_\theta(x_t \mid x_{<t}) = \arg\min_\theta \frac{1}{T}\sum_t -\log q_\theta(x_t\mid x_{<t})`} />. Логарифм превращает произведение крошечных вероятностей
        (которое быстро становится машинным нулём) в сумму.
      </p>
      <Callout type="tip" title="Ориентиры для значений loss">
        <p>Модель, угадывающая наугад из <M t="V" /> токенов, имеет <M t={r`\mathcal L = \ln V`} />. Для 65 символов Шекспира это <M t={r`\ln 65 \approx 4.17`} /> — ровно с этого значения стартует
          обучение в главе 17. Для словаря GPT-2 (50 257) — <M t={r`\ln 50257 \approx 10.82`} />. Если в начале обучения loss сильно отличается от <M t={r`\ln V`} /> — скорее всего ошибка в инициализации.</p>
      </Callout>

      <h3>Перплексия</h3>
      <p>
        <b>Перплексия</b> <M t={r`\mathrm{PPL} = e^{\mathcal L}`} /> — «эффективное число вариантов», между которыми модель колеблется. PPL = 65 — модель ничего не знает о тексте из 65 символов;
        PPL = 4.5 (loss 1.5) — как будто на каждом шаге модель выбирает из ~4.5 равновероятных символов. Перплексия — стандартная метрика языковых моделей, в т.ч. в статьях GPT-2 <Cite id="radford2019" />.
      </p>

      <h2>Градиент softmax + кросс-энтропии: самая красивая формула</h2>
      <p>Найдём <M t={r`\partial\mathcal L/\partial z_k`} /> для <M t={r`\mathcal L = -z_y + \log\sum_j e^{z_j}`} />. Первое слагаемое даёт <M t={r`-[k=y]`} /> (1, если <M t="k=y" />, иначе 0). Второе:</p>
      <Eq t={r`\frac{\partial}{\partial z_k}\log\sum_j e^{z_j} = \frac{e^{z_k}}{\sum_j e^{z_j}} = q_k`} />
      <Eq t={r`\boxed{\;\frac{\partial\mathcal L}{\partial z_k} = q_k - [k = y]\;}\qquad\text{т.е.}\qquad \nabla_{\mathbf z}\mathcal L = \mathbf q - \mathrm{onehot}(y)`} />
      <p>
        Градиент — это «предсказание минус правда». Модель предсказала «кот» с вероятностью 0.7, а правильно «пёс»: градиент по логиту «кота» = +0.7 (уменьшить), по логиту «пса» = <M t="q_{пёс}-1" /> (увеличить).
        Сумма компонент градиента всегда 0. Эта формула реализована в функции <code>crossEntropy</code> нашего JS-движка и внутри <code>F.cross_entropy</code> PyTorch.
      </p>
      <Callout type="math" title="Якобиан softmax (понадобится для внимания)">
        <p>Если softmax стоит не в конце, нужен его полный якобиан: <M t={r`\frac{\partial q_i}{\partial z_j} = q_i([i=j] - q_j)`} />. Значит, для приходящего градиента <M t={r`\mathbf g = \partial L/\partial\mathbf q`} />:</p>
        <Eq t={r`\frac{\partial L}{\partial z_j} = \sum_i g_i q_i([i=j]-q_j) = q_j\Big(g_j - \sum_i g_i q_i\Big)`} />
        <p>Ровно эта строчка <code>dS = P ⊙ (dP − Σ dP·P)</code> стоит в обратном проходе внимания в <code>tensor.js</code>.</p>
      </Callout>

      <Code title="python — проверяем всё численно">{`
import torch
import torch.nn.functional as F

z = torch.tensor([2.0, 1.0, 0.1, -1.0, 0.5], requires_grad=True)   # логиты
y = torch.tensor(1)                                                 # правильный класс — «пёс»

q = F.softmax(z, dim=0)
loss = F.cross_entropy(z.unsqueeze(0), y.unsqueeze(0))   # = -log q[y]
print(loss.item(), -torch.log(q[y]).item())               # совпадают

loss.backward()
print(z.grad)                                  # градиент от autograd
print(q.detach() - F.one_hot(y, 5).float())    # формула q - onehot(y): то же самое

# устойчивый softmax руками
def softmax(z):
    z = z - z.max()
    e = torch.exp(z)
    return e / e.sum()
print(softmax(torch.tensor([1000.0, 999.0])))  # без вычитания максимума было бы nan
`}</Code>
      <Quiz q="Модель для словаря из 1000 токенов выдаёт на старте loss ≈ 6.9. Это нормально?" options={['Нет, должно быть ≈ 0', 'Да: ln(1000) ≈ 6.91 — модель пока угадывает равномерно', 'Нет, loss должен быть ≈ 1000', 'Нет, loss не бывает больше 1']} answer={1}
        explain="Равномерное распределение даёт −ln(1/1000) = ln 1000 ≈ 6.91. Это правильная стартовая точка." />
      <Quiz q="Чему равен градиент кросс-энтропии по логитам, если модель уже уверенно (q_y = 1) предсказывает правильный токен?" options={['Вектору единиц', 'Нулю', 'onehot(y)', '−q']} answer={1}
        explain="q − onehot(y) = onehot(y) − onehot(y) = 0. Нечего исправлять — градиента нет." />
    </>
  );
}
