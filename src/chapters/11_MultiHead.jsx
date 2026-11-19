import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmtBig } from '../components/ui.jsx';
import modelSrc from '../../python/model.py?raw';

export const extract = (src, start, end) => {
  const a = src.indexOf(start), b = end ? src.indexOf(end, a + 1) : src.length;
  return src.slice(a, b).trimEnd();
};

function ShapeWalk() {
  const [B, setB] = useState(4), [T, setT] = useState(8), [C, setC] = useState(64), [nhIdx, setNh] = useState(2);
  const divs = [1, 2, 4, 8, 16].filter((d) => C % d === 0);
  const nh = divs[Math.min(nhIdx, divs.length - 1)], hs = C / nh;
  const rows = [
    ['x', `(B, T, C)`, [B, T, C], 'вход блока внимания'],
    ['qkv = x @ W_attn', '(B, T, 3C)', [B, T, 3 * C], `матрица W_attn: (C, 3C) = ${C}×${3 * C}`],
    ['q, k, v = split(qkv)', '3 × (B, T, C)', [B, T, C], 'разрезаем последнюю ось на три части'],
    ['q.view(B, T, nh, hs)', '(B, T, nh, hs)', [B, T, nh, hs], 'та же память, C = nh × hs'],
    ['.transpose(1, 2)', '(B, nh, T, hs)', [B, nh, T, hs], 'головы — как ещё одно «батч»-измерение'],
    ['att = q @ kᵀ / √hs', '(B, nh, T, T)', [B, nh, T, T], `(T, hs)@(hs, T) для каждой из B·nh пар`],
    ['softmax(mask(att))', '(B, nh, T, T)', [B, nh, T, T], 'строки — распределения'],
    ['y = att @ v', '(B, nh, T, hs)', [B, nh, T, hs], '(T, T)@(T, hs)'],
    ['y.transpose(1, 2).view(B, T, C)', '(B, T, C)', [B, T, C], 'склеиваем головы: concat'],
    ['y @ W_proj', '(B, T, C)', [B, T, C], `W_proj: (C, C) — смешивание голов`],
  ];
  const flops = 2 * B * T * C * 3 * C + 2 * B * nh * T * T * hs * 2 + 2 * B * T * C * C;
  return (
    <Widget title="Путешествие тензора через многоголовое внимание">
      <div className="controls">
        <Slider label="B (батч)" value={B} min={1} max={64} onChange={setB} />
        <Slider label="T (длина)" value={T} min={1} max={1024} onChange={setT} />
        <Slider label="C (ширина)" value={C} min={16} max={1024} step={16} onChange={setC} />
        <Slider label="n_head" value={nhIdx} min={0} max={divs.length - 1} onChange={setNh} format={() => nh} />
      </div>
      <table>
        <thead><tr><th>Операция</th><th>Форма</th><th>Конкретно</th><th>Элементов</th><th>Комментарий</th></tr></thead>
        <tbody>
          {rows.map(([op, f, s, c], i) => (
            <tr key={i}><td className="mono">{op}</td><td className="mono">{f}</td><td className="mono">({s.join(', ')})</td><td>{fmtBig(s.reduce((a, b) => a * b, 1))}</td><td className="small">{c}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="small">hs = C / n_head = {hs}. Параметров: <b>{fmtBig(4 * C * C + 4 * C)}</b> (= 4C² + 4C, не зависит от числа голов!). FLOP прямого прохода ≈ <b>{fmtBig(flops)}</b>; из них на матрицы T×T приходится {Math.round((100 * 4 * B * nh * T * T * hs) / flops)}% — растёт с T квадратично.</p>
    </Widget>
  );
}

export default function MultiHead() {
  return (
    <>
      <h1>Многоголовое внимание и тензоры</h1>
      <p className="lead">Одна голова внимания умеет искать что-то одно. Несколько голов параллельно ищут разные связи: синтаксические, смысловые, позиционные. Разберём, как это устроено и как не запутаться в осях тензоров.</p>

      <h2>Зачем несколько голов</h2>
      <p>
        В одной голове каждый токен получает <i>одно</i> распределение внимания. Но токену «он» нужно одновременно найти подлежащее (кого он обозначает), предыдущий глагол (что было сделано) и
        просто соседние токены. Васвани и др. <Cite id="vaswani2017" /> предложили запускать <M t="h" /> голов параллельно, каждую в своём подпространстве размерности <M t={r`d_h = C/h`} />:
      </p>
      <Eq t={r`\mathrm{head}_i = \mathrm{Attention}(XW_Q^{(i)}, XW_K^{(i)}, XW_V^{(i)}),\qquad W_{Q,K,V}^{(i)}\in\mathbb R^{C\times d_h}`} />
      <Eq t={r`\mathrm{MultiHead}(X) = \mathrm{Concat}(\mathrm{head}_1,\dots,\mathrm{head}_h)\,W_O,\qquad W_O\in\mathbb R^{C\times C}`} />
      <p>
        Поскольку <M t={r`h\cdot d_h = C`} />, стоимость и число параметров — те же, что у одной «широкой» головы. Матрица <M t={r`W_O`} /> смешивает результаты голов и возвращает их в остаточный поток.
        Исследования интерпретируемости находят в обученных моделях головы с понятными функциями: «предыдущий токен», «найди совпадение с текущим токеном раньше и скопируй следующий за ним»
        (<b>индукционные головы</b>, которые лежат в основе обучения в контексте — in-context learning <Cite id="olsson2022" />).
      </p>

      <h2>Трюк с формами: все головы одним умножением</h2>
      <p>
        Вместо <M t="3h" /> маленьких матриц используют одну <M t={r`W_{attn}\in\mathbb R^{C\times 3C}`} /> и потом «режут» результат. Ось <M t="C" /> разбивается на <code>(nh, hs)</code> с помощью
        <code>view</code> (без копирования данных), затем ось голов переставляется ближе к батчу (<code>transpose(1, 2)</code>). Теперь <code>@</code> делает <M t={r`B\cdot n_h`} /> независимых
        умножений <M t={r`(T, d_h) @ (d_h, T)`} /> за один вызов — идеально для GPU.
      </p>
      <ShapeWalk />
      <Callout type="danger" title="view vs reshape vs contiguous">
        <p><code>view</code> меняет форму, не копируя данные, и работает только если тензор лежит в памяти «подряд». После <code>transpose</code> это не так, поэтому перед обратным <code>view</code> нужен
          <code>.contiguous()</code> (копирует данные в новом порядке). <code>reshape</code> делает это сам, когда нужно. Перепутать порядок осей в <code>view</code> — самая коварная ошибка: код работает,
          формы совпадают, но головы получают перемешанные данные, и модель учится хуже без всякой ошибки.</p>
      </Callout>

      <h2>Код из model.py</h2>
      <Code title="python/model.py — CausalSelfAttention">{extract(modelSrc, 'class CausalSelfAttention', 'class MLP')}</Code>
      <p>
        Ветка <code>if self.flash</code> вызывает встроенную <code>F.scaled_dot_product_attention(..., is_causal=True)</code> — она математически идентична ветке <code>else</code>, но использует
        FlashAttention-подобные ядра <Cite id="dao2022" />: не хранит матрицу <M t={r`T\times T`} /> в памяти GPU и считает в несколько раз быстрее. Попробуйте самостоятельно проверить равенство обеих
        веток на случайном входе (<code>torch.allclose</code>).
      </p>

      <h2>Варианты: MQA и GQA</h2>
      <p>
        При генерации ключи и значения всех прошлых токенов хранятся в KV-кэше (глава 15), и его размер <M t={r`2\cdot L\cdot T\cdot C`} /> становится узким местом. <b>Multi-Query Attention</b> <Cite id="shazeer2019" />
        использует одну пару <M t="K, V" /> на все головы запросов; <b>Grouped-Query Attention</b> <Cite id="ainslie2023" /> — по одной паре на группу голов. Кэш уменьшается в несколько раз почти без потери качества; GQA используется в большинстве современных открытых моделей.
      </p>
      <Quiz q="C = 768, n_head = 12. Какой размер одной головы и сколько параметров в W_attn (без bias)?" options={['64; 768·2304 ≈ 1.77M', '12; 768·768', '768; 12·768', '64; 64·64']} answer={0}
        explain="hs = 768/12 = 64. W_attn отображает C → 3C: 768 × 2304 = 1 769 472 параметра." />
      <Quiz q="Как изменится число параметров внимания, если при том же C увеличить число голов с 4 до 16?" options={['Увеличится в 4 раза', 'Уменьшится в 4 раза', 'Не изменится', 'Увеличится в 16 раз']} answer={2}
        explain="Головы делят ширину C между собой: матрицы те же C×3C и C×C, меняется только то, как ось C разрезается." />
    </>
  );
}
