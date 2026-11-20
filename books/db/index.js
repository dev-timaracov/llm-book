import Intro from './chapters/00_Intro.jsx';
import SQL from './chapters/01_SQL.jsx';
import Normalization from './chapters/02_Normalization.jsx';
import Storage from './chapters/03_Storage.jsx';
import Buffer from './chapters/04_Buffer.jsx';
import Compression from './chapters/05_Compression.jsx';
import BTree from './chapters/06_BTree.jsx';
import LSM from './chapters/07_LSM.jsx';
import Execution from './chapters/08_Execution.jsx';
import ExternalSort from './chapters/09_ExternalSort.jsx';
import Optimizer from './chapters/10_Optimizer.jsx';
import Transactions from './chapters/11_Transactions.jsx';
import Concurrency from './chapters/12_Concurrency.jsx';
import Recovery from './chapters/13_Recovery.jsx';
import Distributed from './chapters/14_Distributed.jsx';
import Cloud from './chapters/15_Cloud.jsx';
import Types from './chapters/16_Types.jsx';
import Columnar from './chapters/17_Columnar.jsx';
import KVDocument from './chapters/18_KVDocument.jsx';
import Graph from './chapters/19_Graph.jsx';
import Vector from './chapters/20_Vector.jsx';
import OLAPDWH from './chapters/21_OLAP_DWH.jsx';
import BigData from './chapters/22_BigData.jsx';
import Practicum from './chapters/23_Practicum.jsx';
import References from './chapters/24_References.jsx';
import { REFS } from './lib/refs.js';

const P0 = 'Введение';
const P1 = 'Часть I. Модель данных';
const P2 = 'Часть II. Хранение';
const P3 = 'Часть III. Индексы';
const P4 = 'Часть IV. Запросы';
const P5 = 'Часть V. Транзакции';
const P6 = 'Часть VI. Распределённость и облако';
const P7 = 'Часть VII. Виды баз данных';
const P8 = 'Часть VIII. Аналитика и большие данные';

/** Описание учебника для платформы (формат — см. books/README.md). */
export default {
  id: 'db',
  title: 'Базы данных изнутри',
  subtitle: 'Как устроены СУБД и какими они бывают',
  description:
    'SQL и реляционная алгебра, нормализация, страницы и буферный пул, сжатие колонок, B+-деревья и LSM, исполнитель, сортировка и оптимизатор, транзакции, MVCC, восстановление, распределённые и облачные СУБД; колоночные, key-value, документные, графовые и векторные базы; OLAP, хранилища данных, Data Lake, Spark и потоки. С симуляторами и рабочим кодом на Python.',
  icon: '🗄️',
  level: 'с нуля до устройства движка',
  tags: ['СУБД', 'SQL', 'индексы', 'транзакции', 'NoSQL', 'OLAP', 'big data'],
  refs: REFS,
  chapters: [
    { id: 'intro', num: 0, part: P0, title: 'Карта пути', component: Intro },
    { id: 'sql', num: 1, part: P1, title: 'SQL и реляционная алгебра', component: SQL },
    { id: 'normalization', num: 2, part: P1, title: 'Нормализация и проектирование схем', component: Normalization },
    { id: 'storage', num: 3, part: P2, title: 'Диск, страницы и записи', component: Storage },
    { id: 'buffer', num: 4, part: P2, title: 'Буферный пул', component: Buffer },
    { id: 'compression', num: 5, part: P2, title: 'Сжатие колонок', component: Compression },
    { id: 'btree', num: 6, part: P3, title: 'B+-деревья и хеш-индексы', component: BTree },
    { id: 'lsm', num: 7, part: P3, title: 'LSM-деревья и Bloom-фильтры', component: LSM },
    { id: 'execution', num: 8, part: P4, title: 'Выполнение запросов', component: Execution },
    { id: 'extsort', num: 9, part: P4, title: 'Внешняя сортировка', component: ExternalSort },
    { id: 'optimizer', num: 10, part: P4, title: 'Оптимизатор запросов', component: Optimizer },
    { id: 'transactions', num: 11, part: P5, title: 'Транзакции и изоляция', component: Transactions },
    { id: 'concurrency', num: 12, part: P5, title: 'Блокировки и MVCC', component: Concurrency },
    { id: 'recovery', num: 13, part: P5, title: 'Журнал и восстановление', component: Recovery },
    { id: 'distributed', num: 14, part: P6, title: 'Распределённые базы данных', component: Distributed },
    { id: 'cloud', num: 15, part: P6, title: 'Облачные СУБД', component: Cloud },
    { id: 'types', num: 16, part: P7, title: 'Виды баз данных: обзор', component: Types },
    { id: 'columnar', num: 17, part: P7, title: 'Колоночные СУБД', component: Columnar },
    { id: 'kvdoc', num: 18, part: P7, title: 'Key-value и документные', component: KVDocument },
    { id: 'graph', num: 19, part: P7, title: 'Графовые', component: Graph },
    { id: 'vector', num: 20, part: P7, title: 'Векторные', component: Vector },
    { id: 'olap', num: 21, part: P8, title: 'OLTP, OLAP и хранилища данных', component: OLAPDWH },
    { id: 'bigdata', num: 22, part: P8, title: 'Data Lake, MapReduce, Spark, потоки', component: BigData },
    { id: 'practicum', num: 23, part: P8, title: 'Практикум', component: Practicum },
    { id: 'references', num: 24, part: P8, title: 'Библиография', component: References },
  ],
};
