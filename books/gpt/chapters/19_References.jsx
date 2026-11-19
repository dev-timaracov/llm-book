import React from 'react';
import { REFS } from '../lib/refs.js';
import { Callout } from '@shared/ui.jsx';

export default function References() {
  return (
    <>
      <h1>Библиография</h1>
      <p className="lead">Все работы, на которые ссылается учебник, — первоисточники. Номера совпадают с номерами в тексте.</p>
      <Callout type="tip" title="Как читать статьи">
        <p>Начните с аннотации и рисунков, затем раздел с методом, и только потом эксперименты. Для учебника важнее всего: [Vaswani 2017] — разделы 3.1–3.5; [Radford 2019] — раздел 2; [Brown 2020] — раздел 2; [Kaplan 2020] — раздел 1.1 (сводка результатов); [Hoffmann 2022] — раздел 3.</p>
      </Callout>
      <ol className="refs">
        {REFS.map((r) => (
          <li key={r.id} id={'ref-' + r.id}>
            {r.authors} ({r.year}). <span className="rt">{r.title}</span>. <i>{r.venue}</i>.{' '}
            <a href={r.url} target="_blank" rel="noreferrer">{r.url.replace(/^https?:\/\//, '').slice(0, 60)}</a>
          </li>
        ))}
      </ol>
    </>
  );
}
