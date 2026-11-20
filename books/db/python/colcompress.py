"""
colcompress.py — лёгкие схемы сжатия колонок с нуля (глава 5).

Колоночные СУБД хранят однородные значения подряд, и их можно сжимать специальными схемами,
которые быстрее универсальных архиваторов и часто позволяют работать с данными без распаковки
(Abadi и др., 2006):
  * RLE (run-length encoding)   — (значение, длина серии); для отсортированных колонок с повторами
  * словарь (dictionary)        — строки → маленькие целые коды
  * упаковка бит (bit-packing)  — каждое число занимает ровно столько бит, сколько нужно максимуму
  * FOR (frame of reference)    — вычесть минимум блока, остаток упаковать в биты
  * дельта (delta)              — хранить разности соседей; для отсортированных/времени
Для сравнения — универсальный zlib.

Запуск:  python colcompress.py
"""
import random
import struct
import zlib


def bits_needed(x):
    return max(1, int(x).bit_length())


# ---------- упаковка бит ----------
def bitpack(values, width):
    acc, nbits, out = 0, 0, bytearray()
    for v in values:
        acc |= v << nbits
        nbits += width
        while nbits >= 8:
            out.append(acc & 0xFF)
            acc >>= 8
            nbits -= 8
    if nbits:
        out.append(acc & 0xFF)
    return bytes(out)


def bitunpack(data, width, n):
    acc, nbits, out, it = 0, 0, [], iter(data)
    mask = (1 << width) - 1
    while len(out) < n:
        while nbits < width:
            acc |= next(it) << nbits
            nbits += 8
        out.append(acc & mask)
        acc >>= width
        nbits -= width
    return out


# ---------- схемы ----------
def enc_plain(col):
    if isinstance(col[0], str):
        return b"".join(struct.pack("<H", len(s.encode())) + s.encode() for s in col)
    return struct.pack(f"<{len(col)}q", *col)


def enc_rle(col):
    runs = []
    for v in col:
        if runs and runs[-1][0] == v:
            runs[-1][1] += 1
        else:
            runs.append([v, 1])
    return runs


def dec_rle(runs):
    return [v for v, n in runs for _ in range(n)]


def size_rle(runs, value_size):
    return len(runs) * (value_size + 4)       # значение + 4-байтовая длина серии


def enc_dict(col):
    dictionary = sorted(set(col))             # отсортированный словарь сохраняет порядок: можно сравнивать коды
    code = {v: i for i, v in enumerate(dictionary)}
    width = bits_needed(len(dictionary) - 1)
    return dictionary, width, bitpack([code[v] for v in col], width)


def dec_dict(enc, n):
    dictionary, width, packed = enc
    return [dictionary[c] for c in bitunpack(packed, width, n)]


def enc_for(col, block=1024):
    """Frame of reference поблочно: (минимум, ширина, упакованные смещения)."""
    blocks = []
    for i in range(0, len(col), block):
        b = col[i:i + block]
        lo = min(b)
        width = bits_needed(max(b) - lo)
        blocks.append((lo, width, len(b), bitpack([v - lo for v in b], width)))
    return blocks


def dec_for(blocks):
    return [lo + d for lo, w, n, p in blocks for d in bitunpack(p, w, n)]


def size_for(blocks):
    return sum(8 + 1 + 2 + len(p) for _, _, _, p in blocks)


def enc_delta(col):
    """Первое значение + разности, разности сжимаем FOR (отрицательные тоже работают — минимум вычитается)."""
    deltas = [col[i] - col[i - 1] for i in range(1, len(col))]
    return col[0], enc_for(deltas)


def dec_delta(enc):
    first, blocks = enc
    out = [first]
    for d in dec_for(blocks):
        out.append(out[-1] + d)
    return out


def report(name, col):
    n = len(col)
    plain = len(enc_plain(col))
    rows = [("без сжатия", plain)]
    rows.append(("zlib (универсальный)", len(zlib.compress(enc_plain(col), 6))))
    vsize = 8 if isinstance(col[0], int) else sum(len(s.encode()) + 2 for s in col) / n
    r = enc_rle(col); assert dec_rle(r) == col
    rows.append(("RLE", size_rle(r, vsize)))
    d = enc_dict(col); assert dec_dict(d, n) == col
    rows.append(("словарь + биты", sum(len(s.encode()) + 2 if isinstance(s, str) else 8 for s in d[0]) + len(d[2])))
    if isinstance(col[0], int):
        f = enc_for(col); assert dec_for(f) == col
        rows.append(("FOR + биты", size_for(f)))
        de = enc_delta(col); assert dec_delta(de) == col
        rows.append(("дельта + FOR", 8 + size_for(de[1])))
    print(f"\n{name} ({n:,} значений)")
    best = min(s for _, s in rows[1:])
    for label, s in rows:
        mark = "  ← лучший" if s == best and label != "без сжатия" else ""
        print(f"  {label:22s} {s:>10,.0f} байт   ×{plain / s:6.1f}{mark}")


if __name__ == "__main__":
    random.seed(7)
    N = 100_000
    # 1) время событий: возрастает, шаг почти постоянный
    t, ts = 1_700_000_000_000, []
    for _ in range(N):
        t += random.choice([1000, 1000, 1000, 999, 1001])
        ts.append(t)
    report("метка времени (мс), отсортирована", ts)
    # 2) страна: мало различных значений, данные отсортированы по стране (как после ORDER BY)
    countries = sorted(random.choices(["RU", "KZ", "BY", "UZ", "AM", "GE", "DE", "US"], weights=[50, 10, 8, 8, 5, 5, 7, 7], k=N))
    report("страна (отсортирована)", countries)
    # 3) та же колонка, но в случайном порядке — RLE бесполезен, словарь работает
    random.shuffle(countries)
    report("страна (вперемешку)", countries)
    # 4) цена товара: небольшие числа
    report("цена, 100..5000", [random.randint(100, 5000) for _ in range(N)])
    # 5) случайные 64-битные хеши — сжать почти нельзя
    report("случайные хеши", [random.getrandbits(62) for _ in range(N)])
