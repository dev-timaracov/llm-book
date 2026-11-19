import React from 'react';
import { REFS } from '../lib/refs.js';
import { Callout } from '@shared/ui.jsx';

export default function References() {
  return (
    <>
      <h1>Библиография</h1>
      <p className="lead">Номера совпадают с номерами ссылок в тексте.</p>
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
