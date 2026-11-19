import Intro from './00_Intro.jsx';
import LinAlg from './01_LinAlg.jsx';
import Calculus from './02_Calculus.jsx';
import Probability from './03_Probability.jsx';
import Neuron from './04_Neuron.jsx';
import Backprop from './05_Backprop.jsx';
import Optim from './06_Optim.jsx';
import LangModel from './07_LangModel.jsx';
import Tokenization from './08_Tokenization.jsx';
import Embeddings from './09_Embeddings.jsx';
import Attention from './10_Attention.jsx';
import MultiHead from './11_MultiHead.jsx';
import Block from './12_Block.jsx';
import GPTChapter from './13_GPT.jsx';
import Training from './14_Training.jsx';
import Generation from './15_Generation.jsx';
import Lab from './16_Lab.jsx';
import Practicum from './17_Practicum.jsx';
import Beyond from './18_Beyond.jsx';
import References from './19_References.jsx';

const P1 = 'Часть I. Математический фундамент';
const P2 = 'Часть II. Нейронные сети';
const P3 = 'Часть III. Язык как данные';
const P4 = 'Часть IV. Трансформер';
const P5 = 'Часть V. Обучение и генерация';
const P6 = 'Часть VI. Дальше';

export const CHAPTERS = [
  { id: 'intro', num: 0, part: P1, title: 'Карта пути', component: Intro },
  { id: 'linalg', num: 1, part: P1, title: 'Векторы и матрицы', component: LinAlg },
  { id: 'calculus', num: 2, part: P1, title: 'Производные и градиенты', component: Calculus },
  { id: 'probability', num: 3, part: P1, title: 'Вероятность, softmax, энтропия', component: Probability },
  { id: 'neuron', num: 4, part: P2, title: 'Нейрон и многослойная сеть', component: Neuron },
  { id: 'backprop', num: 5, part: P2, title: 'Обратное распространение и autograd', component: Backprop },
  { id: 'optim', num: 6, part: P2, title: 'Оптимизация: от SGD до AdamW', component: Optim },
  { id: 'langmodel', num: 7, part: P3, title: 'Языковая модель: биграммы и MLP', component: LangModel },
  { id: 'tokenization', num: 8, part: P3, title: 'Токенизация и BPE', component: Tokenization },
  { id: 'embeddings', num: 9, part: P3, title: 'Эмбеддинги и позиции', component: Embeddings },
  { id: 'attention', num: 10, part: P4, title: 'Механизм внимания', component: Attention },
  { id: 'multihead', num: 11, part: P4, title: 'Многоголовое внимание и тензоры', component: MultiHead },
  { id: 'block', num: 12, part: P4, title: 'Блок трансформера', component: Block },
  { id: 'gpt', num: 13, part: P4, title: 'GPT целиком', component: GPTChapter },
  { id: 'training', num: 14, part: P5, title: 'Обучение', component: Training },
  { id: 'generation', num: 15, part: P5, title: 'Генерация текста', component: Generation },
  { id: 'lab', num: 16, part: P5, title: 'Лаборатория: GPT в браузере', component: Lab },
  { id: 'practicum', num: 17, part: P5, title: 'Практикум: обучаем свою GPT', component: Practicum },
  { id: 'beyond', num: 18, part: P6, title: 'Масштаб, современные LLM, RLHF', component: Beyond },
  { id: 'references', num: 19, part: P6, title: 'Библиография', component: References },
];
