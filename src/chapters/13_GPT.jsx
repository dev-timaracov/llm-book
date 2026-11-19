import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmtBig } from '../components/ui.jsx';
import modelSrc from '../../python/model.py?raw';

const PRESETS = {
  'Наш Шекспир': { L: 6, H: 6, C: 384, T: 256, V: 65 },
  'GPT-1': { L: 12, H: 12, C: 768, T: 512, V: 40478 },
  'GPT-2 small': { L: 12, H: 12, C: 768, T: 1024, V: 50257 },
  'GPT-2 medium': { L: 24, H: 16, C: 1024, T: 1024, V: 50257 },
  'GPT-2 large': { L: 36, H: 20, C: 1280, T: 1024, V: 50257 },
  'GPT-2 XL': { L: 48, H: 25, C: 1600, T: 1024, V: 50257 },
  'GPT-3 175B': { L: 96, H: 96, C: 12288, T: 2048, V: 50257 },
};

function ParamCalc() {
  const [p, setP] = useState(PRESETS['GPT-2 small']);
  const set = (k) => (v) => setP({ ...p, [k]: v });
  const { L, C, T, V } = p;
  const emb = V * C, pos = T * C;
  const attn = L * (C * 3 * C + 3 * C + C * C + C);
  const mlp = L * (C * 4 * C + 4 * C + 4 * C * C + C);
  const ln = L * 4 * C + 2 * C;
  const total = emb + pos + attn + mlp + ln;
  const nonEmb = attn + mlp + ln;
  const flopsTok = 6 * nonEmb + 6 * L * T * C; // Kaplan et al., 2020, табл. 1 (×3 для fwd+bwd)
  const rows = [['Токенные эмбеддинги V·C (= lm_head, связаны)', emb], ['Позиционные эмбеддинги T·C', pos], ['Внимание L·(4C² + 4C)', attn], ['MLP L·(8C² + 5C)', mlp], ['LayerNorm L·4C + 2C', ln]];
  return (
    <Widget title="Калькулятор параметров, памяти и вычислений GPT">
      <div className="controls">{Object.keys(PRESETS).map((k) => <button key={k} className="btn small" onClick={() => setP(PRESETS[k])}>{k}</button>)}</div>
      <div className="controls">
        <Slider label="n_layer (L)" value={L} min={1} max={96} onChange={set('L')} />
        <Slider label="n_embd (C)" value={C} min={64} max={12288} step={64} onChange={set('C')} />
        <Slider label="block_size (T)" value={T} min={32} max={8192} step={32} onChange={set('T')} />
        <Slider label="vocab_size (V)" value={V} min={65} max={200000} onChange={set('V')} />
      </div>
      <table>
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td style={{ textAlign: 'right' }} className="mono">{v.toLocaleString('ru')}</td><td style={{ width: '30%' }}><div style={{ height: 10, background: 'var(--accent)', width: `${(100 * v) / total}%`, borderRadius: 3 }} /></td></tr>)}
          <tr><td><b>Всего</b></td><td style={{ textAlign: 'right' }} className="mono"><b>{total.toLocaleString('ru')}</b></td><td><b>{fmtBig(total)}</b></td></tr>
        </tbody>
      </table>
      <div className="stats">
        <div className="stat"><span className="k">веса в bf16</span><span className="v">{fmtBig(total * 2)}Б</span></div>
        <div className="stat"><span className="k">обучение AdamW (≈16 Б/параметр)</span><span className="v">{fmtBig(total * 16)}Б</span></div>
        <div className="stat"><span className="k">FLOP на токен (обучение)</span><span className="v">{fmtBig(flopsTok)}</span></div>
        <div className="stat"><span className="k">KV-кэш на 1 последовательность T (bf16)</span><span className="v">{fmtBig(2 * L * T * C * 2)}Б</span></div>
      </div>
      <p className="small muted">16 байт/параметр при смешанной точности: веса fp32 (4) + градиенты (4) + два момента Adam (8) — плюс активации, которые зависят от B·T. Обучающие FLOP ≈ 6·N на токен (2N прямой проход + 4N обратный) плюс слагаемое внимания 6·L·T·C — по Каплану и др. (2020). «Б» — байты.</p>
    </Widget>
  );
}

export default function GPTChapter() {
  return (
    <>
      <h1>GPT целиком</h1>
      <p className="lead">Соберём все детали в одну модель — точную копию архитектуры GPT-2 — и посчитаем каждый её параметр.</p>

      <h2>Полный прямой проход</h2>
      <p>Вход — батч индексов токенов <code>idx</code> формы <code>(B, T)</code>. Выход — логиты <code>(B, T, V)</code>: для каждой позиции распределение следующего токена.</p>
      <Eq t={r`\begin{aligned}
X^{(0)} &= W_{te}[\mathrm{idx}] + W_{pe}[0..T-1] &&\in\mathbb R^{B\times T\times C}\\
X^{(l)} &= \mathrm{Block}_l(X^{(l-1)}),\quad l = 1..L\\
Z &= \mathrm{LN}_f(X^{(L)})\,W_{te}^\top &&\in\mathbb R^{B\times T\times V}\\
\mathcal L &= -\frac{1}{BT}\sum_{b,t}\log\mathrm{softmax}(Z_{b,t})_{y_{b,t}}, &&y_{b,t} = \mathrm{idx}_{b,t+1}
\end{aligned}`} />
      <p>Это вся модель. Архитектура GPT-1 <Cite id="radford2018" /> — декодер трансформера <Cite id="vaswani2017" /> без cross-attention; GPT-2 <Cite id="radford2019" /> перенёс LayerNorm в начало блоков, добавил финальный LN и особую инициализацию; GPT-3 <Cite id="brown2020" /> — та же архитектура, увеличенная до 175 млрд параметров (с чередованием плотного и разреженного внимания).</p>

      <h2>Инициализация</h2>
      <ul>
        <li>Все матрицы и эмбеддинги: <M t={r`\mathcal N(0, 0.02^2)`} />; смещения — нули; LayerNorm: <M t={r`\gamma=1, \beta=0`} />.</li>
        <li>Выходные проекции, которые пишут в остаточный поток (<code>attn.c_proj</code> и <code>mlp.c_proj</code>), — с std <M t={r`0.02/\sqrt{2L}`} />. Обоснование: остаточный поток — сумма <M t="2L" /> вкладов; если они независимы, дисперсия суммы растёт пропорционально <M t="2L" />, и масштаб <M t={r`1/\sqrt{2L}`} /> её компенсирует <Cite id="radford2019" />.</li>
      </ul>
      <Callout type="tip" title="Санити-чек при инициализации">
        <p>С малыми весами логиты близки к нулю, softmax почти равномерный, и стартовый loss должен быть <M t={r`\approx\ln V`} />. Запустите <code>python model.py</code>: для GPT-2 small выводится loss ≈ 10.9 при <M t={r`\ln 50257 = 10.82`} />. Если в своей модели вы видите, скажем, 30 — веса инициализированы слишком крупно, и первые сотни шагов уйдут на то, чтобы просто «сдуть» логиты.</p>
      </Callout>

      <h2>Сколько параметров</h2>
      <p>Блок: внимание <M t={r`C\cdot3C + 3C`} /> (c_attn) <M t={r`+\;C^2 + C`} /> (c_proj); MLP <M t={r`C\cdot4C + 4C + 4C\cdot C + C`} />; два LayerNorm по <M t="2C" />. Итого <M t={r`12C^2 + 13C`} /> на блок:</p>
      <Eq t={r`N = \underbrace{VC}_{W_{te}=W_{out}} + \underbrace{T_{max}C}_{W_{pe}} + L(12C^2 + 13C) + \underbrace{2C}_{\mathrm{LN}_f}`} />
      <p>Для GPT-2 small (<M t="V=50257" />, <M t="T=1024" />, <M t="L=12" />, <M t="C=768" />): <M t={r`38\,597\,376 + 786\,432 + 12\cdot 7\,087\,872 + 1\,536 = 124\,439\,808`} /> — ровно столько выводит <code>python model.py</code>.</p>
      <ParamCalc />

      <h2>Полный код модели</h2>
      <p>Файл <code>python/model.py</code> — около 200 строк с комментариями. Всё, что в нём есть, мы уже разобрали; теперь прочитайте его целиком сверху вниз.</p>
      <Code title="python/model.py" collapse>{modelSrc}</Code>
      <h3>На что обратить внимание</h3>
      <ul>
        <li><code>self.transformer.wte.weight = self.lm_head.weight</code> — связывание весов <Cite id="press2017" />: один и тот же объект-параметр используется в двух местах, и его градиент — сумма двух вкладов (вспомните «разветвление» из главы 5).</li>
        <li><code>vocab_size: int = 50304</code> по умолчанию — ближайшее к 50257 число, кратное 64. Размеры, кратные степеням двойки, лучше ложатся на тензорные ядра GPU; лишние 47 токенов просто никогда не встречаются в данных.</li>
        <li><code>F.cross_entropy(logits.view(-1, V), targets.view(-1))</code> — превращаем <code>(B, T, V)</code> в <code>(B·T, V)</code>: каждая позиция — отдельный пример классификации.</li>
        <li><code>configure_optimizers</code> разделяет параметры на две группы: матрицы (dim ≥ 2) с weight decay и векторы (bias, LayerNorm) без него.</li>
        <li><code>generate</code> обрезает контекст до последних <code>block_size</code> токенов: позиционных эмбеддингов дальше просто нет.</li>
      </ul>
      <Quiz q="Сколько параметров в одном блоке GPT при C = 512 (с bias и LayerNorm)?" options={['3 145 728', '3 152 384', '262 144', '12 582 912']} answer={1}
        explain="12·512² + 13·512 = 3 145 728 + 6 656 = 3 152 384." />
      <Quiz q="Почему в GPT-2 у 124M параметров почти треть — эмбеддинги?" options={['Ошибка подсчёта', 'Словарь большой (50 257), а матрица V×C = 38.6M; в маленьких моделях эмбеддинги занимают заметную долю', 'Из-за позиционных эмбеддингов', 'Из-за LayerNorm']} answer={1}
        explain="V·C = 50257·768 ≈ 38.6M. С ростом C блоки растут как C², а эмбеддинги — линейно, поэтому в больших моделях доля эмбеддингов мала." />
    </>
  );
}
