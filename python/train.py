"""
train.py — обучение GPT с нуля.

Глава 14 учебника. Всё, что здесь есть, разобрано в тексте:
  - случайные окна из train.bin как батчи (B последовательностей по T токенов)
  - AdamW (Loshchilov & Hutter, 2019), weight decay только для матриц
  - линейный warmup (Goyal и др., 2017) + косинусное затухание LR (Loshchilov & Hutter, 2017)
  - обрезка нормы градиента (Pascanu и др., 2013)
  - накопление градиента (gradient accumulation) для «большого» батча на маленькой видеокарте
  - смешанная точность bfloat16/float16 на GPU (Micikevicius и др., 2018)
  - регулярная оценка на валидации и сохранение лучшего чекпоинта

Примеры:
  python train.py                                   # конфиг по умолчанию (≈10M параметров, нужна GPU)
  python train.py --device cpu --n_layer 4 --n_head 4 --n_embd 128 --block_size 64 \
                  --batch_size 32 --max_iters 2000 --eval_interval 250   # ноутбук без видеокарты
"""
import argparse
import json
import math
import os
import time
from contextlib import nullcontext

import numpy as np
import torch

from model import GPT, GPTConfig

p = argparse.ArgumentParser()
# данные / вывод
p.add_argument("--data_dir", default="data")
p.add_argument("--out_dir", default="out")
# модель
p.add_argument("--n_layer", type=int, default=6)
p.add_argument("--n_head", type=int, default=6)
p.add_argument("--n_embd", type=int, default=384)
p.add_argument("--block_size", type=int, default=256)
p.add_argument("--dropout", type=float, default=0.2)
p.add_argument("--bias", type=int, default=1)
# оптимизация
p.add_argument("--batch_size", type=int, default=64)
p.add_argument("--grad_accum", type=int, default=1, help="эффективный батч = batch_size × grad_accum")
p.add_argument("--max_iters", type=int, default=5000)
p.add_argument("--lr", type=float, default=1e-3)
p.add_argument("--min_lr", type=float, default=1e-4)
p.add_argument("--warmup_iters", type=int, default=100)
p.add_argument("--weight_decay", type=float, default=0.1)
p.add_argument("--beta1", type=float, default=0.9)
p.add_argument("--beta2", type=float, default=0.99)
p.add_argument("--grad_clip", type=float, default=1.0)
# служебное
p.add_argument("--eval_interval", type=int, default=250)
p.add_argument("--eval_iters", type=int, default=100)
p.add_argument("--log_interval", type=int, default=10)
p.add_argument("--device", default="cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))
p.add_argument("--compile", type=int, default=0, help="torch.compile — быстрее на GPU, но дольше старт")
p.add_argument("--seed", type=int, default=1337)
args = p.parse_args()

torch.manual_seed(args.seed)
os.makedirs(args.out_dir, exist_ok=True)
device_type = "cuda" if "cuda" in args.device else ("mps" if "mps" in args.device else "cpu")

# --- смешанная точность: на GPU считаем в bfloat16 (или float16), веса храним в float32 ---
if device_type == "cuda":
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    ctx = torch.autocast(device_type="cuda", dtype=dtype)
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
else:
    dtype = torch.float32
    ctx = nullcontext()
# float16 имеет узкий диапазон — нужен GradScaler, иначе мелкие градиенты обнулятся
scaler = torch.amp.GradScaler("cuda", enabled=(dtype == torch.float16))

# --- данные ---
with open(os.path.join(args.data_dir, "meta.json"), encoding="utf-8") as f:
    meta = json.load(f)
train_data = np.memmap(os.path.join(args.data_dir, "train.bin"), dtype=np.uint16, mode="r")
val_data = np.memmap(os.path.join(args.data_dir, "val.bin"), dtype=np.uint16, mode="r")


def get_batch(split):
    """B случайных окон длины T+1: x — первые T токенов, y — те же, сдвинутые на 1."""
    data = train_data if split == "train" else val_data
    ix = torch.randint(len(data) - args.block_size - 1, (args.batch_size,))
    x = torch.stack([torch.from_numpy(data[i:i + args.block_size].astype(np.int64)) for i in ix])
    y = torch.stack([torch.from_numpy(data[i + 1:i + 1 + args.block_size].astype(np.int64)) for i in ix])
    if device_type == "cuda":
        return x.pin_memory().to(args.device, non_blocking=True), y.pin_memory().to(args.device, non_blocking=True)
    return x.to(args.device), y.to(args.device)


# --- модель ---
cfg = GPTConfig(vocab_size=meta["vocab_size"], block_size=args.block_size, n_layer=args.n_layer,
                n_head=args.n_head, n_embd=args.n_embd, dropout=args.dropout, bias=bool(args.bias))
model = GPT(cfg).to(args.device)
print(f"параметров (без позиционных эмбеддингов): {model.num_params() / 1e6:.2f}M; устройство: {args.device}")
optimizer = model.configure_optimizers(args.weight_decay, args.lr, (args.beta1, args.beta2), device_type)
if args.compile:
    model = torch.compile(model)


def get_lr(it):
    """Линейный разогрев, затем косинус от lr до min_lr."""
    if it < args.warmup_iters:
        return args.lr * (it + 1) / args.warmup_iters
    if it > args.max_iters:
        return args.min_lr
    ratio = (it - args.warmup_iters) / max(1, args.max_iters - args.warmup_iters)
    coeff = 0.5 * (1.0 + math.cos(math.pi * ratio))        # от 1 до 0
    return args.min_lr + coeff * (args.lr - args.min_lr)


@torch.no_grad()
def estimate_loss():
    """Средний loss по eval_iters батчам — один батч слишком шумный."""
    out = {}
    model.eval()                                           # выключает dropout
    for split in ["train", "val"]:
        losses = torch.zeros(args.eval_iters)
        for k in range(args.eval_iters):
            X, Y = get_batch(split)
            with ctx:
                _, loss = model(X, Y)
            losses[k] = loss.item()
        out[split] = losses.mean().item()
    model.train()
    return out


print(f"loss в начале должен быть ≈ ln({meta['vocab_size']}) = {math.log(meta['vocab_size']):.3f}")
best_val = float("inf")
X, Y = get_batch("train")
t0 = time.time()
for it in range(args.max_iters + 1):
    lr = get_lr(it)
    for group in optimizer.param_groups:
        group["lr"] = lr

    if it % args.eval_interval == 0:
        losses = estimate_loss()
        print(f"[eval] шаг {it}: train {losses['train']:.4f}, val {losses['val']:.4f}")
        if losses["val"] < best_val:
            best_val = losses["val"]
            raw = model._orig_mod if hasattr(model, "_orig_mod") else model
            torch.save({"model": raw.state_dict(), "config": cfg.__dict__, "meta": meta,
                        "iter": it, "val_loss": best_val}, os.path.join(args.out_dir, "ckpt.pt"))
            print(f"        сохранён чекпоинт (лучший val {best_val:.4f})")
    if it == args.max_iters:
        break

    # --- один шаг оптимизации с накоплением градиента ---
    for micro in range(args.grad_accum):
        with ctx:
            _, loss = model(X, Y)
            loss = loss / args.grad_accum       # усредняем, чтобы сумма градиентов = градиент среднего
        X, Y = get_batch("train")               # следующий батч грузим, пока GPU считает backward
        scaler.scale(loss).backward()
    if args.grad_clip > 0:
        scaler.unscale_(optimizer)
        norm = torch.nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)
    scaler.step(optimizer)
    scaler.update()
    optimizer.zero_grad(set_to_none=True)

    if it % args.log_interval == 0:
        dt = time.time() - t0
        t0 = time.time()
        tok_per_s = args.batch_size * args.block_size * args.grad_accum * args.log_interval / max(dt, 1e-9)
        print(f"шаг {it:5d} | loss {loss.item() * args.grad_accum:.4f} | lr {lr:.2e} | "
              f"норма град. {float(norm) if args.grad_clip > 0 else 0:.2f} | {tok_per_s:,.0f} ток/с")
print(f"готово. лучший val loss: {best_val:.4f}. Запустите: python sample.py --out_dir {args.out_dir}")
