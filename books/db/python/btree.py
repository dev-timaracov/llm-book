"""
btree.py — B+-дерево с нуля (глава 3).

B-дерево предложили Байер и Маккрейт (1972); вариант B+, где все значения лежат
в листьях, а листья связаны в список, описан у Комера (1979, «The Ubiquitous B-Tree»).
Именно B+-деревья — индекс по умолчанию в PostgreSQL, MySQL/InnoDB, SQLite, Oracle.

Свойства, которые проверяет этот файл:
  * каждый узел, кроме корня, заполнен не меньше чем наполовину;
  * все листья на одной глубине → поиск за O(log_B N) чтений страниц;
  * ключи в листьях отсортированы и связаны → диапазонный запрос = спуск + проход по листьям.

Запуск:  python btree.py
"""
import bisect
import random


class Node:
    def __init__(self, leaf):
        self.leaf = leaf
        self.keys = []        # во внутреннем узле: разделители; в листе: ключи
        self.children = []    # только во внутреннем узле: len(children) == len(keys) + 1
        self.values = []      # только в листе
        self.next = None      # только в листе: ссылка на соседний лист справа


class BPlusTree:
    def __init__(self, order=4):
        assert order >= 3
        self.order = order            # максимум детей во внутреннем узле (= ключей в листе)
        self.root = Node(leaf=True)
        self.page_reads = 0           # сколько узлов («страниц») прочитали — главная метрика стоимости

    # ---------- поиск ----------
    def _find_leaf(self, key):
        node = self.root
        self.page_reads += 1
        while not node.leaf:
            # bisect_right: ключ, равный разделителю, идёт в правое поддерево
            node = node.children[bisect.bisect_right(node.keys, key)]
            self.page_reads += 1
        return node

    def get(self, key):
        leaf = self._find_leaf(key)
        i = bisect.bisect_left(leaf.keys, key)
        if i < len(leaf.keys) and leaf.keys[i] == key:
            return leaf.values[i]
        return None

    def range(self, lo, hi):
        """Все пары с lo <= key < hi: один спуск по дереву + проход по связанным листьям."""
        leaf = self._find_leaf(lo)
        i = bisect.bisect_left(leaf.keys, lo)
        while leaf is not None:
            while i < len(leaf.keys):
                if leaf.keys[i] >= hi:
                    return
                yield leaf.keys[i], leaf.values[i]
                i += 1
            leaf, i = leaf.next, 0
            if leaf is not None:
                self.page_reads += 1

    # ---------- вставка ----------
    def insert(self, key, value):
        split = self._insert(self.root, key, value)
        if split is not None:                     # корень раскололся → дерево растёт ВВЕРХ
            sep, right = split
            new_root = Node(leaf=False)
            new_root.keys = [sep]
            new_root.children = [self.root, right]
            self.root = new_root

    def _insert(self, node, key, value):
        """Вставляет в поддерево; если узел переполнился — делит его и возвращает (разделитель, правый узел)."""
        if node.leaf:
            i = bisect.bisect_left(node.keys, key)
            if i < len(node.keys) and node.keys[i] == key:
                node.values[i] = value            # ключ уже есть — обновляем значение
                return None
            node.keys.insert(i, key)
            node.values.insert(i, value)
            if len(node.keys) < self.order:
                return None
            # деление листа: правая половина уходит в новый лист, КОПИЯ первого ключа — наверх
            mid = len(node.keys) // 2
            right = Node(leaf=True)
            right.keys, node.keys = node.keys[mid:], node.keys[:mid]
            right.values, node.values = node.values[mid:], node.values[:mid]
            right.next, node.next = node.next, right
            return right.keys[0], right

        i = bisect.bisect_right(node.keys, key)
        split = self._insert(node.children[i], key, value)
        if split is None:
            return None
        sep, right_child = split
        node.keys.insert(i, sep)
        node.children.insert(i + 1, right_child)
        if len(node.children) <= self.order:
            return None
        # деление внутреннего узла: средний ключ ПОДНИМАЕТСЯ наверх (не копируется)
        mid = len(node.keys) // 2
        up = node.keys[mid]
        right = Node(leaf=False)
        right.keys, node.keys = node.keys[mid + 1:], node.keys[:mid]
        right.children, node.children = node.children[mid + 1:], node.children[:mid + 1]
        return up, right

    # ---------- проверка инвариантов ----------
    def height(self):
        h, node = 1, self.root
        while not node.leaf:
            node, h = node.children[0], h + 1
        return h

    def check(self):
        leaf_depths = set()

        def walk(node, lo, hi, depth):
            assert node.keys == sorted(node.keys), "ключи в узле должны быть отсортированы"
            for k in node.keys:
                assert (lo is None or k >= lo) and (hi is None or k < hi), "ключ вне диапазона родителя"
            if node is not self.root:
                min_fill = (self.order // 2) if node.leaf else (self.order + 1) // 2
                size = len(node.keys) if node.leaf else len(node.children)
                assert size >= min_fill, f"узел заполнен меньше чем наполовину: {size} < {min_fill}"
            if node.leaf:
                leaf_depths.add(depth)
                return
            assert len(node.children) == len(node.keys) + 1
            bounds = [lo] + node.keys + [hi]
            for j, child in enumerate(node.children):
                walk(child, bounds[j], bounds[j + 1], depth + 1)

        walk(self.root, None, None, 0)
        assert len(leaf_depths) == 1, "все листья должны быть на одной глубине"


if __name__ == "__main__":
    random.seed(0)
    t = BPlusTree(order=4)
    keys = random.sample(range(10_000), 2_000)
    for k in keys:
        t.insert(k, f"row-{k}")
        t.check()
    assert all(t.get(k) == f"row-{k}" for k in keys)
    assert t.get(-1) is None
    got = [k for k, _ in t.range(100, 200)]
    assert got == sorted(k for k in keys if 100 <= k < 200)
    print(f"order=4: {len(keys)} ключей, высота {t.height()}; инварианты выполняются")

    # Почему в реальных БД «порядок» — сотни: страница 8 КБ вмещает ~400 ключей с указателями.
    for order in (4, 16, 128, 400):
        t = BPlusTree(order=order)
        for k in range(1_000_000 if order >= 128 else 100_000):
            t.insert(k, None)
        t.page_reads = 0
        for k in random.sample(range(100_000), 1000):
            t.get(k)
        print(f"order={order:4d}: высота {t.height()}, чтений страниц на поиск: {t.page_reads / 1000:.1f}")
