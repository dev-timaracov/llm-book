import React, { useState } from 'react';
import { M, Eq, r, Cite, Callout, Code, Quiz, Widget, Slider, fmtBig } from '../components/ui.jsx';
import { LineChart } from '../components/charts.jsx';

function ScalingWidget() {
  const [logC, setLogC] = useState(21);
  const [gpuTflops, setGpu] = useState(300);
  const [mfu, setMfu] = useState(0.4);
  const C = Math.pow(10, logC);
  // Chinchilla: C ≈ 6·N·D, D ≈ 20·N  ⇒  N = sqrt(C/120)
  const N = Math.sqrt(C / 120), D = 20 * N;
  const gpuHours = C / (gpuTflops * 1e12 * mfu) / 3600;
  // параметрическая аппроксимация из Hoffmann et al. 2022 (подход 3): L = E + A/N^α + B/D^β
  const E = 1.69, A = 406.4, B = 410.7, al = 0.34, be = 0.28;
  const Lfit = (n, d) => E + A / Math.pow(n, al) + B / Math.pow(d, be);
  const curve = Array.from({ length: 60 }, (_, i) => {
    const n = Math.pow(10, 7 + (i / 59) * 5); const d = C / (6 * n);
    return [Math.log10(n), Lfit(n, d)];
  });
  return (
    <Widget title="Законы масштабирования: сколько параметров и данных при бюджете C">
      <div className="controls">
        <Slider label="бюджет вычислений, log₁₀ FLOP" value={logC} min={15} max={26} step={0.1} onChange={setLogC} />
        <Slider label="GPU, TFLOP/с (bf16)" value={gpuTflops} min={10} max={1000} step={10} onChange={setGpu} />
        <Slider label="утилизация (MFU)" value={mfu} min={0.1} max={0.7} step={0.05} onChange={setMfu} />
      </div>
      <div className="stats">
        <div className="stat"><span className="k">C</span><span className="v">{C.toExponential(1)}</span></div>
        <div className="stat"><span className="k">оптимум N (Chinchilla)</span><span className="v">{fmtBig(N)}</span></div>
        <div className="stat"><span className="k">токенов D ≈ 20N</span><span className="v">{fmtBig(D)}</span></div>
        <div className="stat"><span className="k">GPU-часов</span><span className="v">{gpuHours < 1 ? (gpuHours * 60).toFixed(1) + ' мин' : fmtBig(gpuHours)}</span></div>
      </div>
      <LineChart height={220} series={[{ data: curve, color: 'var(--c1)', label: 'L(N, D=C/6N) по аппроксимации Chinchilla' }]}
        xLabel="log₁₀ N (параметров)" yLabel="loss" extra={(sx, sy) => <circle cx={sx(Math.log10(N))} cy={sy(Lfit(N, D))} r={6} fill="var(--c2)" />} />
      <p className="small muted">При фиксированном C слишком маленькая модель недоучивается (мало параметров), слишком большая — видит слишком мало токенов. Оранжевая точка — правило «20 токенов на параметр». Аппроксимация L = E + A/N^α + B/D^β с коэффициентами из Hoffmann и др. (2022) обучена на их данных (MassiveText, их токенизатор) — для других данных числа другие, форма та же. Пример: Chinchilla — 70B параметров, 1.4T токенов, C ≈ 5.9·10²³.</p>
    </Widget>
  );
}

export default function Beyond() {
  return (
    <>
      <h1>Масштаб, современные LLM, RLHF</h1>
      <p className="lead">Ваша GPT и, скажем, LLaMA или GPT-4 — один и тот же вид модели. Разница — в масштабе, данных, нескольких архитектурных улучшениях и в «дообучении на людях». Пройдём по всем пунктам.</p>

      <h2>Законы масштабирования</h2>
      <p>Каплан и др. <Cite id="kaplan2020" /> обнаружили, что loss языковой модели падает по <b>степенному закону</b> от числа параметров <M t="N" />, данных <M t="D" /> и вычислений <M t="C" /> — на много порядков:</p>
      <Eq t={r`L(N) \approx \Big(\frac{N_c}{N}\Big)^{\alpha_N},\;\; \alpha_N\approx 0.076;\qquad L(D)\approx\Big(\frac{D_c}{D}\Big)^{\alpha_D},\;\;\alpha_D\approx 0.095`} />
      <p>
        На графике в логарифмических осях это прямые линии. Важнейшее следствие: результат большой модели можно <b>предсказать</b> по маленьким. Стоимость обучения: <M t={r`C\approx 6ND`} /> FLOP (2 на прямой проход, 4 на обратный, на каждый параметр и токен).
      </p>
      <p>
        Хоффманн и др. (Chinchilla) <Cite id="hoffmann2022" /> пересмотрели вывод о распределении бюджета: при оптимальном использовании вычислений <M t="N" /> и <M t="D" /> нужно растить <b>в равной пропорции</b>,
        примерно <b>20 токенов на параметр</b>. GPT-3 (175B параметров, 300B токенов) по этому критерию сильно недоучена; Chinchilla с 70B параметров на 1.4T токенов превзошла модели в 4 раза больше.
        Современные модели часто учат на ещё большем числе токенов (сотни на параметр): если модель будут применять миллиарды раз, выгоднее потратить больше на обучение маленькой модели, чтобы она была дешевле в использовании <Cite id="touvron2023" />.
      </p>
      <ScalingWidget />

      <h2>Что появляется с масштабом</h2>
      <ul>
        <li><b>Обучение в контексте (in-context learning).</b> GPT-3 <Cite id="brown2020" /> решает новые задачи по нескольким примерам в промпте, без изменения весов. Механистически это связывают с индукционными головами <Cite id="olsson2022" />.</li>
        <li><b>«Эмерджентные» способности</b> <Cite id="wei2022emergent" /> — навыки, резко появляющиеся при определённом масштабе (часть исследователей считает резкость артефактом выбора метрик).</li>
        <li><b>Цепочка рассуждений</b> (chain-of-thought) <Cite id="wei2022cot" />: попросив модель рассуждать по шагам, можно значительно повысить качество в задачах на рассуждение — модель тратит больше токенов (вычислений) на ответ.</li>
      </ul>

      <h2>Архитектурные улучшения после GPT-2</h2>
      <p>Типичная современная открытая модель (линия LLaMA <Cite id="touvron2023" />) отличается от нашего <code>model.py</code> всего несколькими заменами:</p>
      <table>
        <thead><tr><th>GPT-2</th><th>Современно</th><th>Зачем</th></tr></thead>
        <tbody>
          <tr><td>LayerNorm</td><td>RMSNorm <Cite id="zhang2019" /></td><td>проще и быстрее, качество то же</td></tr>
          <tr><td>MLP с GELU</td><td>SwiGLU <Cite id="shazeer2020" /></td><td>заметно лучше при том же числе параметров</td></tr>
          <tr><td>Обучаемые позиции</td><td>RoPE <Cite id="su2021" /></td><td>относительные позиции, экстраполяция длины</td></tr>
          <tr><td>MHA</td><td>GQA <Cite id="ainslie2023" /></td><td>меньше KV-кэш, быстрее генерация</td></tr>
          <tr><td>Внимание «в лоб»</td><td>FlashAttention <Cite id="dao2022" /></td><td>память O(T) вместо O(T²), в разы быстрее</td></tr>
          <tr><td>bias в Linear</td><td>без bias</td><td>не нужен, чуть стабильнее</td></tr>
        </tbody>
      </table>

      <h3>RMSNorm</h3>
      <Eq t={r`\mathrm{RMSNorm}(\mathbf x)_i = \gamma_i\frac{x_i}{\sqrt{\frac1C\sum_j x_j^2 + \epsilon}}`} />
      <p>Без вычитания среднего и без <M t={r`\beta`} />. Чжан и Сеннрих показали, что именно масштабирование, а не центрирование, даёт основной эффект LayerNorm.</p>

      <h3>SwiGLU</h3>
      <Eq t={r`\mathrm{FFN}_{\mathrm{SwiGLU}}(\mathbf x) = \big(\mathrm{SiLU}(\mathbf xW_1)\odot\mathbf xW_3\big)W_2,\qquad \mathrm{SiLU}(z) = z\,\sigma(z)`} />
      <p>Вторая проекция <M t={r`\mathbf xW_3`} /> работает как поэлементные «ворота». Матриц три вместо двух, поэтому ширину скрытого слоя берут ≈ <M t={r`\tfrac{8}{3}C`} /> вместо <M t="4C" />, чтобы число параметров не изменилось.</p>

      <h3>RoPE</h3>
      <p>Каждая пара компонент запроса и ключа на позиции <M t="p" /> поворачивается на угол <M t={r`p\,\theta_k`} />, <M t={r`\theta_k = 10000^{-2k/d}`} />:</p>
      <Eq t={r`\begin{pmatrix}q'_{2k}\\q'_{2k+1}\end{pmatrix} = \begin{pmatrix}\cos p\theta_k & -\sin p\theta_k\\ \sin p\theta_k & \cos p\theta_k\end{pmatrix}\begin{pmatrix}q_{2k}\\q_{2k+1}\end{pmatrix}`} />
      <p>Поскольку произведение поворотов на <M t={r`p\theta`} /> и <M t={r`-s\theta`} /> — поворот на <M t={r`(p-s)\theta`} />, скалярное произведение <M t={r`\mathbf q'_p\cdot\mathbf k'_s`} /> зависит только от разности позиций (глава 9). Значения не поворачиваются, к эмбеддингам ничего не прибавляется.</p>
      <Code title="python — RMSNorm, SwiGLU и RoPE (замена блоков в model.py)">{`
import torch, torch.nn as nn, torch.nn.functional as F

class RMSNorm(nn.Module):
    def __init__(self, dim, eps=1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))
    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight

class SwiGLU(nn.Module):
    def __init__(self, C):
        super().__init__()
        hidden = int(8 * C / 3)
        hidden = 64 * ((hidden + 63) // 64)          # округляем до кратного 64
        self.w1 = nn.Linear(C, hidden, bias=False)
        self.w3 = nn.Linear(C, hidden, bias=False)
        self.w2 = nn.Linear(hidden, C, bias=False)
    def forward(self, x):
        return self.w2(F.silu(self.w1(x)) * self.w3(x))

def rope_cache(T, hs, base=10000.0, device=None):
    theta = base ** (-torch.arange(0, hs, 2, device=device).float() / hs)   # (hs/2,)
    angles = torch.arange(T, device=device).float()[:, None] * theta[None]  # (T, hs/2)
    return angles.cos(), angles.sin()

def apply_rope(x, cos, sin):
    # x: (B, nh, T, hs); поворачиваем пары (x[..., 0::2], x[..., 1::2])
    x1, x2 = x[..., 0::2], x[..., 1::2]
    T = x.size(2)
    c, s = cos[:T], sin[:T]
    out = torch.stack([x1 * c - x2 * s, x1 * s + x2 * c], dim=-1)
    return out.flatten(-2)

# в CausalSelfAttention.forward после разбиения на головы:
#   q, k = apply_rope(q, cos, sin), apply_rope(k, cos, sin)
# и уберите wpe из GPT.forward.
`}</Code>

      <h2>От языковой модели к ассистенту</h2>
      <p>Предобученная модель — «продолжатель текста»: на вопрос она может ответить другим вопросом, потому что в интернете вопросы часто идут списком. Чтобы получить ассистента, делают ещё два этапа <Cite id="ouyang2022" />.</p>
      <h3>1. Supervised fine-tuning (SFT)</h3>
      <p>Дообучение тем же самым кросс-энтропийным loss на диалогах «инструкция → хороший ответ», написанных людьми. Обычно loss считают только по токенам ответа. Технически — тот же <code>train.py</code>, другие данные.</p>
      <h3>2. Обучение на предпочтениях: RLHF</h3>
      <p>Кристиано и др. <Cite id="christiano2017" />, Оуян и др. (InstructGPT) <Cite id="ouyang2022" />. Люди сравнивают пары ответов. На сравнениях обучается <b>модель вознаграждения</b> <M t={r`r_\phi(x, y)`} /> по модели Брэдли — Терри:</p>
      <Eq t={r`\mathcal L_{RM} = -\mathbb E\big[\log\sigma\big(r_\phi(x, y_w) - r_\phi(x, y_l)\big)\big]`} label="y_w — предпочтённый ответ, y_l — отвергнутый" />
      <p>Затем политика (сама LLM) оптимизируется алгоритмом PPO <Cite id="schulman2017" />, максимизируя награду с штрафом за уход от SFT-модели:</p>
      <Eq t={r`\max_\theta\;\mathbb E_{y\sim\pi_\theta(\cdot\mid x)}\big[r_\phi(x,y)\big] - \beta\,D_{\mathrm{KL}}\big(\pi_\theta(\cdot\mid x)\,\Vert\,\pi_{\mathrm{ref}}(\cdot\mid x)\big)`} />
      <p>KL-штраф (глава 3!) не даёт модели «взломать» несовершенную модель вознаграждения бессмысленными, но высоко оцениваемыми ответами.</p>
      <h3>DPO: без отдельной модели вознаграждения</h3>
      <p>Рафаилов и др. <Cite id="rafailov2023" /> показали, что у задачи выше есть аналитическое решение, и оптимизировать политику можно напрямую на парах предпочтений обычным градиентным спуском:</p>
      <Eq t={r`\mathcal L_{DPO} = -\mathbb E\Big[\log\sigma\Big(\beta\log\frac{\pi_\theta(y_w\mid x)}{\pi_{\mathrm{ref}}(y_w\mid x)} - \beta\log\frac{\pi_\theta(y_l\mid x)}{\pi_{\mathrm{ref}}(y_l\mid x)}\Big)\Big]`} />
      <p>Логарифм вероятности ответа <M t={r`\log\pi_\theta(y\mid x)`} /> — это сумма лог-вероятностей его токенов, то есть минус та же кросс-энтропия, которую мы считали всю дорогу. DPO можно реализовать поверх вашего <code>model.py</code> за пару десятков строк.</p>
      <h3>LoRA: дешёвое дообучение</h3>
      <p>Ху и др. <Cite id="hu2021" />: вместо обновления огромной матрицы <M t="W" /> учат низкоранговую поправку <M t={r`W' = W + \frac{\alpha}{r}BA`} />, <M t={r`B\in\mathbb R^{d\times r}, A\in\mathbb R^{r\times k}`} />, <M t={r`r\ll d`} />. Число обучаемых параметров падает в сотни раз; <M t="B" /> инициализируют нулями, так что в начале <M t="W'=W" />.</p>

      <h2>Куда двигаться дальше</h2>
      <ul>
        <li>Перечитайте «Attention Is All You Need» <Cite id="vaswani2017" />, отчёты GPT-2 <Cite id="radford2019" /> и GPT-3 <Cite id="brown2020" /> — теперь вы поймёте каждую строку.</li>
        <li>Интерпретируемость: «A Mathematical Framework for Transformer Circuits» <Cite id="elhage2021" /> и «In-context Learning and Induction Heads» <Cite id="olsson2022" />.</li>
        <li>Эффективность: FlashAttention <Cite id="dao2022" />, анализ инференса <Cite id="pope2022" />, vLLM <Cite id="kwon2023" />.</li>
        <li>Практика: обучите модель на TinyStories <Cite id="eldan2023" /> с RoPE + RMSNorm + SwiGLU, затем сделайте SFT на маленьком наборе диалогов.</li>
      </ul>
      <Quiz q="Бюджет 10²¹ FLOP. Сколько параметров оптимально по правилу Chinchilla (C ≈ 6ND, D ≈ 20N)?" options={['≈ 2.9 млрд', '≈ 290 млн', '≈ 29 млн', '≈ 29 млрд']} answer={0}
        explain="C = 6N·20N = 120N², N = √(10²¹/120) ≈ 2.9·10⁹. Данных D ≈ 58 млрд токенов." />
      <Quiz q="Зачем в RLHF штраф KL к исходной модели?" options={['Для ускорения', 'Чтобы политика не уходила далеко от SFT-модели и не эксплуатировала ошибки модели вознаграждения', 'Это часть кросс-энтропии', 'Чтобы уменьшить словарь']} answer={1}
        explain="Модель вознаграждения — лишь приближение человеческих предпочтений. Без ограничения оптимизатор найдёт её «дыры»." />
    </>
  );
}
