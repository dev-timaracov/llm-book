import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt } from '@shared/ui.jsx';
import { LineChart } from '@shared/charts.jsx';

// Пример интерактивного виджета: всё считается прямо в браузере.
function Demo() {
  const [a, setA] = useState(1);
  const data = Array.from({ length: 101 }, (_, i) => { const x = -2 + i * 0.04; return [x, a * x * x]; });
  return (
    <Widget title="Пример виджета">
      <Slider label="a" value={a} min={-2} max={2} step={0.1} onChange={setA} />
      <LineChart series={[{ data, label: 'a·x²' }]} height={220} />
      <p className="small muted">f(1) = {fmt(a, 2)}</p>
    </Widget>
  );
}

export default function Intro() {
  return (
    <>
      <h1>Введение</h1>
      <p className="lead">Первый абзац главы — о чём она.</p>
      <h2>Раздел</h2>
      <p>Формула в строке <M t={r`e^{i\pi} + 1 = 0`} /> и ссылка на статью <Cite id="vaswani2017" />.</p>
      <Eq t={r`\int_0^1 x^2\,dx = \frac13`} label="выключная формула с подписью" />
      <Demo />
      <Callout type="tip"><p>Блоки: note, tip, warn, history, danger, math.</p></Callout>
      <Code title="python">{`print("hello")`}</Code>
      <Quiz q="Сколько будет 2 + 2?" options={['3', '4']} answer={1} explain="Арифметика." />
    </>
  );
}
