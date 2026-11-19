import React, { useMemo, useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';

// 32-битный хеш FNV-1a → точка на кольце [0, 1)
const h32 = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
const COLORS = ['#4c6ef5', '#f76707', '#2f9e44', '#ae3ec9', '#1098ad', '#e03131', '#f59f00', '#5c7cfa', '#20c997', '#d6336c'];

function ringOwner(points, x) {
  // первый узел по часовой стрелке от x
  let lo = 0, hi = points.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (points[m].pos < x) lo = m + 1; else hi = m; }
  return points[lo % points.length].node;
}

function HashRing() {
  const [nodes, setNodes] = useState(4);
  const [vnodes, setVnodes] = useState(1);
  const keys = useMemo(() => Array.from({ length: 2000 }, (_, i) => h32('key-' + i)), []);
  const build = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: vnodes }, (_, v) => ({ node: i, pos: h32(`node-${i}#${v}`) }))).flat().sort((a, b) => a.pos - b.pos);
  const ring = build(nodes), ring2 = build(nodes + 1);
  const own = keys.map((k) => ringOwner(ring, k)), own2 = keys.map((k) => ringOwner(ring2, k));
  const movedRing = own.filter((o, i) => o !== own2[i]).length / keys.length;
  const modOwn = keys.map((k) => Math.floor(k * 4294967296) % nodes), modOwn2 = keys.map((k) => Math.floor(k * 4294967296) % (nodes + 1));
  const movedMod = modOwn.filter((o, i) => o !== modOwn2[i]).length / keys.length;
  const load = Array.from({ length: nodes }, (_, i) => own.filter((o) => o === i).length);
  const ideal = keys.length / nodes;
  const R = 110, cx = 130, cy = 130, pt = (x, rr = R) => [cx + rr * Math.sin(2 * Math.PI * x), cy - rr * Math.cos(2 * Math.PI * x)];
  return (
    <Widget title="Согласованное хеширование: кольцо">
      <div className="controls">
        <Slider label="узлов" value={nodes} min={2} max={10} onChange={setNodes} />
        <Slider label="виртуальных узлов на сервер" value={vnodes} min={1} max={64} onChange={setVnodes} />
      </div>
      <div className="row">
        <svg viewBox="0 0 260 260" style={{ width: 260, maxWidth: '100%' }}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth={10} />
          {keys.slice(0, 300).map((k, i) => { const [x, y] = pt(k, R - 14); return <circle key={i} cx={x} cy={y} r={1.6} fill={COLORS[own[i] % 10]} />; })}
          {ring.map((p, i) => { const [x, y] = pt(p.pos); return <circle key={i} cx={x} cy={y} r={vnodes > 8 ? 3 : 6} fill={COLORS[p.node % 10]} stroke="#fff" />; })}
        </svg>
        <div className="col">
          {load.map((l, i) => (
            <div key={i} className="bar-row"><span className="lbl" style={{ color: COLORS[i % 10] }}>узел {i}</span><span className="track"><span className="fill" style={{ width: `${(100 * l) / (2.5 * ideal)}%`, display: 'block', background: COLORS[i % 10] }} /></span><span className="val">{l}</span></div>
          ))}
          <div className="stats">
            <Stat k="макс. / средняя нагрузка" v={fmt(Math.max(...load) / ideal, 2) + '×'} />
            <Stat k="+1 узел: переедет ключей (кольцо)" v={fmt(100 * movedRing, 1) + '%'} />
            <Stat k="+1 узел: переедет (hash mod N)" v={fmt(100 * movedMod, 1) + '%'} />
          </div>
        </div>
      </div>
      <p className="small muted">Ключ принадлежит первому узлу по часовой стрелке. При добавлении узла переезжает только ~1/(N+1) ключей — против почти всех при <code>hash(key) mod N</code>. С одной точкой на сервер нагрузка неравномерна; десятки виртуальных узлов выравнивают её.</p>
    </Widget>
  );
}

function Quorum() {
  const [N, setN] = useState(3);
  const [W, setW] = useState(2);
  const [R, setR] = useState(2);
  const [down, setDown] = useState(0);
  const alive = N - down;
  const overlap = R + W > N;
  return (
    <Widget title="Кворумы в системах без лидера (Dynamo, Cassandra)">
      <div className="controls">
        <Slider label="N — реплик" value={N} min={1} max={7} onChange={(v) => { setN(v); setW(Math.min(W, v)); setR(Math.min(R, v)); setDown(Math.min(down, v)); }} />
        <Slider label="W — ждём подтверждений записи" value={W} min={1} max={N} onChange={setW} />
        <Slider label="R — опрашиваем при чтении" value={R} min={1} max={N} onChange={setR} />
        <Slider label="недоступно реплик" value={down} min={0} max={N} onChange={setDown} />
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
        {Array.from({ length: N }, (_, i) => <div key={i} style={{ width: 42, height: 42, borderRadius: 8, display: 'grid', placeItems: 'center', background: i < alive ? 'var(--green-soft)' : 'var(--red-soft)', border: '1px solid var(--border)' }}>{i < alive ? '●' : '✗'}</div>)}
      </div>
      <div className="stats">
        <Stat k="запись возможна" v={alive >= W ? 'да' : 'нет'} />
        <Stat k="чтение возможно" v={alive >= R ? 'да' : 'нет'} />
        <Stat k="R + W > N" v={overlap ? 'да' : 'нет'} />
        <Stat k="переживёт отказов (запись / чтение)" v={`${N - W} / ${N - R}`} />
      </div>
      <p className="small">{overlap ? 'Любое множество из R реплик пересекается с любым из W — чтение увидит хотя бы одну реплику с последней записью (по версии выбирается новейшая).' : 'Множества чтения и записи могут не пересечься — чтение может вернуть устаревшее значение (итоговая согласованность).'}</p>
      <p className="small muted">Даже при R + W &gt; N это не линеаризуемость: возможны гонки параллельных записей и «небрежные» кворумы (sloppy quorum) при отказах. Типичная настройка — N=3, W=2, R=2.</p>
    </Widget>
  );
}

export default function Distributed() {
  return (
    <>
      <h1>Распределённые базы данных</h1>
      <p className="lead">Одна машина рано или поздно упирается в объём, нагрузку или требования к доступности. Тогда данные копируют (репликация) и делят (шардирование) — и сталкиваются с тем, что сеть ненадёжна, а часы врут.</p>

      <h2>Репликация</h2>
      <ul>
        <li><b>С одним лидером</b> (PostgreSQL, MySQL, MongoDB): все записи идут на лидера, он рассылает журнал последователям. Чтение можно распределять по репликам.</li>
        <li><b>Синхронная или асинхронная</b>: синхронная ждёт подтверждения реплики перед ответом клиенту (нет потерь при отказе лидера, но выше задержка); асинхронная быстрее, но при переключении на реплику последние транзакции теряются. Компромисс — полусинхронная (одна синхронная реплика).</li>
        <li><b>Задержка репликации</b> порождает аномалии: пользователь обновил профиль и сразу перечитал его с отставшей реплики — изменений «нет». Нужны гарантии вроде «читай свои записи» и монотонного чтения <Cite id="kleppmann2017" />.</li>
        <li><b>Без лидера</b> (Dynamo <Cite id="decandia2007" />, Cassandra <Cite id="lakshman2010" />): клиент пишет на несколько реплик сразу и читает с нескольких, конфликты разрешаются версиями.</li>
      </ul>
      <Quorum />

      <h2>Шардирование</h2>
      <p>Данные делятся на части (шарды, партиции), каждая живёт на своих узлах.</p>
      <ul>
        <li><b>По диапазонам ключа</b> (Bigtable <Cite id="chang2006" />, HBase, CockroachDB, Spanner): эффективные диапазонные запросы, но «горячие» диапазоны (например, монотонно растущие временные метки) перегружают один узел. Диапазоны автоматически делятся при росте.</li>
        <li><b>По хешу ключа</b> (Cassandra, DynamoDB): нагрузка равномерна, но диапазонный запрос идёт на все шарды. Чтобы при добавлении узла не перемещать все данные, используют <b>согласованное хеширование</b> Каргера и др. <Cite id="karger1997" /> (применено в Dynamo) или фиксированное большое число партиций.</li>
      </ul>
      <HashRing />

      <h2>Распределённые транзакции и консенсус</h2>
      <p>
        Транзакция, затронувшая несколько шардов, должна зафиксироваться везде или нигде. Классический протокол — <b>двухфазная фиксация</b> (2PC): координатор спрашивает всех «готовы?» (участники записывают в журнал всё нужное и отвечают «да»), затем рассылает «фиксируйте». Слабость 2PC — <b>блокировка</b>: если координатор упал после того, как участники сказали «да», они не могут ни зафиксировать, ни откатить, пока он не вернётся.
        Грей и Лэмпорт <Cite id="gray2006" /> показали, как устранить эту проблему, сделав решение о фиксации отказоустойчивым с помощью консенсуса (Paxos Commit).
      </p>
      <p>
        <b>Консенсус</b> — согласие нескольких узлов на одно значение (или на одну последовательность записей журнала) при отказах части узлов. Paxos Лэмпорта <Cite id="lamport1998" /> — классический алгоритм; Raft <Cite id="ongaro2014" /> спроектирован как более понятный и используется в etcd, CockroachDB, TiKV, YugabyteDB.
        Для кластера из <M t="2f+1" /> узлов консенсус выдерживает отказ <M t="f" /> узлов: любые два большинства пересекаются.
      </p>
      <Eq t={r`\text{кворум} = \Big\lfloor\frac{N}{2}\Big\rfloor + 1,\qquad N = 2f+1 \;\Rightarrow\; \text{выдерживает } f \text{ отказов}`} />

      <h2>Время</h2>
      <p>
        Часы разных машин расходятся, поэтому порядок событий по меткам времени ненадёжен. Лэмпорт <Cite id="lamport1978" /> ввёл логические часы, упорядочивающие события по причинности. Spanner <Cite id="corbett2012" /> пошёл от обратного: GPS-приёмники и атомные часы в датацентрах + API TrueTime, который возвращает интервал неопределённости <M t={r`[t-\varepsilon, t+\varepsilon]`} />. Фиксируя транзакцию, Spanner «ждёт» <M t={r`\varepsilon`} /> (единицы миллисекунд) — и получает глобально согласованные метки времени и внешнюю согласованность.
      </p>

      <h2>CAP и PACELC</h2>
      <p>
        Гипотеза Брюера <Cite id="brewer2000" />, доказанная Гилбертом и Линч <Cite id="gilbert2002" />: при сетевом разделении (P) система должна выбрать между согласованностью (C, линеаризуемость) и доступностью (A, каждый работающий узел отвечает).
        Это узкое утверждение: оно касается только момента разделения и только линеаризуемости. Абади <Cite id="abadi2012" /> предложил более полезную формулировку <b>PACELC</b>: при разделении (P) — выбор A или C; иначе (E) — выбор между задержкой (L) и согласованностью (C). Например, Dynamo-подобные системы — PA/EL, Spanner — PC/EC.
      </p>
      <Callout type="note" title="Итоговая согласованность">
        <p>Вогельс <Cite id="vogels2009" /> описывает модель, где реплики сходятся к одному значению, если записи прекращаются, — без гарантий, когда именно. Это осознанный компромисс ради доступности и низкой задержки, и приложение должно уметь жить с устаревшими чтениями и конфликтами.</p>
      </Callout>
      <Quiz q="Кластер Raft из 5 узлов. Сколько узлов может отказать без потери возможности фиксировать записи?" options={['1', '2', '3', '4']} answer={1}
        explain="Нужно большинство: 3 из 5. Значит, отказать могут 2." />
      <Quiz q="Чем согласованное хеширование лучше hash(key) mod N при добавлении узла?" options={['Хеш считается быстрее', 'Переезжает лишь ~1/(N+1) ключей, а не почти все', 'Не нужна репликация', 'Ключи хранятся отсортированными']} answer={1}
        explain="При mod N меняется N — и остаток почти у всех ключей. На кольце новый узел забирает только свой отрезок." />
    </>
  );
}
