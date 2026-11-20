"""
extsort.py — внешняя сортировка слиянием (глава 9).

Данных больше, чем памяти: в памяти помещается только MEMORY записей. Алгоритм:
  1. Генерация прогонов (runs): читаем вход порциями, сортируем в памяти, пишем отсортированные
     файлы-прогоны. Вариант «замещающий выбор» (replacement selection, Кнут, TAOCP т. 3)
     на случайных данных даёт прогоны в среднем в 2 раза длиннее памяти.
  2. Слияние: k-путевое слияние прогонов через кучу; k ограничено числом буферов (fan-in).
     Если прогонов больше k — несколько проходов.

Стоимость в записях ввода-вывода: 2N · (1 + ⌈log_k(число прогонов)⌉) — каждый проход читает
и пишет все данные. Так сортируют ORDER BY, CREATE INDEX, sort-merge join в любой СУБД
(обзор техник — Graefe, 2006).

Запуск:  python extsort.py
"""
import heapq
import os
import random
import shutil
import struct

REC = struct.Struct("<q")      # запись = одно 8-байтовое целое


class IO:
    reads = writes = 0


def write_file(path, values):
    with open(path, "wb") as f:
        for v in values:
            f.write(REC.pack(v))
            IO.writes += 1


def read_file(path):
    with open(path, "rb") as f:
        while chunk := f.read(REC.size * 4096):
            for (v,) in REC.iter_unpack(chunk):
                IO.reads += 1
                yield v


def runs_simple(src, memory, tmp):
    """Прогоны длины ровно memory: прочитать порцию, отсортировать, записать."""
    runs, buf = [], []
    for v in read_file(src):
        buf.append(v)
        if len(buf) == memory:
            runs.append(_flush_run(sorted(buf), tmp, len(runs)))
            buf = []
    if buf:
        runs.append(_flush_run(sorted(buf), tmp, len(runs)))
    return runs


def runs_replacement_selection(src, memory, tmp):
    """Замещающий выбор: куча из memory элементов; вынимаем минимум в текущий прогон, на его место
    читаем следующий элемент. Если новый элемент меньше только что записанного, он «ждёт» следующего
    прогона. На случайных данных средняя длина прогона ≈ 2·memory."""
    it = read_file(src)
    heap = []
    for v in it:
        heap.append((0, v))           # (номер прогона, значение)
        if len(heap) == memory:
            break
    heapq.heapify(heap)
    runs, current, out, last = [], 0, [], None
    while heap:
        run_no, v = heapq.heappop(heap)
        if run_no != current:          # все элементы текущего прогона кончились
            runs.append(_flush_run(out, tmp, len(runs)))
            out, current = [], run_no
        out.append(v)
        last = v
        nxt = next(it, None)
        if nxt is not None:
            heapq.heappush(heap, (current if nxt >= last else current + 1, nxt))
    if out:
        runs.append(_flush_run(out, tmp, len(runs)))
    return runs


def _flush_run(values, tmp, i):
    path = os.path.join(tmp, f"run_{i:05d}.bin")
    write_file(path, values)
    return path


def merge_all(runs, fan_in, tmp, dst):
    """Многопроходное k-путевое слияние."""
    passes, gen = 0, 0
    while len(runs) > 1:
        passes += 1
        new_runs = []
        for i in range(0, len(runs), fan_in):
            group = runs[i:i + fan_in]
            path = os.path.join(tmp, f"merge_{gen}_{i}.bin")
            write_file(path, heapq.merge(*(read_file(r) for r in group)))
            new_runs.append(path)
            for r in group:
                os.remove(r)
        runs, gen = new_runs, gen + 1
    shutil.move(runs[0], dst)
    return passes


def external_sort(src, dst, memory, fan_in, replacement=False, tmp="data/extsort_tmp"):
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    IO.reads = IO.writes = 0
    runs = (runs_replacement_selection if replacement else runs_simple)(src, memory, tmp)
    n_runs = len(runs)
    passes = merge_all(runs, fan_in, tmp, dst)
    shutil.rmtree(tmp, ignore_errors=True)
    return n_runs, passes


if __name__ == "__main__":
    import math
    random.seed(42)
    os.makedirs("data", exist_ok=True)
    N, MEMORY, FAN_IN = 200_000, 2_000, 8
    data = [random.randrange(10**9) for _ in range(N)]
    write_file("data/input.bin", data)
    expected = sorted(data)

    for replacement in (False, True):
        n_runs, passes = external_sort("data/input.bin", "data/sorted.bin", MEMORY, FAN_IN, replacement)
        IO.reads = 0
        got = list(read_file("data/sorted.bin"))
        assert got == expected, "результат должен совпадать с sorted()"
        IO.reads = IO.writes = 0
        n_runs2, passes2 = external_sort("data/input.bin", "data/sorted.bin", MEMORY, FAN_IN, replacement)
        total = IO.reads + IO.writes
        formula = 2 * N * (1 + math.ceil(math.log(n_runs, FAN_IN)))
        name = "замещающий выбор" if replacement else "простые прогоны"
        print(f"{name:17s}: прогонов {n_runs:4d} (средняя длина {N / n_runs:7.0f}), проходов слияния {passes}, "
              f"чтений+записей {total:,} (формула 2N·(1+⌈log_k прогонов⌉) = {formula:,})")
    print("результат совпадает с sorted() ✓")
