import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmt, Stat } from '@shared/ui.jsx';
import { makeRng } from '@shared/rng.js';
import sampleSrc from '../python/sample.py?raw';

// «Логиты» модели после текста «Кот сидел на ...»
const CANDIDATES = [
  ['␣окне', 3.1], ['␣диване', 2.8], ['␣крыше', 2.4], ['␣стуле', 2.2], ['␣ковре', 2.0], ['␣подоконнике', 1.6], ['␣заборе', 1.3], ['␣месте', 1.0],
  ['␣солнце', 0.6], ['␣коленях', 0.5], ['␣дереве', 0.3], ['␣луне', -0.8], ['␣бананах', -1.6], ['␣интеграле', -2.5], ['.', -1.0], ['␣асфальте', 0.1],
];

function SamplerWidget() {
  const [T, setT] = useState(1);
  const [k, setK] = useState(16);
  const [p, setP] = useState(1);
  const [seed, setSeed] = useState(1);
  const z = CANDIDATES.map((c) => c[1] / Math.max(T, 1e-3));
  const m = Math.max(...z);
  let probs = z.map((v) => Math.exp(v - m));
  let s = probs.reduce((a, b) => a + b, 0);
  probs = probs.map((v) => v / s);
  const order = probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const keep = new Set();
  let cum = 0;
  for (let j = 0; j < order.length; j++) {
    if (j >= k) break;
    keep.add(order[j][1]);
    cum += order[j][0];
    if (cum >= p) break;
  }
  const kept = probs.map((v, i) => (keep.has(i) ? v : 0));
  const ks = kept.reduce((a, b) => a + b, 0);
  const final = kept.map((v) => v / ks);
  const H = -final.reduce((a, q) => a + (q > 0 ? q * Math.log(q) : 0), 0);
  const rng = makeRng(seed);
  const draws = Array.from({ length: 12 }, () => CANDIDATES[rng.choice(final)][0]);
  return (
    <Widget title="Стратегии сэмплинга: «Кот сидел на …»">
      <div className="controls">
        <Slider label="temperature" value={T} min={0.05} max={3} step={0.05} onChange={setT} />
        <Slider label="top-k" value={k} min={1} max={16} onChange={setK} />
        <Slider label="top-p" value={p} min={0.05} max={1} step={0.01} onChange={setP} />
      </div>
      <div className="row">
        <div className="col">
          {order.map(([, i]) => (
            <div key={i} className="bar-row">
              <span className="lbl" style={{ width: 110 }}>{CANDIDATES[i][0]}</span>
              <span className="track"><span className={'fill' + (keep.has(i) ? '' : ' off')} style={{ width: `${100 * (keep.has(i) ? final[i] : probs[i])}%`, display: 'block' }} /></span>
              <span className="val">{keep.has(i) ? fmt(final[i], 3) : '—'}</span>
            </div>
          ))}
        </div>
        <div className="col">
          <div className="stats"><Stat k="осталось кандидатов" v={keep.size} /><Stat k="энтропия, нат" v={fmt(H, 2)} /></div>
          <p className="small">12 случайных продолжений <button className="btn small" onClick={() => setSeed(seed + 1)}>ещё</button></p>
          <div className="sample-out" style={{ minHeight: 0 }}>{draws.map((d) => 'Кот сидел на' + d.replace('␣', ' ')).join('\n')}</div>
        </div>
      </div>
      <p className="small muted">Серые полосы — отсечённые токены. Temperature → 0 даёт жадный выбор («окне» всегда). Высокая температура без отсечения иногда выдаёт «интеграле» — хвост распределения редок, но длинен, и за 500 токенов генерации такие ошибки накапливаются. top-k и top-p отрезают хвост.</p>
    </Widget>
  );
}

export default function Generation() {
  return (
    <>
      <h1>Генерация текста</h1>
      <p className="lead">Модель выдаёт распределение следующего токена. Как из него получить текст — отдельная задача, и от её решения сильно зависит, будет ли текст скучным, живым или бессвязным.</p>

      <h2>Авторегрессионный цикл</h2>
      <Code title="псевдокод">{`
tokens = encode(prompt)
for step in range(max_new_tokens):
    logits = model(tokens[-block_size:])     # (T, V) — но нужна только последняя строка
    probs = softmax(logits[-1] / temperature)
    next_token = sample(probs)               # выбрать токен согласно стратегии
    tokens.append(next_token)
return decode(tokens)
`}</Code>
      <p>Модель никогда не «пишет текст целиком» — каждый токен выбирается по одному, и выбор становится частью контекста для следующего шага. Поэтому раз выбранная ошибка не исправляется: модель продолжит её «обосновывать».</p>

      <h2>Стратегии</h2>
      <ul>
        <li><b>Жадный выбор</b> (<M t={r`\arg\max`} />): детерминирован, но склонен к зацикливанию и скучным повторам.</li>
        <li><b>Лучевой поиск</b> (beam search): хорош для перевода, где ответ почти однозначен, но для свободного текста даёт вырожденный, повторяющийся текст <Cite id="holtzman2019" />.</li>
        <li><b>Сэмплинг</b> из <M t={r`\mathrm{softmax}(\mathbf z/T)`} />: <b>температура</b> <M t="T" /> управляет «смелостью» (глава 3). <M t="T<1" /> — увереннее, <M t="T>1" /> — разнообразнее.</li>
        <li><b>Top-k</b> <Cite id="fan2018" />: оставить <M t="k" /> самых вероятных токенов, перенормировать.</li>
        <li><b>Top-p (nucleus)</b> <Cite id="holtzman2019" />: оставить минимальное множество самых вероятных токенов с суммарной вероятностью <M t={r`\ge p`} />. В отличие от top-k, размер множества адаптивен: при уверенной модели — 1–2 токена, при неуверенной — десятки.</li>
      </ul>
      <Eq t={r`V^{(p)} = \min\Big\{S\subseteq V: \sum_{x\in S}q(x)\ge p\Big\},\qquad q'(x) = \frac{q(x)\,[x\in V^{(p)}]}{\sum_{x'\in V^{(p)}}q(x')}`} />
      <SamplerWidget />
      <Callout type="note" title="Почему «наиболее вероятный текст» — плохой текст">
        <p>Холцман и др. <Cite id="holtzman2019" /> показали: человеческий текст не максимизирует вероятность — люди регулярно выбирают не самое ожидаемое слово. Распределение вероятностей человеческого текста под моделью «шумит», тогда как жадный/лучевой поиск даёт неестественно гладкую, высоковероятную и повторяющуюся речь. Сэмплинг с отсечением хвоста — компромисс: случайность как у человека, но без редких абсурдных токенов.</p>
      </Callout>

      <h2>KV-кэш</h2>
      <p>
        Наивный цикл на каждом шаге заново прогоняет весь контекст: генерация <M t="n" /> токенов стоит <M t={r`O(n^2)`} /> прогонов токенов через сеть. Но заметьте: из-за каузальной маски вектора ключей и значений
        прошлых позиций <b>не меняются</b>, когда добавляется новый токен. Их можно сохранить в кэше и на каждом шаге считать Q, K, V только для одного нового токена:
      </p>
      <Eq t={r`\mathbf o_{t} = \mathrm{softmax}\Big(\frac{\mathbf q_t\,[K_{\text{кэш}};\mathbf k_t]^\top}{\sqrt{d}}\Big)[V_{\text{кэш}};\mathbf v_t]`} />
      <p>
        Каждый шаг теперь стоит <M t={r`O(T\cdot C)`} /> на внимание вместо <M t={r`O(T\cdot C^2 + T^2 C)`} /> на всё. Цена — память: <M t={r`2\cdot L\cdot T\cdot C`} /> чисел на последовательность (калькулятор в главе 13). При обслуживании
        многих пользователей KV-кэш становится главным потребителем памяти GPU — отсюда MQA/GQA (глава 11) и PagedAttention в vLLM <Cite id="kwon2023" />. Подробный анализ компромиссов инференса — у Поупа и др. <Cite id="pope2022" />.
      </p>
      <Code title="python — внимание с KV-кэшем (упражнение: встройте в model.py)">{`
def attn_with_cache(self, x, cache=None):
    # x: (B, 1, C) — только новый токен; cache: (k, v) прошлых шагов формы (B, nh, T_past, hs)
    B, T, C = x.shape
    q, k, v = self.c_attn(x).split(self.n_embd, dim=2)
    q, k, v = [t.view(B, T, self.n_head, C // self.n_head).transpose(1, 2) for t in (q, k, v)]
    if cache is not None:
        k = torch.cat([cache[0], k], dim=2)     # дописываем новый ключ к прошлым
        v = torch.cat([cache[1], v], dim=2)
    # маска не нужна: новый токен и так последний, ему можно видеть всех
    y = F.scaled_dot_product_attention(q, k, v, is_causal=(cache is None))
    y = y.transpose(1, 2).contiguous().view(B, T, C)
    return self.c_proj(y), (k, v)
# Внимание: с обучаемыми позициями нужно передавать позицию нового токена (T_past) в wpe.
`}</Code>

      <h2>sample.py</h2>
      <Code title="books/gpt/python/sample.py">{sampleSrc}</Code>
      <p>Сама логика top-k/top-p — в методе <code>GPT.generate</code> (глава 13). Типичные хорошие настройки для небольшой модели: <code>--temperature 0.8 --top_k 40</code> или <code>--temperature 0.9 --top_p 0.9</code>.</p>
      <Quiz q="Модель очень уверена: P(«окне») = 0.97. Сколько токенов оставит top-p с p = 0.9?" options={['1', '9', 'зависит от k', 'все']} answer={0}
        explain="Первый же токен даёт сумму 0.97 ≥ 0.9 — множество ядра состоит из одного токена. Это и есть адаптивность top-p." />
      <Quiz q="Почему KV-кэш корректен для GPT, но не для BERT-подобного энкодера без маски?" options={['В BERT нет ключей', 'В каузальной модели прошлые K и V не зависят от будущих токенов; без маски добавление токена меняет представления всех позиций', 'BERT слишком большой', 'Корректен для обоих']} answer={1}
        explain="Каузальность гарантирует, что представление позиции t зависит только от x≤t, поэтому его можно вычислить один раз и переиспользовать." />
    </>
  );
}
