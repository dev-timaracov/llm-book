import React, { useState } from 'react';
import { M, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';

const KEYS = [
  'user:0042', 'user:0042:order:2024-01-15:A17', 'user:0042:order:2024-03-02:B03', 'user:0042:order:2024-06-30:C11',
  'user:0042:session:9f3a', 'user:0107', 'user:0107:order:2024-02-11:D42', 'user:0107:session:77c1', 'user:1500', 'user:1500:order:2023-12-31:E09',
];

function KeyDesign() {
  const [prefix, setPrefix] = useState('user:0042:order:2024-0');
  const sorted = [...KEYS].sort();
  const hit = sorted.filter((k) => k.startsWith(prefix));
  return (
    <Widget title="Проектирование ключей: упорядоченное хранилище и сканирование по префиксу">
      <p className="small">Префикс: <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} style={{ width: 260 }} className="mono" /></p>
      <div className="controls">
        {['user:0042', 'user:0042:order:', 'user:0042:order:2024-0', 'user:0107:', 'user:'].map((p) => <button key={p} className="btn small mono" onClick={() => setPrefix(p)}>{p}</button>)}
      </div>
      <div>{sorted.map((k) => <div key={k} className="mono small" style={{ padding: '1px 6px', background: k.startsWith(prefix) ? 'var(--amber-soft)' : undefined, borderRadius: 3 }}>{k}</div>)}</div>
      <div className="stats"><Stat k="найдено ключей" v={hit.length} /><Stat k="операция" v="seek(prefix) + next()…" /></div>
      <p className="small muted">В упорядоченном хранилище (RocksDB, LevelDB, Bigtable, FoundationDB, TiKV) ключи отсортированы побайтово. Составной ключ «сущность:id:тип:дата» превращает «все заказы пользователя за первое полугодие» в один непрерывный диапазон: найти первый ключ и читать подряд. Даты пишут в формате ГГГГ-ММ-ДД, а числа — с ведущими нулями, чтобы лексикографический порядок совпадал со смысловым. В хеш-хранилищах (Redis, Dynamo-подобные) диапазонов нет — только точный ключ.</p>
    </Widget>
  );
}

function ModelingWidget() {
  const [posts, setPosts] = useState(100);
  const [comments, setComments] = useState(20);
  const [userComments, setUserComments] = useState(300);
  const rows = [
    { q: 'Открыть пост со всеми комментариями', embed: 1, ref: 1 + comments, rel: '1 запрос с JOIN' },
    { q: 'Все комментарии одного пользователя', embed: posts, ref: userComments, rel: '1 запрос по индексу' },
    { q: 'Пользователь сменил имя (имя скопировано в комментарии)', embed: posts, ref: 1, rel: '1 строка' },
    { q: 'Пост с 100 000 комментариев', embed: 'документ > лимита (16 МБ в MongoDB)', ref: 'ок', rel: 'ок' },
  ];
  return (
    <Widget title="Вкладывать или ссылаться: блог с постами и комментариями">
      <div className="controls">
        <Slider label="постов" value={posts} min={10} max={10000} step={10} onChange={setPosts} />
        <Slider label="комментариев на пост" value={comments} min={1} max={500} onChange={setComments} />
        <Slider label="комментариев одного пользователя" value={userComments} min={1} max={2000} onChange={setUserComments} />
      </div>
      <table className="small">
        <thead><tr><th>Операция</th><th>Комментарии вложены в пост (документов прочитать/изменить)</th><th>Комментарии — отдельные документы со ссылкой</th><th>Реляционно</th></tr></thead>
        <tbody>{rows.map((x) => <tr key={x.q}><td>{x.q}</td><td>{typeof x.embed === 'number' ? (x.embed === posts ? `${x.embed} (все посты — без отдельного индекса)` : x.embed) : x.embed}</td><td>{x.ref}</td><td>{x.rel}</td></tr>)}</tbody>
      </table>
      <p className="small muted">Вложение идеально, когда данные читаются вместе и «принадлежат» родителю (позиции заказа, адреса пользователя). Ссылки — когда сущность живёт сама по себе, нужна с разных сторон или растёт неограниченно. Индекс по вложенному полю (multikey-индекс по массиву) ускоряет второй запрос, но не отменяет проблему обновлений копий.</p>
    </Widget>
  );
}

export default function KVDocument() {
  return (
    <>
      <h1>Key-value и документные базы</h1>
      <p className="lead">Самые простые модели данных: значение по ключу и документ по идентификатору. Простота модели даёт масштаб и скорость — и перекладывает часть работы на приложение.</p>

      <h2>Key-value: модель</h2>
      <p>Интерфейс — <code>get(k)</code>, <code>put(k, v)</code>, <code>delete(k)</code>, иногда <code>scan(от, до)</code>. Значение для хранилища — непрозрачные байты. Внутри — знакомые структуры:</p>
      <table>
        <thead><tr><th>Класс</th><th>Устройство</th><th>Примеры</th></tr></thead>
        <tbody>
          <tr><td>В памяти</td><td>хеш-таблицы и структуры данных в ОЗУ; долговечность — снимками и журналом команд</td><td>Redis, Memcached (без долговечности)</td></tr>
          <tr><td>Встраиваемые движки</td><td>LSM-дерево (глава 7) или B+-дерево с копированием при записи</td><td>RocksDB, LevelDB, LMDB, BoltDB</td></tr>
          <tr><td>Распределённые</td><td>шардирование + репликация + кворумы или консенсус (глава 14)</td><td>DynamoDB <Cite id="elhemali2022" />, Riak, etcd, FoundationDB, TiKV</td></tr>
        </tbody>
      </table>
      <p>
        Встраиваемый KV-движок — строительный блок для других СУБД: MyRocks — это MySQL поверх RocksDB, который Facebook использовал, чтобы уменьшить объём хранения социального графа по сравнению с InnoDB <Cite id="matsunobu2020" />; CockroachDB, TiDB, YugabyteDB строят SQL поверх распределённого упорядоченного KV.
      </p>
      <KeyDesign />

      <h3>Redis: структуры данных вместо байтов</h3>
      <p>Redis хранит не просто строки, а структуры с атомарными операциями над ними: списки (очереди), множества, отсортированные множества (рейтинги — <code>ZADD</code>, <code>ZRANGE</code> за <M t="O(\log n)" />), хеши, потоки, HyperLogLog для приблизительного подсчёта уникальных. Команды выполняются в одном потоке по очереди — каждая атомарна без блокировок. Типичные применения: кэш, сессии, счётчики и ограничение частоты запросов, очереди, рейтинги.</p>
      <Code lang="python" title="python — кэш «cache-aside» и ограничитель частоты (redis-py)">{`
import json, time
import redis

r = redis.Redis()

def get_user(uid, db):
    key = f"user:{uid}"
    if (cached := r.get(key)) is not None:          # попадание в кэш
        return json.loads(cached)
    user = db.fetch_user(uid)                       # промах: идём в основную БД
    r.set(key, json.dumps(user), ex=300)            # TTL 5 минут — устаревание ограничено во времени
    return user

def allow_request(client_id, limit=100, window=60):
    """Не больше limit запросов за окно window секунд (фиксированное окно)."""
    key = f"rate:{client_id}:{int(time.time()) // window}"
    pipe = r.pipeline()
    pipe.incr(key)                                  # атомарный инкремент
    pipe.expire(key, window)
    count, _ = pipe.execute()
    return count <= limit
`}</Code>
      <Callout type="warn" title="Кэш — это вторая копия данных">
        <p>Как только данные лежат в двух местах, появляются все проблемы репликации (глава 14): устаревшие значения, гонки между записью в БД и сбросом кэша, «лавина» промахов, когда популярный ключ истёк и тысячи запросов одновременно идут в БД. Помогают TTL, сброс кэша после записи (а не до), блокировка на пересчёт ключа и небольшой случайный разброс TTL.</p>
      </Callout>

      <h2>Документные базы</h2>
      <p>
        Документ — самодостаточная иерархическая запись (JSON или его двоичные варианты вроде BSON): заказ вместе с позициями и адресом доставки. В отличие от key-value, СУБД <b>понимает структуру</b> документа: умеет индексировать вложенные поля и элементы массивов, фильтровать и агрегировать по ним. Схема не задаётся заранее (schema-on-read): у разных документов коллекции могут быть разные поля.
      </p>
      <Code lang="javascript" title="MongoDB — документ, индекс по вложенному полю, конвейер агрегации">{`
db.orders.insertOne({
  _id: 1017, customer: { id: 42, name: "Аня", city: "Казань" },
  items: [ { sku: "NB-14", qty: 1, price: 90000 }, { sku: "MS-02", qty: 2, price: 1500 } ],
  status: "paid", created: ISODate("2024-03-02")
});

db.orders.createIndex({ "customer.id": 1, created: -1 });   // составной индекс по вложенному полю
db.orders.createIndex({ "items.sku": 1 });                  // multikey: по элементу на каждый товар массива

// выручка по городам: аналог GROUP BY с «разворачиванием» массива
db.orders.aggregate([
  { $match: { status: "paid" } },
  { $unwind: "$items" },
  { $group: { _id: "$customer.city", revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } } } },
  { $sort: { revenue: -1 } }
]);
`}</Code>
      <ModelingWidget />
      <ul>
        <li><b>Индексы.</b> В основе — те же B+-деревья (MongoDB использует движок WiredTiger). Azure DocumentDB (Cosmos DB) пошёл дальше и по умолчанию индексирует <i>все</i> пути всех документов, не требуя схемы <Cite id="shukla2015" />.</li>
        <li><b>Транзакции.</b> Изменение одного документа атомарно всегда. Многодокументные ACID-транзакции в MongoDB появились только в версии 4.0 (2018) — до этого вложение было ещё и способом получить атомарность.</li>
        <li><b>Цена гибкой схемы.</b> Схема всё равно существует — в коде приложения, и каждому читающему коду приходится помнить про старые форматы документов. Поэтому в зрелых проектах появляется валидация схемы на стороне БД.</li>
      </ul>

      <h3>JSON в реляционных СУБД</h3>
      <p>
        Граница размыта: PostgreSQL хранит <code>jsonb</code> в разобранном двоичном виде и индексирует его GIN-индексом (инвертированный индекс по ключам и значениям), в SQL:2016 появились стандартные функции работы с JSON, а Oracle показал, что JSON в реляционной СУБД может догнать NoSQL по удобству и скорости <Cite id="liu2014" />. Стоунбрейкер и Павло <Cite id="stonebraker2024" /> отмечают, что документная модель — это во многом возвращение иерархической модели 1960-х, а реляционные системы поглотили её возможности.
      </p>
      <Code lang="sql" title="PostgreSQL — документы в реляционной таблице">{`
CREATE TABLE orders (id bigint PRIMARY KEY, doc jsonb NOT NULL);
CREATE INDEX orders_doc_gin ON orders USING gin (doc jsonb_path_ops);

-- заказы с товаром NB-14: оператор @> («содержит») использует GIN-индекс
SELECT id, doc->'customer'->>'name' AS customer
FROM orders
WHERE doc @> '{"items": [{"sku": "NB-14"}]}';

-- разворачиваем массив позиций в строки и считаем выручку по городам
SELECT doc->'customer'->>'city' AS city,
       sum((i->>'qty')::int * (i->>'price')::numeric) AS revenue
FROM orders, jsonb_array_elements(doc->'items') AS i
WHERE doc->>'status' = 'paid'
GROUP BY 1 ORDER BY 2 DESC;
`}</Code>
      <Quiz q="Нужно хранить корзины покупателей: читать и писать корзину целиком по id пользователя, миллионы операций в секунду. Что подходит лучше всего?" options={['Графовая СУБД', 'Key-value хранилище (или документное) с ключом user_id', 'Колоночная СУБД', 'Хранилище данных со схемой «звезда»']} answer={1}
        explain="Доступ строго по ключу и целиком — ровно то, для чего предназначены KV-хранилища." />
      <Quiz q="Почему в упорядоченном KV-хранилище даты в ключах пишут как 2024-03-02, а не 2.3.2024?" options={['Так короче', 'Чтобы лексикографический порядок байтов совпадал с хронологическим и диапазон дат был непрерывным диапазоном ключей', 'Так требует JSON', 'Из-за часовых поясов']} answer={1}
        explain="«10.1» лексикографически меньше «2.1». Формат ГГГГ-ММ-ДД сортируется правильно." />
    </>
  );
}
