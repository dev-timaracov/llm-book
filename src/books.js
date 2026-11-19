// Реестр учебников. Чтобы добавить новый учебник:
//   1. скопируйте books/_template в books/<id>
//   2. заполните books/<id>/index.js и напишите главы
//   3. добавьте импорт и строку в массив BOOKS ниже
// Подробности — books/README.md.
import gpt from '../books/gpt/index.js';
import db from '../books/db/index.js';

export const BOOKS = [gpt, db];

export const findBook = (id) => BOOKS.find((b) => b.id === id);
