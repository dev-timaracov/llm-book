"""
query.py — движок выполнения запросов в модели итераторов (Volcano) с нуля (главы 8–10).

Модель Volcano (Graefe, 1994): каждый оператор плана — итератор с методом next().
Корень плана тянет строки из детей, те — из своих детей, и так до сканирования таблиц.
Так исполняются запросы в PostgreSQL, MySQL, SQLite, Oracle и многих других СУБД.

Здесь реализованы: Scan, Filter, Project, NestedLoopJoin, HashJoin, SortMergeJoin,
Sort, HashAggregate, Limit — и счётчики работы, чтобы сравнить алгоритмы соединения.

Запуск:  python query.py
"""
import random
from collections import defaultdict


class Operator:
    """Базовый итератор. Python-генераторы делают open/next/close за нас: __iter__ — это open+next."""
    name = "?"
    children = ()

    def explain(self, depth=0):
        line = "  " * depth + "-> " + self.describe()
        return "\n".join([line] + [c.explain(depth + 1) for c in self.children])

    def describe(self):
        return self.name


class Scan(Operator):
    name = "Seq Scan"

    def __init__(self, table_name, rows):
        self.table_name, self.rows = table_name, rows

    def __iter__(self):
        for row in self.rows:
            # префиксуем столбцы именем таблицы, как SQL: users.id
            yield {f"{self.table_name}.{k}": v for k, v in row.items()}

    def describe(self):
        return f"Seq Scan on {self.table_name} ({len(self.rows)} строк)"


class Filter(Operator):
    name = "Filter"

    def __init__(self, child, predicate, text):
        self.children, self.pred, self.text = (child,), predicate, text

    def __iter__(self):
        return (row for row in self.children[0] if self.pred(row))

    def describe(self):
        return f"Filter: {self.text}"


class Project(Operator):
    def __init__(self, child, columns):
        self.children, self.columns = (child,), columns

    def __iter__(self):
        for row in self.children[0]:
            yield {c: row[c] for c in self.columns}

    def describe(self):
        return f"Project: {', '.join(self.columns)}"


class Limit(Operator):
    def __init__(self, child, n):
        self.children, self.n = (child,), n

    def __iter__(self):
        # «ленивость» модели итераторов: после n строк дети просто перестают вызываться
        for i, row in enumerate(self.children[0]):
            if i >= self.n:
                return
            yield row

    def describe(self):
        return f"Limit {self.n}"


class NestedLoopJoin(Operator):
    """Для каждой строки слева перебираем ВСЕ строки справа: O(|L|·|R|) сравнений."""

    def __init__(self, left, right, lkey, rkey):
        self.children, self.lkey, self.rkey = (left, right), lkey, rkey
        self.comparisons = 0

    def __iter__(self):
        right_rows = list(self.children[1])      # материализуем внутреннюю сторону
        for l in self.children[0]:
            for r in right_rows:
                self.comparisons += 1
                if l[self.lkey] == r[self.rkey]:
                    yield {**l, **r}

    def describe(self):
        return f"Nested Loop Join on {self.lkey} = {self.rkey}"


class HashJoin(Operator):
    """Строим хеш-таблицу по меньшей (правой) стороне, затем «зондируем» её строками левой: O(|L|+|R|)."""

    def __init__(self, left, right, lkey, rkey):
        self.children, self.lkey, self.rkey = (left, right), lkey, rkey
        self.comparisons = 0

    def __iter__(self):
        table = defaultdict(list)
        for r in self.children[1]:               # фаза build
            table[r[self.rkey]].append(r)
        for l in self.children[0]:               # фаза probe: один поиск в хеш-таблице на строку
            self.comparisons += 1
            for r in table.get(l[self.lkey], ()):
                yield {**l, **r}

    def describe(self):
        return f"Hash Join on {self.lkey} = {self.rkey}"


class SortMergeJoin(Operator):
    """Сортируем обе стороны по ключу и идём по ним двумя указателями: O(|L| log|L| + |R| log|R|)."""

    def __init__(self, left, right, lkey, rkey):
        self.children, self.lkey, self.rkey = (left, right), lkey, rkey
        self.comparisons = 0

    def __iter__(self):
        L = sorted(self.children[0], key=lambda r: r[self.lkey])
        R = sorted(self.children[1], key=lambda r: r[self.rkey])
        i = j = 0
        while i < len(L) and j < len(R):
            self.comparisons += 1
            a, b = L[i][self.lkey], R[j][self.rkey]
            if a < b:
                i += 1
            elif a > b:
                j += 1
            else:
                j0 = j                           # группа одинаковых ключей справа
                while j < len(R) and R[j][self.rkey] == a:
                    yield {**L[i], **R[j]}
                    j += 1
                i += 1
                if i < len(L) and L[i][self.lkey] == a:
                    j = j0                       # следующая левая строка с тем же ключом — повторить группу

    def describe(self):
        return f"Merge Join on {self.lkey} = {self.rkey}"


class Sort(Operator):
    def __init__(self, child, key, desc=False):
        self.children, self.key, self.desc = (child,), key, desc

    def __iter__(self):
        # Sort — «блокирующий» оператор: не может выдать первую строку, не прочитав все
        return iter(sorted(self.children[0], key=lambda r: r[self.key], reverse=self.desc))

    def describe(self):
        return f"Sort by {self.key}{' DESC' if self.desc else ''}"


class HashAggregate(Operator):
    def __init__(self, child, group_by, aggs):
        """aggs: {имя_выхода: (функция, столбец)}, функция ∈ count, sum, avg, max, min"""
        self.children, self.group_by, self.aggs = (child,), group_by, aggs

    def __iter__(self):
        groups = defaultdict(list)
        for row in self.children[0]:
            groups[row[self.group_by]].append(row)
        for g, rows in groups.items():
            out = {self.group_by: g}
            for name, (fn, col) in self.aggs.items():
                vals = [r[col] for r in rows]
                out[name] = {"count": len(vals), "sum": sum(vals), "avg": sum(vals) / len(vals),
                             "max": max(vals), "min": min(vals)}[fn]
            yield out

    def describe(self):
        return f"HashAggregate by {self.group_by}: " + ", ".join(f"{f}({c})" for f, c in self.aggs.values())


if __name__ == "__main__":
    random.seed(0)
    cities = ["Москва", "Казань", "Пермь", "Томск", "Самара"]
    users = [{"id": i, "city": random.choice(cities), "age": random.randint(18, 70)} for i in range(2000)]
    orders = [{"id": i, "user_id": random.randrange(2000), "amount": random.randint(100, 5000)} for i in range(5000)]

    # SELECT u.city, count(*), sum(o.amount) FROM users u JOIN orders o ON o.user_id = u.id
    # WHERE u.age < 30 GROUP BY u.city ORDER BY sum DESC LIMIT 3
    def plan(join_cls):
        young = Filter(Scan("users", users), lambda r: r["users.age"] < 30, "users.age < 30")
        j = join_cls(Scan("orders", orders), young, "orders.user_id", "users.id")
        agg = HashAggregate(j, "users.city", {"n": ("count", "orders.id"), "total": ("sum", "orders.amount")})
        return Limit(Sort(agg, "total", desc=True), 3), j

    root, _ = plan(HashJoin)
    print(root.explain())
    results = {}
    for cls in (NestedLoopJoin, HashJoin, SortMergeJoin):
        root, j = plan(cls)
        rows = list(root)
        results[cls.__name__] = rows
        print(f"{cls.__name__:15s}: сравнений/поисков ключа {j.comparisons:>9,}  → {rows}")
    assert results["NestedLoopJoin"] == results["HashJoin"] == results["SortMergeJoin"], "алгоритмы обязаны давать одинаковый ответ"
    print("все три алгоритма соединения дали одинаковый результат ✓")
