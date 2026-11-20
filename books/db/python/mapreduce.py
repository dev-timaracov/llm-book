"""
mapreduce.py — модель MapReduce с нуля на процессах одной машины (глава 22).

Dean & Ghemawat (2004): пользователь пишет две функции,
  map(ключ, значение)        → список промежуточных пар (k, v)
  reduce(k, [v1, v2, ...])   → результат для ключа k,
а система сама распределяет работу по машинам, перегруппировывает пары по ключу (shuffle)
и перезапускает упавшие задачи. Здесь «машины» — процессы multiprocessing:

  входные куски → M map-задач → разбиение по hash(k) mod R → R reduce-задач → результат

Запуск:  python mapreduce.py
"""
import re
import zlib
from collections import Counter, defaultdict
from multiprocessing import Pool


def partition(key, R):
    # детерминированный хеш: встроенный hash() строк в Python рандомизирован между процессами
    return zlib.crc32(key.encode()) % R


def run_map(args):
    """Одна map-задача: применить map к своему куску и разложить пары по R «корзинам» на диске."""
    chunk_id, lines, map_fn, combine_fn, R = args
    buckets = [[] for _ in range(R)]
    for line in lines:
        for k, v in map_fn(chunk_id, line):
            buckets[partition(k, R)].append((k, v))
    if combine_fn:
        # комбайнер: свернуть пары с одинаковым ключом ВНУТРИ map-задачи, до отправки по сети
        for r, b in enumerate(buckets):
            groups = defaultdict(list)
            for k, v in b:
                groups[k].append(v)
            buckets[r] = [(k, combine_fn(k, vs)) for k, vs in groups.items()]
    return buckets


def run_reduce(args):
    """Одна reduce-задача: собрать все пары своей корзины от всех map-задач (shuffle), сгруппировать, свернуть."""
    pairs, reduce_fn = args
    groups = defaultdict(list)
    for k, v in sorted(pairs):              # сортировка по ключу — как в оригинальной системе
        groups[k].append(v)
    return [(k, reduce_fn(k, vs)) for k, vs in groups.items()]


def mapreduce(lines, map_fn, reduce_fn, combine_fn=None, M=4, R=3, workers=4):
    chunks = [(i, lines[i::M], map_fn, combine_fn, R) for i in range(M)]
    with Pool(workers) as pool:
        map_out = pool.map(run_map, chunks)                                   # фаза map
        shuffled = [[p for m in map_out for p in m[r]] for r in range(R)]     # shuffle: r-я корзина каждого map
        sizes = [len(s) for s in shuffled]
        reduce_out = pool.map(run_reduce, [(s, reduce_fn) for s in shuffled]) # фаза reduce
    return dict(kv for part in reduce_out for kv in part), sizes


# ---------- задача 1: подсчёт слов ----------
def wc_map(_, line):
    for w in re.findall(r"[a-z']+", line.lower()):
        yield w, 1


def wc_reduce(_, counts):
    return sum(counts)


# ---------- задача 2: инвертированный индекс (слово → номера строк) ----------
def ii_map(_, line_with_no):
    no, line = line_with_no
    for w in set(re.findall(r"[a-z']+", line.lower())):
        yield w, no


def ii_reduce(_, nos):
    return sorted(nos)


if __name__ == "__main__":
    import os
    path = "../../gpt/python/data/input.txt"
    if os.path.exists(path):
        lines = open(path, encoding="utf-8").read().splitlines()
    else:
        lines = ["the quick brown fox jumps over the lazy dog"] * 2000 + ["to be or not to be"] * 3000
    print(f"строк на входе: {len(lines):,}")

    counts, sizes = mapreduce(lines, wc_map, wc_reduce)
    expected = Counter(w for l in lines for w in re.findall(r"[a-z']+", l.lower()))
    assert counts == dict(expected), "MapReduce должен совпасть с Counter"
    print(f"подсчёт слов: {len(counts):,} разных слов; пар в shuffle по reduce-задачам: {sizes} (всего {sum(sizes):,})")
    print("  топ-5:", sorted(counts.items(), key=lambda kv: -kv[1])[:5])

    counts2, sizes2 = mapreduce(lines, wc_map, wc_reduce, combine_fn=wc_reduce)   # сумма ассоциативна — reduce годится как комбайнер
    assert counts2 == counts
    print(f"с комбайнером: пар в shuffle {sum(sizes2):,} — в {sum(sizes) / sum(sizes2):.1f} раза меньше трафика")

    index, _ = mapreduce(list(enumerate(lines)), ii_map, ii_reduce)
    w = "romeo" if "romeo" in index else next(iter(index))
    print(f"инвертированный индекс: «{w}» встречается в {len(index[w])} строках, первые: {index[w][:5]}")
    print("результаты совпадают с однопоточным подсчётом ✓")
