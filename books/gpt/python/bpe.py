"""
bpe.py — байтовый BPE-токенизатор (Byte Pair Encoding) с нуля.

Глава 8 учебника. Алгоритм BPE придуман для сжатия данных (Gage, 1994) и перенесён
в NLP Sennrich и др. (2016). GPT-2 (Radford и др., 2019) применяет его к БАЙТАМ UTF-8:
базовый словарь — 256 байтов, поэтому любой текст на любом языке кодируется без <unk>.

Обучение:
  1. текст → байты (числа 0..255)
  2. найти самую частую соседнюю пару (a, b)
  3. завести новый токен id = 256 + k, заменить все (a, b) на него
  4. повторять, пока словарь не достигнет нужного размера

Перед обучением текст режется регулярным выражением на «куски» (слова, числа,
пунктуация), и пары не склеиваются через границы кусков — так делает GPT-2,
чтобы не получались токены вроде «собака.» с точкой внутри.

Запуск:  python bpe.py data/input.txt 512    → сохранит data/tokenizer.json
"""
import json
import re
import sys
from collections import Counter

# Упрощённый вариант регулярки GPT-2 (в оригинале используется модуль `regex` с \p{L}).
# \w в Python по умолчанию понимает Юникод, так что кириллица работает.
SPLIT_PATTERN = re.compile(r"""'s|'t|'re|'ve|'m|'ll|'d| ?[^\W\d_]+| ?\d{1,3}| ?[^\s\w]+|\s+(?!\S)|\s+""")


def get_pair_counts(chunks):
    """chunks: dict {кортеж токенов: сколько раз этот кусок встретился}"""
    counts = Counter()
    for ids, freq in chunks.items():
        for a, b in zip(ids, ids[1:]):
            counts[(a, b)] += freq
    return counts


def merge(ids, pair, new_id):
    """Заменить все вхождения пары pair в списке ids на new_id."""
    out, i = [], 0
    while i < len(ids):
        if i < len(ids) - 1 and ids[i] == pair[0] and ids[i + 1] == pair[1]:
            out.append(new_id)
            i += 2
        else:
            out.append(ids[i])
            i += 1
    return out


class BPETokenizer:
    def __init__(self):
        self.merges = {}                                   # (a, b) -> new_id, в порядке обучения
        self.vocab = {i: bytes([i]) for i in range(256)}   # id -> байты

    def train(self, text, vocab_size, verbose=False):
        assert vocab_size >= 256
        # считаем уникальные куски один раз — это ускоряет обучение в десятки раз
        chunk_counts = Counter(SPLIT_PATTERN.findall(text))
        chunks = {tuple(c.encode("utf-8")): f for c, f in chunk_counts.items()}
        for k in range(vocab_size - 256):
            counts = get_pair_counts(chunks)
            if not counts:
                break
            pair = max(counts, key=counts.get)
            new_id = 256 + k
            chunks = {tuple(merge(list(ids), pair, new_id)): f for ids, f in chunks.items()}
            self.merges[pair] = new_id
            self.vocab[new_id] = self.vocab[pair[0]] + self.vocab[pair[1]]
            if verbose and (k < 20 or k % 100 == 0):
                print(f"слияние {k + 1}: {pair} -> {new_id} {self.vocab[new_id]!r} (встречается {counts[pair]} раз)")

    def _encode_chunk(self, ids):
        while len(ids) >= 2:
            # из всех соседних пар выбираем ту, что была выучена РАНЬШЕ всех (меньший id)
            pairs = set(zip(ids, ids[1:]))
            pair = min(pairs, key=lambda p: self.merges.get(p, float("inf")))
            if pair not in self.merges:
                break
            ids = merge(ids, pair, self.merges[pair])
        return ids

    def encode(self, text):
        out = []
        for chunk in SPLIT_PATTERN.findall(text):
            out.extend(self._encode_chunk(list(chunk.encode("utf-8"))))
        return out

    def decode(self, ids):
        # errors="replace": модель может сгенерировать неполную UTF-8 последовательность
        return b"".join(self.vocab[i] for i in ids).decode("utf-8", errors="replace")

    @property
    def vocab_size(self):
        return len(self.vocab)

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"merges": [[a, b, i] for (a, b), i in self.merges.items()]}, f)

    @classmethod
    def load(cls, path):
        tok = cls()
        with open(path, encoding="utf-8") as f:
            for a, b, i in json.load(f)["merges"]:
                tok.merges[(a, b)] = i
                tok.vocab[i] = tok.vocab[a] + tok.vocab[b]
        return tok


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "data/input.txt"
    size = int(sys.argv[2]) if len(sys.argv) > 2 else 512
    text = open(path, encoding="utf-8").read()
    tok = BPETokenizer()
    tok.train(text, size, verbose=True)
    sample = text[:200]
    ids = tok.encode(sample)
    assert tok.decode(ids) == sample, "decode(encode(x)) должен возвращать x"
    print(f"\n{len(sample.encode('utf-8'))} байт → {len(ids)} токенов "
          f"(сжатие в {len(sample.encode('utf-8')) / len(ids):.2f} раза)")
    out = path.rsplit("/", 1)[0] + "/tokenizer.json" if "/" in path else "tokenizer.json"
    tok.save(out)
    print("сохранено в", out)
