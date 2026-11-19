import React from 'react';
import { REFS } from '../lib/refs.js';
import { Callout } from '@shared/ui.jsx';

export default function References() {
  return (
    <>
      <h1>Библиография</h1>
      <p className="lead">Все работы, на которые ссылается учебник, — первоисточники: статьи, на которых построены современные СУБД. Номера совпадают с номерами в тексте.</p>
      <Callout type="tip" title="Как читать статьи">
        <p>С чего начать: Codd 1970 — основа реляционной модели; Hellerstein и др. 2007 — обзор архитектуры; Mohan и др. 1992 (ARIES) — восстановление; Berenson и др. 1995 — уровни изоляции; O'Neil и др. 1996 — LSM-деревья; DeCandia и др. 2007 (Dynamo) и Corbett и др. 2012 (Spanner) — распределённые системы.</p>
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
