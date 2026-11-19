import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt } from '@shared/ui.jsx';
import { LineChart } from '@shared/charts.jsx';
import { makeRng } from '@shared/rng.js';
import trainSrc from '../python/train.py?raw';
import prepareSrc from '../python/prepare.py?raw';

const TEXT = 'First Citizen:\nBefore we proceed any further, hear me speak.\n\nAll:\nSpeak, speak.\n\nFirst Citizen:\nYou are all resolved rather to die than to famish?';

function BatchWidget() {
  const [T, setT] = useState(8);
  const [seed, setSeed] = useState(3);
  const rng = makeRng(seed);
  const B = 3;
  const offs = Array.from({ length: B }, () => Math.floor(rng.rand() * (TEXT.length - T - 1)));
  const show = (c) => (c === '\n' ? '⏎' : c === ' ' ? '␣' : c);
  return (
    <Widget title="Как получается батч: x и y — один и тот же текст со сдвигом на 1">
      <div className="controls">
        <Slider label="block_size T" value={T} min={2} max={16} onChange={setT} />
        <button className="btn" onClick={() => setSeed(seed + 1)}>новый случайный батч</button>
      </div>
      {offs.map((o, b) => (
        <div key={b} style={{ marginBottom: 10 }}>
          <div className="small muted">последовательность {b + 1} (смещение {o})</div>
          <div className="mono small">x: {[...TEXT.slice(o, o + T)].map((c, i) => <span key={i} className="token" style={{ background: 'var(--accent-soft)' }}>{show(c)}</span>)}</div>
          <div className="mono small">y: {[...TEXT.slice(o + 1, o + T + 1)].map((c, i) => <span key={i} className="token" style={{ background: 'var(--green-soft)' }}>{show(c)}</span>)}</div>
        </div>
      ))}
      <p className="small muted">Одна последовательность длины T даёт T обучающих задач: по «{show(TEXT[offs[0]])}» предсказать «{show(TEXT[offs[0] + 1])}», по «{[...TEXT.slice(offs[0], offs[0] + 2)].map(show).join('')}» предсказать «{show(TEXT[offs[0] + 2])}», … Каузальная маска гарантирует, что позиция t видит только x[0..t]. Батч из B = {B} последовательностей даёт {B * T} предсказаний за один проход.</p>
    </Widget>
  );
}

function LRWidget() {
  const [maxLr, setMaxLr] = useState(1e-3);
  const [warm, setWarm] = useState(100);
  const [iters, setIters] = useState(5000);
  const [minRatio, setMinRatio] = useState(0.1);
  const lr = (it) => {
    if (it < warm) return (maxLr * (it + 1)) / warm;
    const ratio = (it - warm) / Math.max(1, iters - warm);
    return maxLr * minRatio + 0.5 * (1 + Math.cos(Math.PI * ratio)) * (maxLr - maxLr * minRatio);
  };
  const data = Array.from({ length: 200 }, (_, i) => { const it = Math.round((i / 199) * iters); return [it, lr(it)]; });
  return (
    <Widget title="Расписание learning rate: линейный разогрев + косинус">
      <div className="controls">
        <Slider label="max lr" value={maxLr} min={1e-4} max={3e-3} step={1e-4} onChange={setMaxLr} format={(v) => v.toExponential(1)} />
        <Slider label="warmup_iters" value={warm} min={0} max={1000} step={10} onChange={setWarm} />
        <Slider label="max_iters" value={iters} min={500} max={20000} step={100} onChange={setIters} />
        <Slider label="min_lr / max_lr" value={minRatio} min={0} max={1} step={0.05} onChange={setMinRatio} />
      </div>
      <LineChart height={220} series={[{ data, color: 'var(--c1)' }]} legend={false} xLabel="шаг" yLabel="lr" />
      <p className="mono small">lr(0) = {lr(0).toExponential(2)} · lr({warm}) = {lr(warm).toExponential(2)} · lr({Math.round(iters / 2)}) = {lr(Math.round(iters / 2)).toExponential(2)} · lr({iters}) = {lr(iters).toExponential(2)}</p>
      <p className="small muted">Это функция <code>get_lr</code> из <code>train.py</code>. GPT-3 использовал разогрев на 375 млн токенов и косинус до 10% от максимума (Brown и др., 2020).</p>
    </Widget>
  );
}

function CurvesWidget() {
  const [dropout, setDropout] = useState(0.0);
  const [dataSize, setDataSize] = useState(1);
  // качественная модель кривых обучения (иллюстрация, не симуляция): train падает, val расходится при переобучении
  const pts = Array.from({ length: 100 }, (_, i) => {
    const t = (i + 1) * 50;
    const base = 1.2 + 3 * Math.exp(-t / 600);
    const overfit = Math.max(0, (t - 1200 * dataSize * (1 + 3 * dropout)) / (4000 * dataSize * (1 + 4 * dropout)));
    return { t, train: base - 0.35 * overfit * (1 - dropout), val: base + 0.25 + 0.6 * overfit * overfit };
  });
  return (
    <Widget title="Чтение кривых обучения: недообучение и переобучение" badge="иллюстрация">
      <div className="controls">
        <Slider label="dropout" value={dropout} min={0} max={0.5} step={0.05} onChange={setDropout} />
        <Slider label="объём данных (×)" value={dataSize} min={0.5} max={4} step={0.25} onChange={setDataSize} />
      </div>
      <LineChart height={220} series={[
        { data: pts.map((p) => [p.t, p.train]), color: 'var(--c1)', label: 'train loss' },
        { data: pts.map((p) => [p.t, p.val]), color: 'var(--c2)', label: 'val loss' },
      ]} xLabel="шаг" />
      <p className="small muted">Схематичная картинка. Пока обе кривые падают — модель недообучена, учите дольше или берите модель больше. Когда train продолжает падать, а val начинает расти — переобучение: модель запоминает обучающий текст. Помогают больше данных, dropout, weight decay, меньшая модель или ранняя остановка (train.py сохраняет чекпоинт с лучшим val).</p>
    </Widget>
  );
}

export default function Training() {
  return (
    <>
      <h1>Обучение</h1>
      <p className="lead">У нас есть модель. Теперь — данные, батчи, цикл оптимизации и все инженерные детали, которые отличают «работает» от «работает быстро и устойчиво».</p>

      <h2>Данные</h2>
      <p>
        Языковой модели не нужна разметка: обучающий сигнал — сам текст (<b>самообучение</b>, self-supervised). Весь корпус токенизируется один раз и записывается в плоский массив чисел
        (<code>uint16</code> хватает для словаря до 65 535). GPT-2 обучался на WebText — 40 ГБ текста со страниц, на которые ссылались с Reddit <Cite id="radford2019" />; GPT-3 — на ~300 млрд токенов
        смеси Common Crawl, книг и Википедии <Cite id="brown2020" />; популярный открытый корпус — The Pile <Cite id="gao2020" />. Для учебной модели отлично подходят Tiny Shakespeare (1 МБ) <Cite id="karpathy2015" /> и
        TinyStories — синтетические детские рассказы, на которых даже модели с ~10 млн параметров пишут связный английский <Cite id="eldan2023" />.
      </p>
      <Code title="books/gpt/python/prepare.py" collapse>{prepareSrc}</Code>
      <p>Валидационная выборка — последние 10% текста. Важно брать непрерывный кусок, а не случайные окна: соседние окна сильно перекрываются, и «случайная» валидация была бы почти копией обучения.</p>

      <h2>Батчи</h2>
      <BatchWidget />
      <p>В коде: выбираем <M t="B" /> случайных смещений, режем окна длины <M t="T+1" />, первые <M t="T" /> токенов — вход, последние <M t="T" /> — цели. <code>np.memmap</code> позволяет не грузить многогигабайтный файл в память целиком.</p>

      <h2>Цикл обучения</h2>
      <p>Один шаг:</p>
      <ol>
        <li>Взять батч <M t="(X, Y)" />.</li>
        <li>Прямой проход: <M t={r`\mathcal L = \mathrm{CE}(\mathrm{GPT}_\theta(X), Y)`} />.</li>
        <li>Обратный проход: <M t={r`\nabla_\theta\mathcal L`} /> (глава 5).</li>
        <li>Обрезать норму градиента до 1.0 <Cite id="pascanu2013" />.</li>
        <li>Шаг AdamW с текущим <M t={r`\eta_t`} /> <Cite id="loshchilov2017" />, обнулить градиенты.</li>
      </ol>
      <LRWidget />

      <h2>Размер батча и накопление градиента</h2>
      <p>
        Крупные модели учат с огромными батчами — GPT-3 использовал до 3.2 млн токенов на шаг <Cite id="brown2020" />. Такой батч не влезет в память одной GPU. Решение — <b>накопление градиента</b>:
        сделать <M t="k" /> прямых-обратных проходов с микро-батчами, не обнуляя градиенты (они суммируются благодаря <code>+=</code>!), и только затем шаг оптимизатора. Чтобы получилось среднее, а не сумма, каждый loss делим на <M t="k" />:
      </p>
      <Eq t={r`\nabla\frac1{kB}\sum_{i=1}^{kB}\ell_i = \sum_{j=1}^{k}\nabla\Big(\frac1k\cdot\frac1B\sum_{i\in\text{микро-батч }j}\ell_i\Big)`} />

      <h2>Смешанная точность</h2>
      <p>
        Вычисления в 16-битных форматах вдвое экономят память и в разы быстрее на тензорных ядрах. Микикевичюс и др. <Cite id="micikevicius2017" />: храним «мастер-копию» весов в float32, а прямой и обратный проходы
        считаем в float16. У float16 узкий диапазон (минимальное нормальное число ≈ <M t={r`6\cdot10^{-5}`} />), поэтому маленькие градиенты обнуляются — помогает <b>масштабирование потерь</b> (loss scaling): умножить loss на
        большое число перед backward и разделить градиенты обратно перед шагом (<code>GradScaler</code>). Формат <b>bfloat16</b> имеет 8 бит экспоненты, как float32, — тот же диапазон, меньше точность, и масштабирование не нужно.
        <code>train.py</code> выбирает bf16, если GPU его поддерживает.
      </p>
      <table>
        <thead><tr><th>Формат</th><th>Биты (знак/экспонента/мантисса)</th><th>Диапазон</th><th>Точность (знаков)</th></tr></thead>
        <tbody>
          <tr><td>float32</td><td>1 / 8 / 23</td><td>~1e−38 … 3e38</td><td>~7</td></tr>
          <tr><td>float16</td><td>1 / 5 / 10</td><td>~6e−5 … 65504</td><td>~3</td></tr>
          <tr><td>bfloat16</td><td>1 / 8 / 7</td><td>~1e−38 … 3e38</td><td>~2</td></tr>
        </tbody>
      </table>

      <h2>Оценка и переобучение</h2>
      <p>Loss на одном батче шумный. <code>estimate_loss</code> усредняет его по <code>eval_iters</code> батчам для train и val, в режиме <code>model.eval()</code> (без dropout) и <code>torch.no_grad()</code> (без графа).</p>
      <CurvesWidget />

      <h2>Полный train.py</h2>
      <Code title="books/gpt/python/train.py" collapse>{trainSrc}</Code>

      <h2>Отладка: чек-лист</h2>
      <Callout type="danger" title="Если что-то не так">
        <ol>
          <li><b>Стартовый loss</b> должен быть ≈ ln V. Сильно больше — проблемы с инициализацией.</li>
          <li><b>Переобучите один батч.</b> Возьмите один фиксированный батч и учите на нём 200 шагов: loss должен упасть почти до 0. Если нет — ошибка в модели или в данных (часто — забытый сдвиг y относительно x).</li>
          <li><b>Loss = nan</b> — слишком большой LR, нет обрезки градиента, float16 без GradScaler, или log(0) в собственном коде.</li>
          <li><b>Loss застрял на ~ln V</b> — LR слишком мал, градиенты не доходят (забыли <code>loss.backward()</code> или <code>optimizer.step()</code>), или маска внимания позволяет видеть будущее (тогда train loss быстро падает почти до 0, а генерация — мусор).</li>
          <li><b>Train падает, val растёт</b> — переобучение (см. выше).</li>
          <li><b>Норма градиента</b> скачет на порядки — уменьшите LR, увеличьте warmup.</li>
        </ol>
      </Callout>
      <Quiz q="Вы забыли сдвинуть y относительно x (y = x). Что произойдёт?" options={['Обучение не сойдётся', 'Loss быстро упадёт почти до 0, но модель научится копировать текущий токен и ничего не сможет сгенерировать', 'Ничего, это эквивалентно', 'Будет ошибка формы']} answer={1}
        explain="Задача «предскажи токен, который ты видишь» тривиальна (тем более со связанными весами). Низкий loss без смысла — повод проверить данные." />
      <Quiz q="Для чего нужен линейный warmup?" options={['Для экономии памяти', 'В начале оценки моментов Adam ненадёжны и сеть случайна — большие шаги могут дестабилизировать обучение', 'Чтобы ускорить конец обучения', 'Он нужен только для SGD']} answer={1}
        explain="Плавный рост LR даёт оптимизатору время накопить статистику и предотвращает ранние всплески loss." />
    </>
  );
}
