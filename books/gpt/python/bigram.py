"""
bigram.py — первая языковая модель: биграммы, двумя способами.

Глава 7 учебника.
  1) Подсчёт частот: P(следующий | текущий) = count(текущий, следующий) / count(текущий)
  2) Нейросеть: таблица логитов W[V, V], обучаемая градиентным спуском по кросс-энтропии.
Оба способа приходят к одному и тому же ответу — и это важный урок: обучение
максимизирует правдоподобие, а для биграмм максимум правдоподобия — это и есть частоты.

Запуск:  python bigram.py data/input.txt
"""
import sys
import torch
import torch.nn.functional as F

path = sys.argv[1] if len(sys.argv) > 1 else "data/input.txt"
text = open(path, encoding="utf-8").read()
chars = sorted(set(text))
V = len(chars)
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
data = torch.tensor([stoi[c] for c in text], dtype=torch.long)
print(f"символов в тексте: {len(text):,}, размер словаря V={V}")

# ---------- 1. Подсчёт ----------
N = torch.zeros((V, V), dtype=torch.float32)
N.index_put_((data[:-1], data[1:]), torch.ones(len(data) - 1), accumulate=True)
P = (N + 1) / (N + 1).sum(dim=1, keepdim=True)    # +1 — сглаживание Лапласа: нет нулевых вероятностей
nll = -torch.log(P[data[:-1], data[1:]]).mean()
print(f"[подсчёт]   средний NLL = {nll.item():.4f}  (перплексия {nll.exp().item():.2f})")

# ---------- 2. Нейросеть ----------
g = torch.Generator().manual_seed(0)
W = torch.randn((V, V), generator=g, requires_grad=True)
xs, ys = data[:-1], data[1:]
for step in range(301):
    logits = W[xs]                       # то же самое, что one_hot(xs) @ W
    loss = F.cross_entropy(logits, ys)
    W.grad = None
    loss.backward()
    with torch.no_grad():
        W -= 50.0 * W.grad               # таблица «неглубокая» — большой шаг допустим
    if step % 50 == 0:
        print(f"[нейросеть] шаг {step:3d}  loss = {loss.item():.4f}")

# ---------- генерация ----------
probs = F.softmax(W.detach(), dim=1)
idx, out = stoi.get("\n", 0), []
for _ in range(300):
    idx = torch.multinomial(probs[idx], 1, generator=g).item()
    out.append(itos[idx])
print("".join(out))
