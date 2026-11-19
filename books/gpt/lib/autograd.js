// Скалярный autograd в духе micrograd: каждое число помнит, из чего оно получено,
// и умеет протолкнуть градиент назад по цепному правилу.
let _id = 0;
export class Value {
  constructor(data, children = [], op = '', label = '') {
    this.data = data;
    this.grad = 0;
    this._prev = children;
    this._op = op;
    this._backward = () => {};
    this.label = label;
    this.id = _id++;
  }
  static of(x) { return x instanceof Value ? x : new Value(x); }
  add(o) {
    o = Value.of(o);
    const out = new Value(this.data + o.data, [this, o], '+');
    out._backward = () => { this.grad += out.grad; o.grad += out.grad; };
    return out;
  }
  mul(o) {
    o = Value.of(o);
    const out = new Value(this.data * o.data, [this, o], '×');
    out._backward = () => { this.grad += o.data * out.grad; o.grad += this.data * out.grad; };
    return out;
  }
  pow(k) {
    const out = new Value(Math.pow(this.data, k), [this], `^${k}`);
    out._backward = () => { this.grad += k * Math.pow(this.data, k - 1) * out.grad; };
    return out;
  }
  neg() { return this.mul(-1); }
  sub(o) { return this.add(Value.of(o).neg()); }
  div(o) { return this.mul(Value.of(o).pow(-1)); }
  tanh() {
    const t = Math.tanh(this.data);
    const out = new Value(t, [this], 'tanh');
    out._backward = () => { this.grad += (1 - t * t) * out.grad; };
    return out;
  }
  relu() {
    const out = new Value(Math.max(0, this.data), [this], 'ReLU');
    out._backward = () => { this.grad += (this.data > 0 ? 1 : 0) * out.grad; };
    return out;
  }
  exp() {
    const e = Math.exp(this.data);
    const out = new Value(e, [this], 'exp');
    out._backward = () => { this.grad += e * out.grad; };
    return out;
  }
  log() {
    const out = new Value(Math.log(this.data), [this], 'log');
    out._backward = () => { this.grad += (1 / this.data) * out.grad; };
    return out;
  }
  sigmoid() {
    const s = 1 / (1 + Math.exp(-this.data));
    const out = new Value(s, [this], 'σ');
    out._backward = () => { this.grad += s * (1 - s) * out.grad; };
    return out;
  }
  // топологическая сортировка + обратный проход
  topo() {
    const order = [], seen = new Set();
    const build = (v) => {
      if (seen.has(v)) return;
      seen.add(v);
      v._prev.forEach(build);
      order.push(v);
    };
    build(this);
    return order;
  }
  backward() {
    const order = this.topo();
    order.forEach((v) => (v.grad = 0));
    this.grad = 1;
    for (let i = order.length - 1; i >= 0; i--) order[i]._backward();
    return order;
  }
}

// Маленькая полносвязная сеть (MLP) из скаляров.
export class MLP {
  constructor(sizes, rng, act = 'tanh') {
    this.act = act;
    this.layers = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      const nin = sizes[l], nout = sizes[l + 1];
      const scale = 1 / Math.sqrt(nin);
      const W = [], b = [];
      for (let o = 0; o < nout; o++) {
        W.push(Array.from({ length: nin }, () => new Value(rng.randn() * scale)));
        b.push(new Value(0));
      }
      this.layers.push({ W, b });
    }
  }
  forward(x) {
    let h = x.map(Value.of);
    this.layers.forEach((L, li) => {
      const last = li === this.layers.length - 1;
      h = L.W.map((row, o) => {
        let s = L.b[o];
        row.forEach((w, i) => (s = s.add(w.mul(h[i]))));
        if (last) return s;
        return this.act === 'relu' ? s.relu() : s.tanh();
      });
    });
    return h;
  }
  parameters() { return this.layers.flatMap((L) => [...L.W.flat(), ...L.b]); }
}
