"""
sample.py — генерация текста обученной моделью.

Глава 15 учебника.
  python sample.py --start "ROMEO:" --num_tokens 500 --temperature 0.8 --top_k 40
"""
import argparse
import os

import torch

from bpe import BPETokenizer
from model import GPT, GPTConfig

p = argparse.ArgumentParser()
p.add_argument("--out_dir", default="out")
p.add_argument("--data_dir", default="data")
p.add_argument("--start", default="\n", help="затравка (prompt)")
p.add_argument("--num_samples", type=int, default=2)
p.add_argument("--num_tokens", type=int, default=500)
p.add_argument("--temperature", type=float, default=0.8)
p.add_argument("--top_k", type=int, default=None)
p.add_argument("--top_p", type=float, default=None)
p.add_argument("--seed", type=int, default=42)
p.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
args = p.parse_args()

torch.manual_seed(args.seed)
ckpt = torch.load(os.path.join(args.out_dir, "ckpt.pt"), map_location=args.device, weights_only=False)
model = GPT(GPTConfig(**ckpt["config"]))
model.load_state_dict(ckpt["model"])
model.eval().to(args.device)
meta = ckpt["meta"]
print(f"загружен чекпоинт: шаг {ckpt['iter']}, val loss {ckpt['val_loss']:.4f}")

if meta["tokenizer"] == "char":
    itos = meta["itos"]
    stoi = {c: i for i, c in enumerate(itos)}
    encode = lambda s: [stoi[c] for c in s if c in stoi]
    decode = lambda ids: "".join(itos[i] for i in ids)
else:
    tok = BPETokenizer.load(os.path.join(args.data_dir, meta["path"]))
    encode, decode = tok.encode, tok.decode

start_ids = encode(args.start) or [0]
x = torch.tensor([start_ids], dtype=torch.long, device=args.device)
for k in range(args.num_samples):
    y = model.generate(x, args.num_tokens, temperature=args.temperature, top_k=args.top_k, top_p=args.top_p)
    print(f"---------------- образец {k + 1} ----------------")
    print(decode(y[0].tolist()))
