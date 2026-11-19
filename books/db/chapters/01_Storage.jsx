import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, Stat, fmt } from '@shared/ui.jsx';

const LAT = [
  ['Регистр / кэш L1', 1e-9],
  ['Кэш L3', 1.2e-8],
  ['Оперативная память (DRAM)', 1e-7],
  ['NVMe SSD, случайное чтение 4 КБ', 2e-5],
  ['SATA SSD, случайное чтение', 1e-4],
  ['HDD, позиционирование головки', 8e-3],
  ['Запрос в другой датацентр', 1.5e-1],
];
const human = (s) => {
  if (s < 60) return `${fmt(s, s < 10 ? 1 : 0)} с`;
  if (s < 3600) return `${fmt(s / 60, 0)} мин`;
  if (s < 86400) return `${fmt(s / 3600, 1)} ч`;
  if (s < 86400 * 365) return `${fmt(s / 86400, 0)} дн.`;
  return `${fmt(s / 86400 / 365, 1)} лет`;
};

function Latency() {
  return (
    <Widget title="Если бы 1 наносекунда длилась 1 секунду" badge="масштаб">
      <table>
        <thead><tr><th>Операция</th><th>Порядок задержки</th><th>В «человеческом» масштабе</th></tr></thead>
        <tbody>
          {LAT.map(([k, s]) => (
            <tr key={k}><td>{k}</td><td className="mono">{s < 1e-6 ? fmt(s * 1e9, 0) + ' нс' : s < 1e-3 ? fmt(s * 1e6, 0) + ' мкс' : fmt(s * 1e3, 0) + ' мс'}</td><td><b>{human(s * 1e9)}</b></td></tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">Порядки величин для типичного железа 2020-х; конкретные числа зависят от устройства. Главное — соотношения: память в сотни раз быстрее SSD, SSD в сотни раз быстрее HDD при случайном доступе.</p>
    </Widget>
  );
}

const PAGE = 256; // учебный размер страницы, байт
const HEADER = 16, SLOT = 4;

function SlottedPage() {
  // у каждой записи своё смещение: данные растут от конца страницы к началу
  const [recs, setRecs] = useState([{ len: 40, off: PAGE - 40, live: true }, { len: 24, off: PAGE - 64, live: true }, { len: 56, off: PAGE - 120, live: true }]);
  const [len, setLen] = useState(32);
  const [msg, setMsg] = useState('');
  const L = recs;
  const dataStart = Math.min(PAGE, ...recs.filter((x) => x.off !== null).map((x) => x.off));
  const slotsEnd = HEADER + recs.length * SLOT;
  const free = dataStart - slotsEnd;
  const deadBytes = recs.filter((x) => !x.live && x.off !== null).reduce((a, x) => a + x.len, 0);
  const insert = () => {
    const reuse = recs.findIndex((x) => !x.live && x.off === null);
    const need = len + (reuse >= 0 ? 0 : SLOT);
    if (need > free) { setMsg(`не помещается: нужно ${need} Б, свободно ${free} Б${deadBytes ? ' — попробуйте уплотнить страницу' : ' — СУБД возьмёт новую страницу'}`); return; }
    setMsg(reuse >= 0 ? `использован освободившийся слот ${reuse}` : '');
    const rec = { len, off: dataStart - len, live: true };
    if (reuse >= 0) { const n = [...recs]; n[reuse] = rec; setRecs(n); } else setRecs([...recs, rec]);
  };
  const del = (i) => { const n = [...recs]; n[i] = { ...n[i], live: false }; setRecs(n); setMsg(`запись ${i} помечена удалённой: место занято до уплотнения, номер слота сохраняется`); };
  const compact = () => {
    let end = PAGE;
    // живые записи сдвигаем к концу страницы в порядке их текущего расположения
    const order = recs.map((x, i) => [x, i]).filter(([x]) => x.live).sort((a, b) => b[0].off - a[0].off);
    const n = recs.map((x) => (x.live ? { ...x } : { len: 0, off: null, live: false }));
    for (const [x, i] of order) { end -= x.len; n[i].off = end; }
    setRecs(n);
    setMsg('уплотнение: живые записи сдвинуты к концу страницы, слоты обновлены; адреса (страница, слот) не изменились');
  };
  const W = 640, sx = (b) => (b / PAGE) * W;
  const colors = ['#ffd8a8', '#c5f6fa', '#d3f9d8', '#e5dbff', '#ffe3e3', '#fff3bf', '#d0ebff'];
  return (
    <Widget title="Страница со слотами (slotted page)">
      <svg viewBox={`0 0 ${W} 90`} className="diagram">
        <rect x={0} y={20} width={sx(HEADER)} height={40} fill="var(--violet-soft)" stroke="var(--violet)" />
        <text x={sx(HEADER) / 2} y={45} textAnchor="middle" fontSize="10">загол.</text>
        {recs.map((rec, i) => (
          <g key={'s' + i}>
            <rect x={sx(HEADER + i * SLOT)} y={20} width={sx(SLOT)} height={40} fill={rec.live ? colors[i % 7] : 'var(--bg-soft)'} stroke="var(--border)" />
            <text x={sx(HEADER + i * SLOT + SLOT / 2)} y={45} textAnchor="middle" fontSize="9">{i}</text>
          </g>
        ))}
        <rect x={sx(slotsEnd)} y={20} width={Math.max(0, sx(free))} height={40} fill="none" stroke="var(--border)" strokeDasharray="3 3" />
        {free > 20 && <text x={sx(slotsEnd + free / 2)} y={45} textAnchor="middle" className="sm">свободно {free} Б</text>}
        {L.map((rec, i) => rec.off !== null && (
          <g key={'r' + i}>
            <rect x={sx(rec.off)} y={20} width={sx(rec.len)} height={40} fill={rec.live ? colors[i % 7] : 'var(--red-soft)'} stroke="var(--muted)" />
            <text x={sx(rec.off + rec.len / 2)} y={45} textAnchor="middle" fontSize="11">{rec.live ? `#${i}` : '✗'}</text>
            {rec.live && <path d={`M${sx(HEADER + i * SLOT + SLOT / 2)} 20 C ${sx(HEADER + i * SLOT + SLOT / 2)} 4, ${sx(rec.off + rec.len / 2)} 4, ${sx(rec.off + rec.len / 2)} 20`} fill="none" stroke="var(--muted)" strokeWidth="0.8" />}
          </g>
        ))}
        <text x={0} y={80} className="sm">0</text><text x={W} y={80} textAnchor="end" className="sm">{PAGE} Б</text>
      </svg>
      <div className="controls">
        <Slider label="длина новой записи, Б" value={len} min={8} max={80} step={4} onChange={setLen} />
        <button className="btn primary" onClick={insert}>вставить</button>
        <button className="btn" onClick={compact} disabled={!deadBytes}>уплотнить</button>
        <button className="btn" onClick={() => { setRecs([]); setMsg(''); }}>очистить</button>
      </div>
      <div className="controls small">удалить: {recs.map((x, i) => x.live && <button key={i} className="btn small" onClick={() => del(i)}>#{i}</button>)}</div>
      <div className="stats"><Stat k="записей" v={recs.filter((x) => x.live).length} /><Stat k="свободно" v={free + ' Б'} /><Stat k="«мёртвых» байт" v={deadBytes} /></div>
      {msg && <p className="small">{msg}</p>}
      <p className="small muted">Массив слотов (слева) растёт к концу страницы, данные (справа) — к началу; страница заполнена, когда они встречаются. Индексы хранят адрес записи как (номер страницы, номер слота) — поэтому запись можно двигать внутри страницы, не трогая индексы.</p>
    </Widget>
  );
}

function RowVsColumn() {
  const [cols, setCols] = useState(20);
  const [used, setUsed] = useState(3);
  const [rows, setRows] = useState(100);
  const bytesPer = 8;
  const rowStore = rows * 1e6 * cols * bytesPer;
  const colStore = rows * 1e6 * used * bytesPer;
  const ratio = 4; // типичное сжатие однородных колонок (порядок величины)
  return (
    <Widget title="Строки или колонки: сколько байт прочитать для аналитического запроса">
      <div className="controls">
        <Slider label="столбцов в таблице" value={cols} min={2} max={200} onChange={setCols} />
        <Slider label="столбцов нужно запросу" value={used} min={1} max={cols} onChange={(v) => setUsed(Math.min(v, cols))} />
        <Slider label="строк, млн" value={rows} min={1} max={1000} onChange={setRows} />
      </div>
      <div className="stats">
        <Stat k="строчное хранение" v={(rowStore / 1e9).toFixed(1) + ' ГБ'} />
        <Stat k="колоночное" v={(colStore / 1e9).toFixed(1) + ' ГБ'} />
        <Stat k="колоночное + сжатие ×4" v={(colStore / ratio / 1e9).toFixed(1) + ' ГБ'} />
        <Stat k="выигрыш" v={'×' + fmt((rowStore / colStore) * ratio, 0)} />
      </div>
      <p className="small muted">Запрос вида <code>SELECT avg(price) FROM sales WHERE region = 'EU'</code> трогает {used} из {cols} столбцов. Строчному хранилищу приходится читать строки целиком. По 8 байт на значение; коэффициент сжатия 4 — ориентировочный (у однородных колонок с повторами он бывает гораздо больше).</p>
    </Widget>
  );
}

export default function Storage() {
  return (
    <>
      <h1>Диск, страницы и записи</h1>
      <p className="lead">СУБД начинается с вопроса: как разложить таблицу по байтам файла, чтобы быстро находить, добавлять и менять строки? Ответ — страницы.</p>

      <h2>Иерархия памяти</h2>
      <p>База данных живёт на постоянном носителе, потому что память энергозависима и мала. Но обращение к носителю — самое дорогое, что делает СУБД:</p>
      <Latency />
      <p>
        Два следствия. Во-первых, <b>ввод-вывод идёт блоками</b>: устройство всё равно читает минимум 512 байт – 4 КБ, поэтому считать надо не байты, а количество прочитанных блоков.
        Во-вторых, <b>последовательный доступ</b> гораздо дешевле случайного: у HDD не нужно двигать головку, у SSD — меньше накладных расходов на запрос. На этом построены журналы (глава 9) и LSM-деревья (глава 4).
      </p>

      <h2>Страницы</h2>
      <p>
        СУБД делит файлы на <b>страницы</b> фиксированного размера: 8 КБ в PostgreSQL, 16 КБ в InnoDB (MySQL), 4 КБ по умолчанию в SQLite. Страница — единица чтения, записи, кэширования и
        часто блокировки. Таблица — набор страниц (<b>heap file</b>, «куча»: строки лежат в порядке вставки). Чтобы найти страницу со свободным местом, СУБД хранит карту свободного пространства.
      </p>
      <p>Адрес строки — пара <M t={r`(\text{номер страницы}, \text{номер слота})`} />. В PostgreSQL он называется <code>ctid</code>, его можно увидеть: <code>SELECT ctid, * FROM t</code>.</p>
      <SlottedPage />

      <h2>Формат строки</h2>
      <p>Внутри записи — заголовок и значения столбцов:</p>
      <ul>
        <li><b>Заголовок</b>: длина, битовая карта NULL (по биту на столбец — сами NULL не хранятся), служебные поля транзакций (в PostgreSQL — <code>xmin</code>/<code>xmax</code>, глава 8).</li>
        <li><b>Поля фиксированной длины</b> (<code>INT</code>, <code>BIGINT</code>, <code>TIMESTAMP</code>) — подряд, часто с выравниванием по 4–8 байт для быстрого доступа процессора. Порядок столбцов в <code>CREATE TABLE</code> влияет на размер строки из-за выравнивания.</li>
        <li><b>Поля переменной длины</b> (<code>TEXT</code>, <code>VARCHAR</code>) — длина + байты. Слишком длинные значения выносятся в отдельное хранилище (в PostgreSQL — TOAST), а в строке остаётся ссылка.</li>
      </ul>
      <Code title="python — упаковка строки (id INT, age SMALLINT, name TEXT) в байты">{`
import struct

def pack_row(id_, age, name):
    null_bitmap = 0b000 | (1 << 1 if age is None else 0)    # бит 1 — age IS NULL
    name_b = name.encode("utf-8")
    # <  — little-endian; B — 1 байт битовой карты; i — 4 байта; h — 2 байта; H — длина строки
    return struct.pack(f"<BihH{len(name_b)}s", null_bitmap, id_, age or 0, len(name_b), name_b)

def unpack_row(b):
    bitmap, id_, age, n = struct.unpack_from("<BihH", b)
    name = b[struct.calcsize("<BihH"):][:n].decode("utf-8")
    return id_, (None if bitmap & 2 else age), name

row = pack_row(42, 31, "Алиса")
print(len(row), row.hex())        # 19 байт: 1 + 4 + 2 + 2 + 10 (кириллица — по 2 байта)
print(unpack_row(row))            # (42, 31, 'Алиса')
`}</Code>

      <h2>Строчное и колоночное хранение</h2>
      <p>
        Всё выше — <b>строчное</b> хранение (NSM, n-ary storage model): все столбцы строки лежат рядом. Оно идеально для OLTP: «прочитать или обновить заказ №123» — одна страница.
        Для аналитики (OLAP) запросы трогают несколько столбцов, но миллиарды строк. <b>Колоночное</b> хранение (DSM) кладёт каждый столбец отдельно: читаются только нужные столбцы, однородные данные
        отлично сжимаются (кодирование длин серий, словари, дельта-кодирование), а исполнитель обрабатывает столбцы векторами (глава 5). Так устроены C-Store/Vertica <Cite id="stonebraker2005cstore" />,
        ClickHouse, DuckDB, Parquet-файлы. Абади и др. <Cite id="abadi2008" /> разобрали, откуда берётся выигрыш: не только из чтения меньшего числа столбцов, но и из сжатия и позднего склеивания строк.
      </p>
      <RowVsColumn />
      <Callout type="note" title="PAX — гибрид">
        <p>Распространённый компромисс: строки группируются в блоки (например, по 100 тыс.), а внутри блока данные лежат по столбцам. Так устроены Parquet и ORC (row groups) — легко дописывать блоки и при этом читать только нужные столбцы.</p>
      </Callout>
      <Quiz q="Почему индекс хранит адрес (страница, слот), а не байтовое смещение строки в файле?" options={['Так короче', 'Строку можно перемещать внутри страницы (уплотнение, рост поля), меняя только запись в массиве слотов — индексы трогать не нужно', 'Слоты быстрее читаются', 'Это требование SQL']} answer={1}
        explain="Массив слотов — уровень косвенности. Это классический приём: «любая проблема решается ещё одним уровнем косвенности»." />
      <Quiz q="Для запроса «сумма продаж по регионам за год» по таблице из 80 столбцов лучше подходит..." options={['строчное хранение', 'колоночное хранение', 'без разницы', 'хеш-индекс']} answer={1}
        explain="Запрос трогает 2–3 столбца из 80 по всем строкам — колоночное хранилище прочитает в десятки раз меньше данных, да ещё и сжатых." />
    </>
  );
}
