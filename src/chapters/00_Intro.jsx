import React from 'react';
import { M, Eq, r, Cite, Callout, Code } from '../components/ui.jsx';

function BigPicture() {
  const boxes = [
    { x: 10, label: '«Мама мыла»', sub: ['текст', ''], cls: 'box' },
    { x: 140, label: '[812, 4051]', sub: ['токены', '(гл. 8)'], cls: 'hl3' },
    { x: 270, label: 'векторы', sub: ['эмбеддинги', '(гл. 9)'], cls: 'hl4' },
    { x: 400, label: '× N блоков', sub: ['внимание + MLP', '(гл. 10–12)'], cls: 'hl' },
    { x: 530, label: 'логиты', sub: ['число на', 'каждый токен'], cls: 'hl4' },
    { x: 660, label: 'P(«раму»)=0.41', sub: ['softmax', '(гл. 3)'], cls: 'hl2' },
  ];
  return (
    <svg viewBox="0 0 790 185" className="diagram" role="img" aria-label="Схема работы GPT">
      {boxes.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={20} width={118} height={52} rx={9} className={'box ' + b.cls} />
          <text x={b.x + 59} y={51} textAnchor="middle" fontWeight="600">{b.label}</text>
          <text x={b.x + 59} y={92} textAnchor="middle" className="sm">{b.sub[0]}</text>
          <text x={b.x + 59} y={106} textAnchor="middle" className="sm">{b.sub[1]}</text>
          {i < boxes.length - 1 && <path className="arrow" d={`M${b.x + 120} 46 L${b.x + 138} 46`} markerEnd="url(#ah)" />}
        </g>
      ))}
      <path className="arrow" d="M745 112 C 745 160, 30 160, 30 112" strokeDasharray="4 4" markerEnd="url(#ah)" />
      <text x={395} y={178} textAnchor="middle" className="sm">выбранный токен дописывается к тексту, и всё повторяется (гл. 15)</text>
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
        </marker>
      </defs>
    </svg>
  );
}

export default function Intro() {
  return (
    <>
      <h1>Карта пути</h1>
      <p className="lead">
        Этот учебник проведёт вас от школьной производной до языковой модели, которую вы соберёте и обучите сами.
        Ничего не будет «магией»: каждая формула выводится, каждая строчка кода объясняется, каждое утверждение опирается на оригинальную статью.
      </p>

      <h2>Что такое GPT в одном абзаце</h2>
      <p>
        GPT (Generative Pre-trained Transformer) — это функция, которая принимает последовательность кусочков текста (<b>токенов</b>) и
        возвращает <b>распределение вероятностей</b> для следующего токена. Внутри неё — несколько миллионов или миллиардов чисел (<b>параметров</b>),
        организованных в архитектуру <b>трансформер</b> <Cite id="vaswani2017" />. Параметры подбираются <b>градиентным спуском</b> так, чтобы модель
        как можно лучше угадывала следующий токен в огромном корпусе текстов <Cite id="radford2018,radford2019,brown2020" />. Генерация — это просто многократное
        «угадай следующий токен → допиши его → повтори».
      </p>
      <Eq t={r`P(\text{текст}) = \prod_{t=1}^{T} P_\theta(x_t \mid x_1, \dots, x_{t-1})`} label="вся языковая модель — в этой формуле; θ — параметры сети" />
      <BigPicture />

      <h2>Маршрут</h2>
      <table>
        <thead><tr><th>Часть</th><th>Что узнаете</th><th>Что сможете</th></tr></thead>
        <tbody>
          <tr><td>I. Математика</td><td>векторы, матрицы, производные, цепное правило, вероятность, softmax, кросс-энтропия</td><td>читать любую формулу в статьях про LLM</td></tr>
          <tr><td>II. Нейросети</td><td>нейрон, MLP, обратное распространение, autograd, SGD → Adam → AdamW</td><td>написать свой мини-PyTorch (micrograd) с нуля</td></tr>
          <tr><td>III. Язык</td><td>языковое моделирование, n-граммы, BPE-токенизатор, эмбеддинги, позиционное кодирование</td><td>обучить биграммную модель и свой токенизатор</td></tr>
          <tr><td>IV. Трансформер</td><td>внимание, Q/K/V, маска, многоголовость, LayerNorm, остаточные связи, архитектура GPT-2</td><td>написать <code>model.py</code> построчно и посчитать её параметры</td></tr>
          <tr><td>V. Обучение</td><td>данные, батчи, расписание LR, смешанная точность, сэмплинг (temperature, top-k, top-p)</td><td>обучить свою GPT и генерировать текст</td></tr>
          <tr><td>VI. Дальше</td><td>законы масштабирования, RoPE, RMSNorm, SwiGLU, GQA, KV-кэш, RLHF, DPO, LoRA</td><td>понимать, чем современные LLM отличаются от GPT-2</td></tr>
        </tbody>
      </table>

      <h2>Что нужно знать заранее</h2>
      <ul>
        <li><b>Python</b> на уровне «пишу функции и циклы». NumPy/PyTorch объясним по ходу.</li>
        <li><b>Школьная математика</b>: что такое функция, степень, логарифм, экспонента. Всё остальное (производные, матрицы, вероятности) объясняется с нуля в части I.</li>
        <li>Компьютер. Видеокарта <b>не обязательна</b>: финальную модель на «Шекспире» можно обучить на ноутбуке за 5–15 минут (см. главу 17), с GPU — модель крупнее и лучше.</li>
      </ul>

      <h2>Как читать</h2>
      <ul>
        <li>Блоки с меткой <b>ИНТЕРАКТИВ</b> — живые демонстрации. Двигайте ползунки, меняйте текст. Всё считается прямо в браузере, никаких серверов.</li>
        <li>Номера в квадратных скобках вроде <Cite id="vaswani2017" /> — ссылки на первоисточники. Наведите, чтобы увидеть название, нажмите — откроется статья. Полный список — в главе 19.</li>
        <li>Весь Python-код из учебника лежит в папке <code>python/</code> репозитория и реально запускается. Листинги в главах — это и есть эти файлы.</li>
        <li>В конце глав — вопросы «Проверь себя». Если ответили неверно — перечитайте раздел, это нормально.</li>
      </ul>

      <Callout type="tip" title="Главный совет">
        <p>Не читайте пассивно. Перепечатывайте код руками, ломайте его, меняйте числа. Понимание LLM приходит не от чтения формул, а от момента, когда
          вы сами видите, как loss падает с 4.17 до 1.5, и знаете, <i>почему</i>.</p>
      </Callout>

      <h2>Подготовка окружения</h2>
      <p>Для практики понадобится Python 3.9+ и PyTorch <Cite id="paszke2019" />:</p>
      <Code lang="bash" title="терминал">{`
git clone <адрес этого репозитория> llm-book
cd llm-book/python
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt                       # torch, numpy
python micrograd.py                                   # проверка: должна обучиться сеть на XOR
`}</Code>
      <p>Сам учебник можно запустить локально:</p>
      <Code lang="bash" title="терминал">{`
cd llm-book
npm install
npm run dev        # откройте ссылку, которую напечатает Vite
`}</Code>

      <h2>Короткая история</h2>
      <table>
        <tbody>
          <tr><td>1948</td><td>Шеннон вводит энтропию и строит первые n-граммные модели английского текста <Cite id="shannon1948" /></td></tr>
          <tr><td>1958</td><td>Перцептрон Розенблатта <Cite id="rosenblatt1958" /></td></tr>
          <tr><td>1986</td><td>Обратное распространение ошибки популяризировано Румельхартом, Хинтоном и Уильямсом <Cite id="rumelhart1986" /></td></tr>
          <tr><td>1997</td><td>LSTM <Cite id="hochreiter1997" /></td></tr>
          <tr><td>2003</td><td>Нейросетевая языковая модель Бенджио <Cite id="bengio2003" /></td></tr>
          <tr><td>2013</td><td>word2vec — эмбеддинги слов <Cite id="mikolov2013" /></td></tr>
          <tr><td>2014</td><td>seq2seq и механизм внимания <Cite id="sutskever2014,bahdanau2014" />; Adam <Cite id="kingma2014" /></td></tr>
          <tr><td>2016</td><td>BPE для нейросетей <Cite id="sennrich2016" />, LayerNorm <Cite id="ba2016" />, ResNet <Cite id="he2016resnet" /></td></tr>
          <tr><td>2017</td><td>Трансформер: «Attention Is All You Need» <Cite id="vaswani2017" /></td></tr>
          <tr><td>2018–2020</td><td>GPT-1, GPT-2, GPT-3 <Cite id="radford2018,radford2019,brown2020" />; законы масштабирования <Cite id="kaplan2020" /></td></tr>
          <tr><td>2022</td><td>Chinchilla <Cite id="hoffmann2022" />, InstructGPT/RLHF <Cite id="ouyang2022" />, FlashAttention <Cite id="dao2022" /></td></tr>
          <tr><td>2023+</td><td>LLaMA и открытые модели <Cite id="touvron2023" />, DPO <Cite id="rafailov2023" /></td></tr>
        </tbody>
      </table>
      <p>Поехали. Первая остановка — числа, собранные в списки и таблицы: <a href="#/linalg">векторы и матрицы</a>.</p>
      <p className="muted small">Обозначения: скаляры — <M t="x" />, векторы — <M t={r`\mathbf{x}`} />, матрицы — <M t="W" />; форма тензора пишется как <code>(B, T, C)</code> — батч, время (позиция), каналы (ширина модели).</p>
    </>
  );
}
