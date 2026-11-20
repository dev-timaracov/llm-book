"""
vector_index.py — векторный поиск ближайших соседей с нуля (глава 20).

  * точный поиск (flat): сравнить запрос со всеми N векторами — O(N·d), полнота 100%;
  * IVF (inverted file): k-means делит пространство на nlist ячеек; поиск смотрит только
    nprobe ближайших ячеек. Меньше вычислений расстояний — ценой потери части соседей.
    Так устроен индекс IVF в FAISS (Johnson, Douze, Jégou, 2019); HNSW (Malkov & Yashunin)
    решает ту же задачу графом.

Метрика качества — recall@k: какая доля настоящих k ближайших соседей найдена.

Запуск:  python vector_index.py
"""
import heapq
import math
import random


def dist2(a, b):
    return sum((x - y) * (x - y) for x, y in zip(a, b))


class Flat:
    def __init__(self, vectors):
        self.v = vectors
        self.computed = 0

    def search(self, q, k):
        self.computed += len(self.v)
        return [i for _, i in heapq.nsmallest(k, ((dist2(q, x), i) for i, x in enumerate(self.v)))]


class IVF:
    def __init__(self, vectors, nlist, iters=6, seed=0):
        rnd = random.Random(seed)
        self.v = vectors
        d = len(vectors[0])
        self.centroids = [list(c) for c in rnd.sample(vectors, nlist)]
        for _ in range(iters):                          # k-means (алгоритм Ллойда)
            buckets = [[] for _ in range(nlist)]
            for i, x in enumerate(vectors):
                buckets[min(range(nlist), key=lambda c: dist2(x, self.centroids[c]))].append(i)
            for c, b in enumerate(buckets):
                if b:
                    self.centroids[c] = [sum(vectors[i][j] for i in b) / len(b) for j in range(d)]
        self.lists = [[] for _ in range(nlist)]         # «инвертированные списки»: ячейка → её векторы
        for i, x in enumerate(vectors):
            self.lists[min(range(nlist), key=lambda c: dist2(x, self.centroids[c]))].append(i)
        self.computed = 0

    def search(self, q, k, nprobe):
        cells = heapq.nsmallest(nprobe, range(len(self.centroids)), key=lambda c: dist2(q, self.centroids[c]))
        self.computed += len(self.centroids)
        cand = [i for c in cells for i in self.lists[c]]
        self.computed += len(cand)
        return [i for _, i in heapq.nsmallest(k, ((dist2(q, self.v[i]), i) for i in cand))]


if __name__ == "__main__":
    random.seed(1)
    D, N, CLUSTERS = 16, 5000, 50
    centers = [[random.gauss(0, 1) for _ in range(D)] for _ in range(CLUSTERS)]
    def sample():
        c = random.choice(centers)
        return [x + random.gauss(0, 0.9) for x in c]
    data = [sample() for _ in range(N)]
    queries = [sample() for _ in range(100)]
    K = 10

    flat = Flat(data)
    truth = [set(flat.search(q, K)) for q in queries]
    print(f"точный поиск: {flat.computed / len(queries):,.0f} вычислений расстояния на запрос, recall@{K} = 100%")

    ivf = IVF(data, nlist=64)
    sizes = [len(l) for l in ivf.lists]
    print(f"IVF: 64 ячейки, в ячейке от {min(sizes)} до {max(sizes)} векторов")
    for nprobe in (1, 2, 4, 8, 16):
        ivf.computed = 0
        rec = sum(len(set(ivf.search(q, K, nprobe)) & t) for q, t in zip(queries, truth)) / (K * len(queries))
        print(f"  nprobe={nprobe:2d}: {ivf.computed / len(queries):6,.0f} вычислений на запрос "
              f"({100 * ivf.computed / len(queries) / N:4.1f}% от точного), recall@{K} = {100 * rec:5.1f}%")
