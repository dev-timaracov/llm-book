import Intro from './chapters/00_Intro.jsx';
import Storage from './chapters/01_Storage.jsx';
import Buffer from './chapters/02_Buffer.jsx';
import BTree from './chapters/03_BTree.jsx';
import LSM from './chapters/04_LSM.jsx';
import Execution from './chapters/05_Execution.jsx';
import Optimizer from './chapters/06_Optimizer.jsx';
import Transactions from './chapters/07_Transactions.jsx';
import Concurrency from './chapters/08_Concurrency.jsx';
import Recovery from './chapters/09_Recovery.jsx';
import Distributed from './chapters/10_Distributed.jsx';
import Types from './chapters/11_Types.jsx';
import Practicum from './chapters/12_Practicum.jsx';
import References from './chapters/13_References.jsx';
import { REFS } from './lib/refs.js';

const P0 = 'Введение';
const P1 = 'Часть I. Хранение';
const P2 = 'Часть II. Индексы';
const P3 = 'Часть III. Запросы';
const P4 = 'Часть IV. Транзакции';
const P5 = 'Часть V. Масштаб и виды';

/** Описание учебника для платформы (формат — см. books/README.md). */
export default {
  id: 'db',
  title: 'Базы данных изнутри',
  subtitle: 'Как устроены СУБД и какими они бывают',
  description:
    'Страницы и буферный пул, B+-деревья и LSM, исполнитель и оптимизатор запросов, транзакции, MVCC, журнал и восстановление, репликация и консенсус — и обзор видов баз данных: от реляционных до векторных. С симуляторами и рабочим кодом на Python.',
  icon: '🗄️',
  level: 'с нуля до устройства движка',
  tags: ['СУБД', 'SQL', 'индексы', 'транзакции', 'распределённые системы'],
  refs: REFS,
  chapters: [
    { id: 'intro', num: 0, part: P0, title: 'Карта пути', component: Intro },
    { id: 'storage', num: 1, part: P1, title: 'Диск, страницы и записи', component: Storage },
    { id: 'buffer', num: 2, part: P1, title: 'Буферный пул', component: Buffer },
    { id: 'btree', num: 3, part: P2, title: 'B+-деревья и хеш-индексы', component: BTree },
    { id: 'lsm', num: 4, part: P2, title: 'LSM-деревья и Bloom-фильтры', component: LSM },
    { id: 'execution', num: 5, part: P3, title: 'Выполнение запросов', component: Execution },
    { id: 'optimizer', num: 6, part: P3, title: 'Оптимизатор запросов', component: Optimizer },
    { id: 'transactions', num: 7, part: P4, title: 'Транзакции и изоляция', component: Transactions },
    { id: 'concurrency', num: 8, part: P4, title: 'Блокировки и MVCC', component: Concurrency },
    { id: 'recovery', num: 9, part: P4, title: 'Журнал и восстановление', component: Recovery },
    { id: 'distributed', num: 10, part: P5, title: 'Распределённые базы данных', component: Distributed },
    { id: 'types', num: 11, part: P5, title: 'Виды баз данных', component: Types },
    { id: 'practicum', num: 12, part: P5, title: 'Практикум', component: Practicum },
    { id: 'references', num: 13, part: P5, title: 'Библиография', component: References },
  ],
};
