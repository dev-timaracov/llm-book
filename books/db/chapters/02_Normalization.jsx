import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Stat } from '@shared/ui.jsx';
import { Rel } from '../lib/rel.jsx';
import { parseFDs, closure, candidateKeys, normalForm, bcnfDecompose } from '../lib/fd.js';
import normalizeSrc from '../python/normalize.py?raw';

const BIG = {
  cols: ['order_id', 'customer', 'city', 'product', 'price', 'qty'],
  rows: [[101, 'Аня', 'Казань', 'Ноутбук', 90000, 1], [101, 'Аня', 'Казань', 'Мышь', 1500, 2], [102, 'Борис', 'Пермь', 'Мышь', 1500, 1], [103, 'Аня', 'Казань', 'Монитор', 25000, 1]],
};

function AnomalyWidget() {
  const [rel, setRel] = useState(BIG);
  const [msg, setMsg] = useState('');
  const cities = new Set(rel.rows.filter((r) => r[1] === 'Аня').map((r) => r[2]));
  const prices = new Set(rel.rows.filter((r) => r[3] === 'Мышь').map((r) => r[4]));
  return (
    <Widget title="Аномалии «одной большой таблицы»">
      <Rel rel={rel} highlight={(r) => r[1] === 'Аня' || r[3] === 'Мышь'} />
      <div className="controls">
        <button className="btn" onClick={() => { setRel({ ...rel, rows: rel.rows.map((r, i) => (i === 0 ? [r[0], r[1], 'Москва', ...r.slice(3)] : r)) }); setMsg('Аномалия обновления: Аня переехала, но город поменяли только в одной строке. Теперь неизвестно, где она живёт.'); }}>Аня переехала (UPDATE одной строки)</button>
        <button className="btn" onClick={() => { setRel({ ...rel, rows: rel.rows.filter((r) => r[0] !== 102) }); setMsg('Аномалия удаления: отменили единственный заказ Бориса — и вместе с ним исчезло знание о том, что Борис — покупатель из Перми.'); }}>Удалить заказ 102</button>
        <button className="btn" onClick={() => setMsg('Аномалия вставки: новый товар «Клавиатура» с ценой нельзя добавить, пока его кто-нибудь не купит, — нужен order_id, а он часть ключа.')}>Добавить товар без заказа</button>
        <button className="btn" onClick={() => { setRel(BIG); setMsg(''); }}>сбросить</button>
      </div>
      <div className="stats"><Stat k="городов у Ани" v={cities.size} /><Stat k="цен у «Мыши»" v={prices.size} /></div>
      {msg && <p className="small">{msg}</p>}
      <p className="small muted">Причина всех трёх аномалий одна: факт «Аня живёт в Казани» хранится столько раз, сколько у неё позиций в заказах. Нормализация — способ хранить каждый факт ровно один раз.</p>
    </Widget>
  );
}

const PRESETS = {
  'заказы': { attrs: 'order_id customer city product price qty', fds: 'order_id -> customer\ncustomer -> city\nproduct -> price\norder_id product -> qty' },
  'адрес (3NF, не BCNF)': { attrs: 'street city zip', fds: 'street city -> zip\nzip -> city' },
  'расписание': { attrs: 'teacher course room time', fds: 'course -> teacher\nroom time -> course\nteacher time -> room' },
  'уже BCNF': { attrs: 'id email name', fds: 'id -> email name\nemail -> id' },
};

function FDWidget() {
  const [attrsText, setAttrs] = useState(PRESETS['заказы'].attrs);
  const [fdText, setFds] = useState(PRESETS['заказы'].fds);
  const [x, setX] = useState('order_id');
  const attrs = [...new Set(attrsText.split(/[\s,]+/).filter(Boolean))];
  const fds = parseFDs(fdText).filter(([l, rr]) => [...l, ...rr].every((a) => attrs.includes(a)));
  const tooBig = attrs.length > 12;
  const cl = closure(new Set(x.split(/[\s,]+/).filter(Boolean)), fds);
  const nf = tooBig ? null : normalForm(attrs, fds);
  const parts = tooBig ? [] : bcnfDecompose(attrs, fds);
  return (
    <Widget title="Анализатор функциональных зависимостей">
      <div className="controls">{Object.keys(PRESETS).map((k) => <button key={k} className="btn small" onClick={() => { setAttrs(PRESETS[k].attrs); setFds(PRESETS[k].fds); setX(PRESETS[k].attrs.split(' ')[0]); }}>{k}</button>)}</div>
      <div className="row">
        <div className="col">
          <p className="small">Атрибуты: <input type="text" value={attrsText} onChange={(e) => setAttrs(e.target.value)} style={{ width: '100%' }} /></p>
          <p className="small">Зависимости (по одной в строке, <code>A B -&gt; C</code>):</p>
          <textarea rows={5} value={fdText} onChange={(e) => setFds(e.target.value)} />
          <p className="small">Замыкание множества <input type="text" value={x} onChange={(e) => setX(e.target.value)} style={{ width: 140 }} />⁺ = <b className="mono">{'{' + [...cl].join(', ') + '}'}</b></p>
        </div>
        <div className="col">
          {tooBig ? <p className="small">Слишком много атрибутов для перебора в браузере.</p> : (
            <>
              <div className="stats"><Stat k="нормальная форма" v={nf.nf} /></div>
              <p className="small"><b>Потенциальные ключи:</b> {nf.keys.map((k) => '{' + [...k].join(', ') + '}').join(', ')}</p>
              <p className="small">{nf.nf === 'BCNF' ? '✓ ' : '✗ '}{nf.why}</p>
              <p className="small"><b>Декомпозиция в BCNF:</b></p>
              {parts.map((p, i) => <div key={i} className="mono small">R{i + 1}({p.join(', ')})</div>)}
            </>
          )}
        </div>
      </div>
      <p className="small muted">Проверка нормальных форм предполагает 1NF (атомарные значения). Декомпозиция без потерь соединения: на каждом шаге отношение делится по нарушающей зависимости X → Y на (X ∪ Y) и (R − Y). Попробуйте «адрес»: BCNF-декомпозиция теряет зависимость street city → zip.</p>
    </Widget>
  );
}

export default function Normalization() {
  return (
    <>
      <h1>Нормализация и проектирование схем</h1>
      <p className="lead">Как разложить данные по таблицам так, чтобы каждый факт хранился один раз, база не противоречила сама себе, а запросы оставались простыми. Это теория функциональных зависимостей — и инженерный вкус.</p>

      <h2>От предметной области к схеме</h2>
      <p>
        Проектирование начинают с концептуальной модели «сущность — связь» Чена <Cite id="chen1976" />: <b>сущности</b> (Покупатель, Заказ, Товар) с атрибутами, <b>связи</b> между ними с кардинальностями (1:1, 1:N, M:N). Перевод в таблицы почти механический: сущность → таблица с первичным ключом; связь 1:N → внешний ключ на стороне «многих»; связь M:N → отдельная таблица-связка из двух внешних ключей (и, возможно, атрибутов самой связи: количество, дата).
      </p>
      <AnomalyWidget />

      <h2>Функциональные зависимости</h2>
      <p>
        <M t={r`X\to Y`} /> (<M t="X" /> функционально определяет <M t="Y" />), если любые две строки с одинаковыми значениями <M t="X" /> обязаны иметь одинаковые значения <M t="Y" />. Это утверждение о <i>предметной области</i>, а не о текущих данных: «у заказа ровно один покупатель», «у товара одна цена».
      </p>
      <p><b>Аксиомы Армстронга</b> позволяют выводить новые зависимости, и они полны — выводят всё, что следует логически:</p>
      <Eq t={r`\begin{aligned}&\text{рефлексивность:} && Y\subseteq X \Rightarrow X\to Y\\ &\text{пополнение:} && X\to Y \Rightarrow XZ\to YZ\\ &\text{транзитивность:} && X\to Y,\; Y\to Z \Rightarrow X\to Z\end{aligned}`} />
      <p>
        На практике вместо вывода считают <b>замыкание</b> <M t={r`X^+`} />: начать с <M t="X" /> и добавлять правые части всех зависимостей, чьи левые части уже внутри, пока что-то добавляется. <M t="X" /> — суперключ, если <M t={r`X^+`} /> — все атрибуты; <b>потенциальный ключ</b> — минимальный суперключ.
      </p>
      <FDWidget />

      <h2>Нормальные формы</h2>
      <table>
        <thead><tr><th>Форма</th><th>Требование</th><th>Что устраняет</th></tr></thead>
        <tbody>
          <tr><td><b>1NF</b></td><td>значения атомарны: нет списков и повторяющихся групп в одной ячейке</td><td>«phone1, phone2, phone3»; список товаров через запятую</td></tr>
          <tr><td><b>2NF</b></td><td>1NF + неключевые атрибуты зависят от <i>всего</i> ключа, а не от его части</td><td>в (order_id, product) → price цена зависит только от product</td></tr>
          <tr><td><b>3NF</b></td><td>2NF + нет транзитивных зависимостей неключевых атрибутов: для каждой <M t={r`X\to A`} /> либо <M t="X" /> — суперключ, либо <M t="A" /> входит в какой-то ключ</td><td>order_id → customer → city</td></tr>
          <tr><td><b>BCNF</b></td><td>для каждой нетривиальной <M t={r`X\to Y`} /> <M t="X" /> — суперключ</td><td>оставшиеся аномалии из-за перекрывающихся ключей</td></tr>
          <tr><td><b>4NF, 5NF</b></td><td>нет нетривиальных многозначных зависимостей и зависимостей соединения</td><td>независимые списки в одной таблице («навыки» и «языки» сотрудника)</td></tr>
        </tbody>
      </table>
      <p>Доступное и точное изложение всех пяти форм — классическая заметка Кента <Cite id="kent1983" />.</p>

      <h3>Декомпозиция: без потерь и с сохранением зависимостей</h3>
      <p>Разбиение <M t="R" /> на <M t="R_1, R_2" /> должно обладать двумя свойствами:</p>
      <ul>
        <li><b>Соединение без потерь</b>: <M t={r`R_1\bowtie R_2 = R`} /> — ни лишних, ни пропавших строк. Достаточное условие: общие атрибуты <M t={r`R_1\cap R_2`} /> — ключ хотя бы одной из частей.</li>
        <li><b>Сохранение зависимостей</b>: каждую зависимость можно проверить внутри одной таблицы (иначе для проверки ограничения нужен JOIN при каждой вставке).</li>
      </ul>
      <p>
        BCNF-декомпозиция всегда без потерь, но иногда теряет зависимости (пример «адрес» в анализаторе). Для 3NF существует алгоритм синтеза Бернштейна <Cite id="bernstein1976" />, дающий и то и другое: по таблице на каждую группу зависимостей минимального покрытия, плюс таблица с ключом. Поэтому 3NF — практическая цель по умолчанию.
      </p>
      <Code title="books/db/python/normalize.py" collapse>{normalizeSrc}</Code>
      <Code lang="bash" title="вывод python normalize.py (сокращён)">{`
потенциальные ключи: ['{order_id product_id}']
BCNF? False
декомпозиция в BCNF:
   {customer_city customer_id customer_name}
   {customer_id order_id}
   {price product_id product_name}
   {order_id product_id qty}
адрес: ключи ['{city street}', '{street zip}'] | BCNF? False
BCNF-декомпозиция: ['{city zip}', '{street zip}'] — зависимость street city -> zip больше не проверяется внутри одной таблицы
3NF-синтез: ['{city street zip}'] — таблица в 3NF, но не в BCNF
`}</Code>

      <h2>Денормализация и практические решения</h2>
      <ul>
        <li><b>Денормализация ради чтения.</b> Каждое соединение стоит денег; иногда факт сознательно дублируют (цена товара в позиции заказа — к тому же это и <i>правильно</i>: цена на момент покупки — другой факт, чем текущая цена). Платой становится поддержание согласованности: триггеры, материализованные представления, код приложения.</li>
        <li><b>Аналитические схемы</b> намеренно денормализованы: «звезда» — большая таблица фактов и широкие таблицы измерений (глава 21).</li>
        <li><b>Суррогатные и естественные ключи.</b> Естественный ключ (паспорт, email) несёт смысл, но может меняться; суррогатный (<code>bigint</code>-последовательность или UUID) стабилен. Последовательные ключи хорошо ложатся в B+-дерево; случайные UUIDv4 разбрасывают вставки по всему индексу — для этого придуманы упорядоченные по времени UUIDv7.</li>
        <li><b>Ограничения — часть схемы.</b> <code>NOT NULL</code>, <code>UNIQUE</code>, <code>CHECK</code>, <code>FOREIGN KEY</code> — это объявленные зависимости и инварианты, которые СУБД проверяет за вас при любой нагрузке и параллельности (глава 11).</li>
        <li><b>Документная модель</b> — другой ответ на тот же вопрос: хранить агрегат целиком в одном документе (глава 18). Он хорош, пока связи — «один ко многим внутри агрегата», и плох для «многие ко многим».</li>
      </ul>
      <Quiz q="Таблица (student_id, course_id, course_title, mark), ключ (student_id, course_id), course_id → course_title. В какой она нормальной форме?" options={['BCNF', '3NF', '2NF', '1NF (нарушена 2NF)']} answer={3}
        explain="course_title зависит от части ключа (course_id) — частичная зависимость, 2NF нарушена. Название курса надо вынести в таблицу courses." />
      <Quiz q="Почему 3NF часто предпочитают BCNF на практике?" options={['3NF быстрее', 'Синтез в 3NF всегда сохраняет зависимости и даёт соединение без потерь; BCNF иногда теряет зависимости', 'BCNF не существует в SQL', 'В 3NF меньше таблиц']} answer={1}
        explain="Если зависимость потеряна, проверка соответствующего ограничения требует соединения таблиц при каждой записи." />
    </>
  );
}
