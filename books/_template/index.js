// Шаблон учебника. Скопируйте папку books/_template в books/<id> и заполните поля.
import Intro from './chapters/01_Intro.jsx';
import References from './chapters/99_References.jsx';
import { REFS } from './lib/refs.js';

const P1 = 'Часть I. Основы';

export default {
  id: 'template',                 // латиница, используется в адресе: #/template/intro
  title: 'Название учебника',
  subtitle: 'Короткий подзаголовок',
  description: 'Пара предложений: о чём учебник и что читатель сможет после него.',
  icon: '📘',
  level: 'с нуля',
  tags: ['тема'],
  refs: REFS,                     // библиография для <Cite id="..." />
  chapters: [
    { id: 'intro', num: 1, part: P1, title: 'Введение', component: Intro },
    { id: 'references', num: 2, part: P1, title: 'Библиография', component: References },
  ],
};
