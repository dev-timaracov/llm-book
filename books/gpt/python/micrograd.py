"""
micrograd.py — автоматическое дифференцирование для скаляров, с нуля.

Глава 5 учебника. Идея (обратный режим автодифференцирования, Rumelhart и др., 1986):
каждое число помнит, из каких чисел и какой операцией оно получено. Тогда, зная
производную итогового значения по «выходу» операции, можно по цепному правилу
вычислить производные по её «входам» — и так до самых листьев графа.

Запуск:  python micrograd.py   (обучит маленькую сеть на XOR и сверит градиенты с численными)
"""
import math
import random


class Value:
    def __init__(self, data, _children=(), _op=""):
        self.data = float(data)
        self.grad = 0.0                # dL/d(self), заполняется в backward()
        self._prev = set(_children)    # из чего получено это число
        self._op = _op                 # какой операцией (для отладки/рисования)
        self._backward = lambda: None  # как протолкнуть градиент к детям

    # --- базовые операции: для каждой пишем локальную производную ---
    def __add__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data + other.data, (self, other), "+")

        def _backward():
            # d(a+b)/da = 1, d(a+b)/db = 1  →  градиент просто копируется
            self.grad += out.grad
            other.grad += out.grad
        out._backward = _backward
        return out

    def __mul__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data * other.data, (self, other), "*")

        def _backward():
            # d(a*b)/da = b, d(a*b)/db = a
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out._backward = _backward
        return out

    def __pow__(self, k):
        assert isinstance(k, (int, float)), "поддерживаем только числовую степень"
        out = Value(self.data ** k, (self,), f"**{k}")

        def _backward():
            self.grad += k * self.data ** (k - 1) * out.grad
        out._backward = _backward
        return out

    def tanh(self):
        t = math.tanh(self.data)
        out = Value(t, (self,), "tanh")

        def _backward():
            self.grad += (1 - t * t) * out.grad   # (tanh x)' = 1 - tanh² x
        out._backward = _backward
        return out

    def relu(self):
        out = Value(max(0.0, self.data), (self,), "relu")

        def _backward():
            self.grad += (1.0 if self.data > 0 else 0.0) * out.grad
        out._backward = _backward
        return out

    def exp(self):
        e = math.exp(self.data)
        out = Value(e, (self,), "exp")

        def _backward():
            self.grad += e * out.grad
        out._backward = _backward
        return out

    def log(self):
        out = Value(math.log(self.data), (self,), "log")

        def _backward():
            self.grad += (1.0 / self.data) * out.grad
        out._backward = _backward
        return out

    # --- обратный проход ---
    def backward(self):
        # 1) топологическая сортировка: каждый узел идёт после всех, от кого зависит
        topo, visited = [], set()

        def build(v):
            if v not in visited:
                visited.add(v)
                for child in v._prev:
                    build(child)
                topo.append(v)
        build(self)
        # 2) dL/dL = 1, затем идём от конца к началу
        for v in topo:
            v.grad = 0.0
        self.grad = 1.0
        for v in reversed(topo):
            v._backward()

    # --- синтаксический сахар ---
    def __neg__(self): return self * -1
    def __radd__(self, other): return self + other
    def __sub__(self, other): return self + (-other)
    def __rsub__(self, other): return other + (-self)
    def __rmul__(self, other): return self * other
    def __truediv__(self, other): return self * other ** -1
    def __rtruediv__(self, other): return other * self ** -1
    def __repr__(self): return f"Value(data={self.data:.4f}, grad={self.grad:.4f})"


# ------------------------- нейросеть из Value -------------------------
class Neuron:
    def __init__(self, nin, nonlin=True):
        # инициализация с масштабом 1/sqrt(nin) — чтобы выход не «взрывался» (Glorot & Bengio, 2010)
        self.w = [Value(random.gauss(0, 1) / math.sqrt(nin)) for _ in range(nin)]
        self.b = Value(0.0)
        self.nonlin = nonlin

    def __call__(self, x):
        act = sum((wi * xi for wi, xi in zip(self.w, x)), self.b)
        return act.tanh() if self.nonlin else act

    def parameters(self):
        return self.w + [self.b]


class Layer:
    def __init__(self, nin, nout, **kw):
        self.neurons = [Neuron(nin, **kw) for _ in range(nout)]

    def __call__(self, x):
        out = [n(x) for n in self.neurons]
        return out[0] if len(out) == 1 else out

    def parameters(self):
        return [p for n in self.neurons for p in n.parameters()]


class MLP:
    def __init__(self, nin, nouts):
        sz = [nin] + nouts
        self.layers = [Layer(sz[i], sz[i + 1], nonlin=i != len(nouts) - 1) for i in range(len(nouts))]

    def __call__(self, x):
        for layer in self.layers:
            x = layer(x)
        return x

    def parameters(self):
        return [p for layer in self.layers for p in layer.parameters()]


def numerical_grad_check():
    """Сравниваем аналитический градиент с конечной разностью (f(x+h)-f(x-h))/2h."""
    def f(a, b, c):
        return ((a * b + c).tanh() * a + (b ** 2).exp()).log()
    a, b, c = Value(0.7), Value(-0.3), Value(0.2)
    out = f(a, b, c)
    out.backward()
    h = 1e-6
    for name, v in [("a", a), ("b", b), ("c", c)]:
        old = v.data
        v.data = old + h; fp = f(a, b, c).data
        v.data = old - h; fm = f(a, b, c).data
        v.data = old
        num = (fp - fm) / (2 * h)
        print(f"d out/d{name}: autograd={v.grad:+.6f}  численно={num:+.6f}")


if __name__ == "__main__":
    random.seed(0)
    numerical_grad_check()

    # XOR — классическая задача, которую не решает один нейрон (Minsky & Papert, 1969),
    # но легко решает сеть со скрытым слоем.
    X = [[0, 0], [0, 1], [1, 0], [1, 1]]
    Y = [-1, 1, 1, -1]
    model = MLP(2, [8, 1])
    for step in range(300):
        preds = [model(x) for x in X]
        loss = sum((p - y) ** 2 for p, y in zip(preds, Y)) * (1 / len(X))
        loss.backward()
        for p in model.parameters():
            p.data -= 0.1 * p.grad      # градиентный спуск
        if step % 50 == 0 or step == 299:
            print(f"шаг {step:3d}  loss={loss.data:.5f}")
    print("предсказания:", [round(model(x).data, 3) for x in X], "цели:", Y)
