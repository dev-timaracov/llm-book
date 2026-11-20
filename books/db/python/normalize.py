"""
normalize.py — теория нормализации с нуля (глава 2).

Функциональная зависимость X → Y: значения атрибутов X однозначно определяют значения Y.
Из набора зависимостей F этот файл вычисляет:
  * замыкание X⁺ — все атрибуты, которые выводятся из X (аксиомы Армстронга);
  * все потенциальные ключи отношения;
  * минимальное покрытие F;
  * декомпозицию в BCNF (без потерь соединения) и синтез 3NF по Бернштейну (1976),
    который сохраняет зависимости.

Запуск:  python normalize.py
"""
from itertools import combinations


def parse(fds):
    """'A B -> C' → (frozenset('AB'), frozenset('C'))"""
    out = []
    for fd in fds:
        lhs, rhs = fd.split("->")
        out.append((frozenset(lhs.split()), frozenset(rhs.split())))
    return out


def closure(attrs, fds):
    """X⁺: повторяем «если LHS ⊆ результата — добавь RHS», пока что-то добавляется."""
    result = set(attrs)
    changed = True
    while changed:
        changed = False
        for lhs, rhs in fds:
            if lhs <= result and not rhs <= result:
                result |= rhs
                changed = True
    return frozenset(result)


def candidate_keys(attrs, fds):
    """Минимальные по включению множества K с K⁺ = все атрибуты.

    Атрибуты, которые не встречаются ни в одной правой части, обязаны входить в любой ключ —
    начинаем перебор с них, это сильно сокращает работу.
    """
    attrs = frozenset(attrs)
    must = attrs - frozenset().union(*(rhs for _, rhs in fds)) if fds else attrs
    rest = sorted(attrs - must)
    keys = []
    for k in range(len(rest) + 1):
        for extra in combinations(rest, k):
            cand = must | frozenset(extra)
            if any(key <= cand for key in keys):
                continue                       # не минимален: содержит уже найденный ключ
            if closure(cand, fds) == attrs:
                keys.append(cand)
    return keys


def minimal_cover(fds):
    """Минимальное покрытие: одна правая часть, без лишних атрибутов слева, без лишних зависимостей."""
    g = [(lhs, frozenset([a])) for lhs, rhs in fds for a in rhs]
    # 1) лишние атрибуты в левой части
    out = []
    for lhs, rhs in g:
        lhs = set(lhs)
        for a in sorted(lhs):
            if len(lhs) > 1 and rhs <= closure(lhs - {a}, g):
                lhs.discard(a)
        out.append((frozenset(lhs), rhs))
    # 2) лишние зависимости
    i = 0
    out = list(dict.fromkeys(out))
    while i < len(out):
        rest = out[:i] + out[i + 1:]
        if out[i][1] <= closure(out[i][0], rest):
            out = rest
        else:
            i += 1
    return out


def project(fds, attrs):
    """Зависимости, которые выполняются на проекции: для каждого подмножества X берём X⁺ ∩ attrs."""
    attrs = frozenset(attrs)
    out = []
    for k in range(1, len(attrs)):
        for x in combinations(sorted(attrs), k):
            x = frozenset(x)
            rhs = (closure(x, fds) & attrs) - x
            if rhs:
                out.append((x, rhs))
    return out


def is_bcnf(attrs, fds):
    """BCNF: для каждой нетривиальной X → Y левая часть X — суперключ."""
    for lhs, rhs in project(fds, attrs):
        if closure(lhs, fds) & frozenset(attrs) != frozenset(attrs):
            return False, (lhs, rhs)
    return True, None


def bcnf_decompose(attrs, fds):
    """Пока есть нарушающая X → Y: разбить R на (X ∪ Y) и (R − Y). Каждое разбиение без потерь."""
    ok, bad = is_bcnf(attrs, fds)
    if ok:
        return [frozenset(attrs)]
    lhs, _ = bad
    x_plus = closure(lhs, fds) & frozenset(attrs)
    r1, r2 = x_plus, frozenset(attrs) - (x_plus - lhs)
    return bcnf_decompose(r1, fds) + bcnf_decompose(r2, fds)


def synthesize_3nf(attrs, fds):
    """Синтез Бернштейна: по таблице на каждую группу зависимостей минимального покрытия + таблица с ключом."""
    cover = minimal_cover(fds)
    groups = {}
    for lhs, rhs in cover:
        groups.setdefault(lhs, set()).update(rhs)
    tables = [frozenset(lhs | rhs) for lhs, rhs in groups.items()]
    tables = [t for t in tables if not any(t < u for u in tables)]
    keys = candidate_keys(attrs, fds)
    if not any(any(k <= t for k in keys) for t in tables):
        tables.append(keys[0])               # иначе соединение таблиц может «размножить» строки
    return tables


def fmt(s):
    return "{" + " ".join(sorted(s)) + "}"


if __name__ == "__main__":
    # Пример: заказы интернет-магазина «одной большой таблицей»
    R = "order_id customer_id customer_name customer_city product_id product_name price qty".split()
    F = parse([
        "order_id -> customer_id",
        "customer_id -> customer_name customer_city",
        "product_id -> product_name price",
        "order_id product_id -> qty",
    ])
    print("R =", fmt(R))
    print("замыкание {order_id}⁺ =", fmt(closure({"order_id"}, F)))
    keys = candidate_keys(R, F)
    print("потенциальные ключи:", [fmt(k) for k in keys])
    assert keys == [frozenset({"order_id", "product_id"})]
    print("BCNF?", is_bcnf(R, F)[0])

    parts = bcnf_decompose(R, F)
    print("\nдекомпозиция в BCNF:")
    for p in parts:
        print("  ", fmt(p))
    assert all(is_bcnf(p, F)[0] for p in parts)

    print("\nминимальное покрытие:", [f"{fmt(l)} -> {fmt(r)}" for l, r in minimal_cover(F)])
    print("синтез 3NF:")
    for t in synthesize_3nf(R, F):
        print("  ", fmt(t))

    # Классический пример, где BCNF теряет зависимость: (улица, город) → индекс, индекс → город
    R2 = ["street", "city", "zip"]
    F2 = parse(["street city -> zip", "zip -> city"])
    print("\nадрес:", "ключи", [fmt(k) for k in candidate_keys(R2, F2)], "| BCNF?", is_bcnf(R2, F2)[0])
    print("BCNF-декомпозиция:", [fmt(p) for p in bcnf_decompose(R2, F2)],
          "— зависимость street city -> zip больше не проверяется внутри одной таблицы")
    print("3NF-синтез:", [fmt(t) for t in synthesize_3nf(R2, F2)], "— таблица в 3NF, но не в BCNF")
