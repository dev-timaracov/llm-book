"""
prepare.py — готовим данные: текст → токены → бинарные файлы train.bin / val.bin.

Глава 14 учебника.

Примеры:
  python prepare.py                                  # скачать Tiny Shakespeare, символьный токенизатор
  python prepare.py --input мой_текст.txt            # свой текст (любой язык, UTF-8)
  python prepare.py --input мой_текст.txt --tokenizer bpe --vocab_size 2048

Результат в папке data/: train.bin, val.bin (uint16), meta.json (+ tokenizer.json для BPE).
"""
import argparse
import json
import os
import urllib.request

import numpy as np

from bpe import BPETokenizer

SHAKESPEARE_URL = "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt"

p = argparse.ArgumentParser()
p.add_argument("--input", default=None, help="путь к .txt; по умолчанию скачивается Tiny Shakespeare")
p.add_argument("--out_dir", default="data")
p.add_argument("--tokenizer", choices=["char", "bpe"], default="char")
p.add_argument("--vocab_size", type=int, default=1024, help="только для BPE")
p.add_argument("--val_fraction", type=float, default=0.1)
args = p.parse_args()

os.makedirs(args.out_dir, exist_ok=True)
if args.input is None:
    args.input = os.path.join(args.out_dir, "input.txt")
    if not os.path.exists(args.input):
        print("скачиваю Tiny Shakespeare (Karpathy, 2015)...")
        urllib.request.urlretrieve(SHAKESPEARE_URL, args.input)

text = open(args.input, encoding="utf-8").read()
print(f"длина текста: {len(text):,} символов")

if args.tokenizer == "char":
    chars = sorted(set(text))
    stoi = {c: i for i, c in enumerate(chars)}
    ids = [stoi[c] for c in text]
    meta = {"tokenizer": "char", "vocab_size": len(chars), "itos": chars}
else:
    tok = BPETokenizer()
    tok.train(text, args.vocab_size, verbose=True)
    tok_path = os.path.join(args.out_dir, "tokenizer.json")
    tok.save(tok_path)
    ids = tok.encode(text)
    meta = {"tokenizer": "bpe", "vocab_size": tok.vocab_size, "path": "tokenizer.json"}

assert meta["vocab_size"] < 2 ** 16, "uint16 вмещает словарь до 65535 токенов"
ids = np.array(ids, dtype=np.uint16)
n_val = int(len(ids) * args.val_fraction)
# валидация — последний кусок текста: так модель проверяется на тексте, которого не видела
train_ids, val_ids = ids[:-n_val], ids[-n_val:]
train_ids.tofile(os.path.join(args.out_dir, "train.bin"))
val_ids.tofile(os.path.join(args.out_dir, "val.bin"))
with open(os.path.join(args.out_dir, "meta.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False)
print(f"словарь: {meta['vocab_size']} токенов; train: {len(train_ids):,} токенов; val: {len(val_ids):,} токенов")
