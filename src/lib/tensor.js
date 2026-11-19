// Минимальный тензорный autograd на JavaScript (только 2D-матрицы, Float32Array)
// и крошечный GPT поверх него. Всё, что делает PyTorch в главе «Практикум»,
// здесь написано руками: прямой проход, обратный проход, AdamW.

export class Tensor {
  constructor(data, rows, cols, prev = [], op = '') {
    this.data = data instanceof Float32Array ? data : Float32Array.from(data);
    this.rows = rows;
    this.cols = cols;
    this.grad = null; // выделяем лениво
    this._prev = prev;
    this._op = op;
    this._backward = null;
  }
  static zeros(r, c) { return new Tensor(new Float32Array(r * c), r, c); }
  static randn(r, c, std, rng) {
    const d = new Float32Array(r * c);
    for (let i = 0; i < d.length; i++) d[i] = rng.randn() * std;
    return new Tensor(d, r, c);
  }
  ensureGrad() { if (!this.grad) this.grad = new Float32Array(this.data.length); return this.grad; }
  get size() { return this.data.length; }
}

// ---------- операции (каждая возвращает новый тензор и запоминает, как считать градиент) ----------

/** C = A · B, A:[n,k], B:[k,m] */
export function matmul(A, B) {
  const n = A.rows, k = A.cols, m = B.cols;
  if (B.rows !== k) throw new Error(`matmul: ${n}x${k} · ${B.rows}x${m}`);
  const out = new Float32Array(n * m);
  const a = A.data, b = B.data;
  for (let i = 0; i < n; i++) {
    const oi = i * m;
    for (let p = 0; p < k; p++) {
      const av = a[i * k + p];
      if (av === 0) continue;
      const bp = p * m;
      for (let j = 0; j < m; j++) out[oi + j] += av * b[bp + j];
    }
  }
  const C = new Tensor(out, n, m, [A, B], 'matmul');
  C._backward = () => {
    const g = C.grad, gA = A.ensureGrad(), gB = B.ensureGrad();
    // dA = dC · Bᵀ ;  dB = Aᵀ · dC
    for (let i = 0; i < n; i++) {
      for (let p = 0; p < k; p++) {
        let s = 0;
        const bp = p * m, gi = i * m;
        for (let j = 0; j < m; j++) s += g[gi + j] * b[bp + j];
        gA[i * k + p] += s;
      }
    }
    for (let i = 0; i < n; i++) {
      const gi = i * m;
      for (let p = 0; p < k; p++) {
        const av = a[i * k + p];
        if (av === 0) continue;
        const bp = p * m;
        for (let j = 0; j < m; j++) gB[bp + j] += av * g[gi + j];
      }
    }
  };
  return C;
}

/** A + B (одинаковой формы) */
export function add(A, B) {
  const out = new Float32Array(A.size);
  for (let i = 0; i < out.length; i++) out[i] = A.data[i] + B.data[i];
  const C = new Tensor(out, A.rows, A.cols, [A, B], 'add');
  C._backward = () => {
    const g = C.grad, gA = A.ensureGrad(), gB = B.ensureGrad();
    for (let i = 0; i < g.length; i++) { gA[i] += g[i]; gB[i] += g[i]; }
  };
  return C;
}

/** A[n,m] + b[1,m] (сдвиг/bias, «бродкастинг» по строкам) */
export function addRow(A, b) {
  const n = A.rows, m = A.cols, out = new Float32Array(n * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out[i * m + j] = A.data[i * m + j] + b.data[j];
  const C = new Tensor(out, n, m, [A, b], 'addRow');
  C._backward = () => {
    const g = C.grad, gA = A.ensureGrad(), gb = b.ensureGrad();
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { gA[i * m + j] += g[i * m + j]; gb[j] += g[i * m + j]; }
  };
  return C;
}

/** GELU (аппроксимация через tanh, как в GPT-2) */
export function gelu(A) {
  const K = Math.sqrt(2 / Math.PI);
  const out = new Float32Array(A.size), th = new Float32Array(A.size);
  for (let i = 0; i < out.length; i++) {
    const x = A.data[i];
    const t = Math.tanh(K * (x + 0.044715 * x * x * x));
    th[i] = t;
    out[i] = 0.5 * x * (1 + t);
  }
  const C = new Tensor(out, A.rows, A.cols, [A], 'gelu');
  C._backward = () => {
    const g = C.grad, gA = A.ensureGrad();
    for (let i = 0; i < g.length; i++) {
      const x = A.data[i], t = th[i];
      const dt = (1 - t * t) * K * (1 + 3 * 0.044715 * x * x);
      gA[i] += g[i] * (0.5 * (1 + t) + 0.5 * x * dt);
    }
  };
  return C;
}

/** LayerNorm по строкам: y = (x - μ)/σ · γ + β */
export function layernorm(A, gamma, beta, eps = 1e-5) {
  const n = A.rows, m = A.cols;
  const out = new Float32Array(n * m), xhat = new Float32Array(n * m), rstd = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let mu = 0;
    for (let j = 0; j < m; j++) mu += A.data[i * m + j];
    mu /= m;
    let v = 0;
    for (let j = 0; j < m; j++) { const d = A.data[i * m + j] - mu; v += d * d; }
    v /= m;
    const rs = 1 / Math.sqrt(v + eps);
    rstd[i] = rs;
    for (let j = 0; j < m; j++) {
      const xh = (A.data[i * m + j] - mu) * rs;
      xhat[i * m + j] = xh;
      out[i * m + j] = xh * gamma.data[j] + beta.data[j];
    }
  }
  const C = new Tensor(out, n, m, [A, gamma, beta], 'layernorm');
  C._backward = () => {
    const g = C.grad, gA = A.ensureGrad(), gg = gamma.ensureGrad(), gb = beta.ensureGrad();
    for (let i = 0; i < n; i++) {
      // dxhat = g·γ;  dx = rstd · (dxhat − mean(dxhat) − xhat·mean(dxhat·xhat))
      let s1 = 0, s2 = 0;
      for (let j = 0; j < m; j++) {
        const k = i * m + j, dxh = g[k] * gamma.data[j];
        s1 += dxh; s2 += dxh * xhat[k];
        gg[j] += g[k] * xhat[k];
        gb[j] += g[k];
      }
      s1 /= m; s2 /= m;
      for (let j = 0; j < m; j++) {
        const k = i * m + j, dxh = g[k] * gamma.data[j];
        gA[k] += rstd[i] * (dxh - s1 - xhat[k] * s2);
      }
    }
  };
  return C;
}

/** Строки таблицы по индексам (эмбеддинг): out[i] = table[idx[i]] */
export function embedding(table, idx) {
  const m = table.cols, out = new Float32Array(idx.length * m);
  idx.forEach((t, i) => out.set(table.data.subarray(t * m, (t + 1) * m), i * m));
  const C = new Tensor(out, idx.length, m, [table], 'embedding');
  C._backward = () => {
    const g = C.grad, gt = table.ensureGrad();
    idx.forEach((t, i) => { for (let j = 0; j < m; j++) gt[t * m + j] += g[i * m + j]; });
  };
  return C;
}

/**
 * Каузальное многоголовое внимание (слитая операция).
 * qkv: [B*T, 3C] — уже посчитанные Q, K, V подряд. Возвращает [B*T, C].
 * Сохраняет матрицы внимания (для визуализации) в out.att: [B][h] -> Float32Array(T*T)
 */
export function causalAttention(qkv, B, T, nh) {
  const C3 = qkv.cols, C = C3 / 3, hs = C / nh, scale = 1 / Math.sqrt(hs);
  const out = new Float32Array(B * T * C);
  const P = []; // вероятности внимания для backward
  const q = qkv.data;
  for (let b = 0; b < B; b++) {
    P.push([]);
    for (let h = 0; h < nh; h++) {
      const att = new Float32Array(T * T);
      for (let t = 0; t < T; t++) {
        const qi = (b * T + t) * C3 + h * hs;
        let mx = -Infinity;
        for (let s = 0; s <= t; s++) {
          const ki = (b * T + s) * C3 + C + h * hs;
          let dot = 0;
          for (let d = 0; d < hs; d++) dot += q[qi + d] * q[ki + d];
          dot *= scale;
          att[t * T + s] = dot;
          if (dot > mx) mx = dot;
        }
        let sum = 0;
        for (let s = 0; s <= t; s++) { const e = Math.exp(att[t * T + s] - mx); att[t * T + s] = e; sum += e; }
        for (let s = 0; s <= t; s++) att[t * T + s] /= sum;
        // будущие позиции (s > t) остаются нулями — это и есть каузальная маска
        const oi = (b * T + t) * C + h * hs;
        for (let s = 0; s <= t; s++) {
          const p = att[t * T + s], vi = (b * T + s) * C3 + 2 * C + h * hs;
          for (let d = 0; d < hs; d++) out[oi + d] += p * q[vi + d];
        }
      }
      P[b].push(att);
    }
  }
  const O = new Tensor(out, B * T, C, [qkv], 'attention');
  O.att = P;
  O._backward = () => {
    const g = O.grad, gq = qkv.ensureGrad();
    const dP = new Float32Array(T);
    for (let b = 0; b < B; b++) for (let h = 0; h < nh; h++) {
      const att = P[b][h];
      for (let t = 0; t < T; t++) {
        const oi = (b * T + t) * C + h * hs;
        // dV += Pᵀ dO ;  dP = dO Vᵀ
        let dot = 0;
        for (let s = 0; s <= t; s++) {
          const vi = (b * T + s) * C3 + 2 * C + h * hs, p = att[t * T + s];
          let acc = 0;
          for (let d = 0; d < hs; d++) { acc += g[oi + d] * q[vi + d]; gq[vi + d] += p * g[oi + d]; }
          dP[s] = acc;
          dot += acc * p;
        }
        // производная softmax: dS = P ⊙ (dP − Σ dP·P)
        const qi = (b * T + t) * C3 + h * hs;
        for (let s = 0; s <= t; s++) {
          const dS = att[t * T + s] * (dP[s] - dot) * scale;
          const ki = (b * T + s) * C3 + C + h * hs;
          for (let d = 0; d < hs; d++) { gq[qi + d] += dS * q[ki + d]; gq[ki + d] += dS * q[qi + d]; }
        }
      }
    }
  };
  return O;
}

/** Средняя кросс-энтропия: logits [N,V], targets — массив индексов длины N. Возвращает скаляр [1,1]. */
export function crossEntropy(logits, targets) {
  const N = logits.rows, V = logits.cols;
  const probs = new Float32Array(N * V);
  let loss = 0;
  for (let i = 0; i < N; i++) {
    let mx = -Infinity;
    for (let j = 0; j < V; j++) mx = Math.max(mx, logits.data[i * V + j]);
    let s = 0;
    for (let j = 0; j < V; j++) { const e = Math.exp(logits.data[i * V + j] - mx); probs[i * V + j] = e; s += e; }
    for (let j = 0; j < V; j++) probs[i * V + j] /= s;
    loss += -Math.log(probs[i * V + targets[i]] + 1e-12);
  }
  const L = new Tensor([loss / N], 1, 1, [logits], 'cross_entropy');
  L._backward = () => {
    // dlogits = (softmax − one_hot) / N — красивейшая формула глубокого обучения
    const gl = logits.ensureGrad(), g = L.grad[0] / N;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < V; j++) gl[i * V + j] += g * probs[i * V + j];
      gl[i * V + targets[i]] -= g;
    }
  };
  return L;
}

/** Обратный проход от скаляра loss по всему графу. */
export function backward(loss) {
  const order = [], seen = new Set();
  const build = (v) => {
    if (seen.has(v)) return;
    seen.add(v);
    for (const p of v._prev) build(p);
    order.push(v);
  };
  build(loss);
  for (const v of order) if (v.grad) v.grad.fill(0);
  loss.ensureGrad()[0] = 1;
  for (let i = order.length - 1; i >= 0; i--) if (order[i]._backward) order[i]._backward();
}

// ---------- мини-GPT ----------

export class TinyGPT {
  constructor({ vocabSize, blockSize = 32, nEmbd = 48, nHead = 4, nLayer = 2 }, rng) {
    Object.assign(this, { vocabSize, blockSize, nEmbd, nHead, nLayer });
    const C = nEmbd, std = 0.02, projStd = 0.02 / Math.sqrt(2 * nLayer);
    const ones = (n) => new Tensor(new Float32Array(n).fill(1), 1, n);
    this.wte = Tensor.randn(vocabSize, C, std, rng);
    this.wpe = Tensor.randn(blockSize, C, std, rng);
    this.blocks = [];
    for (let l = 0; l < nLayer; l++) {
      this.blocks.push({
        ln1g: ones(C), ln1b: Tensor.zeros(1, C),
        wqkv: Tensor.randn(C, 3 * C, std, rng), bqkv: Tensor.zeros(1, 3 * C),
        wo: Tensor.randn(C, C, projStd, rng), bo: Tensor.zeros(1, C),
        ln2g: ones(C), ln2b: Tensor.zeros(1, C),
        w1: Tensor.randn(C, 4 * C, std, rng), b1: Tensor.zeros(1, 4 * C),
        w2: Tensor.randn(4 * C, C, projStd, rng), b2: Tensor.zeros(1, C),
      });
    }
    this.lnfg = ones(C); this.lnfb = Tensor.zeros(1, C);
    this.head = Tensor.randn(C, vocabSize, std, rng);
  }
  parameters() {
    const ps = [this.wte, this.wpe];
    for (const b of this.blocks) ps.push(...Object.values(b));
    ps.push(this.lnfg, this.lnfb, this.head);
    return ps;
  }
  numParams() { return this.parameters().reduce((s, p) => s + p.size, 0); }
  /** idx: массив B*T индексов токенов (B последовательностей длины T) */
  forward(idx, B, T, targets) {
    const pos = [];
    for (let b = 0; b < B; b++) for (let t = 0; t < T; t++) pos.push(t);
    let x = add(embedding(this.wte, idx), embedding(this.wpe, pos));
    const atts = [];
    for (const blk of this.blocks) {
      const h = layernorm(x, blk.ln1g, blk.ln1b);
      const qkv = addRow(matmul(h, blk.wqkv), blk.bqkv);
      const a = causalAttention(qkv, B, T, this.nHead);
      atts.push(a.att);
      x = add(x, addRow(matmul(a, blk.wo), blk.bo));
      const h2 = layernorm(x, blk.ln2g, blk.ln2b);
      x = add(x, addRow(matmul(gelu(addRow(matmul(h2, blk.w1), blk.b1)), blk.w2), blk.b2));
    }
    const logits = matmul(layernorm(x, this.lnfg, this.lnfb), this.head);
    const loss = targets ? crossEntropy(logits, targets) : null;
    return { logits, loss, atts };
  }
}

export class AdamW {
  constructor(params, { lr = 3e-3, b1 = 0.9, b2 = 0.99, eps = 1e-8, wd = 0.01 } = {}) {
    Object.assign(this, { params, lr, b1, b2, eps, wd, t: 0 });
    this.m = params.map((p) => new Float32Array(p.size));
    this.v = params.map((p) => new Float32Array(p.size));
  }
  step(lr = this.lr) {
    this.t++;
    const { b1, b2, eps, wd } = this;
    const c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t);
    this.params.forEach((p, k) => {
      if (!p.grad) return;
      const m = this.m[k], v = this.v[k], g = p.grad, d = p.data;
      const decay = p.rows > 1 ? wd : 0; // не применяем weight decay к векторам (bias, LayerNorm)
      for (let i = 0; i < d.length; i++) {
        m[i] = b1 * m[i] + (1 - b1) * g[i];
        v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i];
        d[i] -= lr * ((m[i] / c1) / (Math.sqrt(v[i] / c2) + eps) + decay * d[i]);
      }
    });
  }
}

export function clipGradNorm(params, maxNorm) {
  let s = 0;
  for (const p of params) if (p.grad) for (let i = 0; i < p.grad.length; i++) s += p.grad[i] * p.grad[i];
  const norm = Math.sqrt(s);
  if (norm > maxNorm) {
    const k = maxNorm / (norm + 1e-6);
    for (const p of params) if (p.grad) for (let i = 0; i < p.grad.length; i++) p.grad[i] *= k;
  }
  return norm;
}
