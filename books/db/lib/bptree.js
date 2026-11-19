// B+-дерево на JavaScript для визуализации (тот же алгоритм, что в python/btree.py).
const bisectLeft = (a, x) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; };
const bisectRight = (a, x) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m + 1; else hi = m; } return lo; };

let nodeId = 0;
const mk = (leaf) => ({ id: nodeId++, leaf, keys: [], children: [], next: null });

export class BPTree {
  constructor(order = 4) { this.order = order; this.root = mk(true); this.splits = 0; }

  insert(key) {
    const s = this._ins(this.root, key);
    if (s) { const r = mk(false); r.keys = [s[0]]; r.children = [this.root, s[1]]; this.root = r; }
  }

  _ins(node, key) {
    if (node.leaf) {
      const i = bisectLeft(node.keys, key);
      if (node.keys[i] === key) return null;
      node.keys.splice(i, 0, key);
      if (node.keys.length < this.order) return null;
      this.splits++;
      const mid = node.keys.length >> 1, right = mk(true);
      right.keys = node.keys.splice(mid);
      right.next = node.next; node.next = right;
      return [right.keys[0], right];
    }
    const i = bisectRight(node.keys, key);
    const s = this._ins(node.children[i], key);
    if (!s) return null;
    node.keys.splice(i, 0, s[0]);
    node.children.splice(i + 1, 0, s[1]);
    if (node.children.length <= this.order) return null;
    this.splits++;
    const mid = node.keys.length >> 1, right = mk(false);
    const up = node.keys[mid];
    right.keys = node.keys.splice(mid + 1);
    node.keys.pop();
    right.children = node.children.splice(mid + 1);
    return [up, right];
  }

  /** путь от корня к листу для ключа: массив id узлов */
  path(key) {
    const p = []; let n = this.root;
    while (true) { p.push(n.id); if (n.leaf) return p; n = n.children[bisectRight(n.keys, key)]; }
  }

  has(key) {
    let n = this.root;
    while (!n.leaf) n = n.children[bisectRight(n.keys, key)];
    return n.keys.includes(key);
  }

  levels() {
    const out = []; let level = [this.root];
    while (level.length) { out.push(level); level = level.flatMap((n) => (n.leaf ? [] : n.children)); }
    return out;
  }
}
