"""
mvcc.py — многоверсионное управление конкурентностью (MVCC) с нуля (главы 7–8).

Каждая запись хранит цепочку версий. Версия помнит, какая транзакция её создала (xmin)
и какая «удалила»/заменила (xmax) — так устроено хранение в PostgreSQL. Транзакция при
старте берёт снимок (snapshot): номера транзакций, зафиксированных к этому моменту, и видит
только их версии. Читатели никогда не блокируют писателей, писатели — читателей
(Bernstein & Goodman, 1983).

Реализованы два уровня изоляции:
  * SNAPSHOT  — snapshot isolation (Berenson и др., 1995): правило «первый зафиксировавший
                побеждает» запрещает потерянные обновления, но допускает аномалию write skew;
  * SERIALIZABLE — поверх снимка проверяем при фиксации, не изменил ли кто-то то, что
                мы ЧИТАЛИ (оптимистичная валидация, Kung & Robinson, 1981). Это упрощённая
                идея; PostgreSQL использует более тонкий алгоритм SSI (Cahill и др., 2008).

Запуск:  python mvcc.py
"""


class Abort(Exception):
    pass


class Version:
    def __init__(self, value, xmin):
        self.value, self.xmin, self.xmax = value, xmin, None


class Database:
    def __init__(self):
        self.versions = {}        # ключ -> список версий (от старых к новым)
        self.next_xid = 1
        self.committed = {}       # xid -> «момент фиксации» (номер по порядку)
        self.clock = 0

    def begin(self, isolation="SNAPSHOT"):
        return Transaction(self, isolation)

    def load(self, data):
        t = self.begin()
        for k, v in data.items():
            t.write(k, v)
        t.commit()


class Transaction:
    def __init__(self, db, isolation):
        self.db, self.isolation = db, isolation
        self.xid = db.next_xid
        db.next_xid += 1
        self.start = db.clock                          # снимок: видим всё, что зафиксировано до этого момента
        self.writes, self.reads = {}, set()
        self.done = False

    def _visible(self, v):
        """Правило видимости версии для нашего снимка."""
        created_by_us = v.xmin == self.xid
        created_visible = created_by_us or (v.xmin in self.db.committed and self.db.committed[v.xmin] <= self.start)
        if not created_visible:
            return False
        if v.xmax is None:
            return True
        deleted_by_us = v.xmax == self.xid
        deleted_visible = deleted_by_us or (v.xmax in self.db.committed and self.db.committed[v.xmax] <= self.start)
        return not deleted_visible

    def read(self, key):
        self.reads.add(key)
        if key in self.writes:
            return self.writes[key]
        for v in reversed(self.db.versions.get(key, [])):
            if self._visible(v):
                return v.value
        return None

    def write(self, key, value):
        self.writes[key] = value                       # буферизуем; версии создаём при фиксации

    def commit(self):
        db = self.db
        # 1) write-write конфликт: ключ, который мы пишем, кто-то зафиксировал после нашего старта
        for key in self.writes:
            for v in db.versions.get(key, []):
                if v.xmin != self.xid and db.committed.get(v.xmin, -1) > self.start:
                    self.done = True
                    raise Abort(f"T{self.xid}: конфликт записи по «{key}» (first-committer-wins)")
        # 2) SERIALIZABLE: то, что мы читали, не должно было измениться после нашего снимка
        if self.isolation == "SERIALIZABLE":
            for key in self.reads - set(self.writes):
                for v in db.versions.get(key, []):
                    if db.committed.get(v.xmin, -1) > self.start:
                        self.done = True
                        raise Abort(f"T{self.xid}: прочитанный ключ «{key}» изменён параллельной транзакцией")
        # 3) применяем: старая версия получает xmax, новая — xmin
        for key, value in self.writes.items():
            chain = db.versions.setdefault(key, [])
            for v in chain:
                if v.xmax is None:
                    v.xmax = self.xid
            chain.append(Version(value, self.xid))
        db.clock += 1
        db.committed[self.xid] = db.clock
        self.done = True


def demo_snapshot_read():
    print("1) Снимок: читатель не видит изменений, зафиксированных после его старта")
    db = Database(); db.load({"balance": 100})
    reader = db.begin()
    w = db.begin(); w.write("balance", 50); w.commit()
    print(f"   читатель видит {reader.read('balance')}, новая транзакция видит {db.begin().read('balance')}")
    assert reader.read("balance") == 100


def demo_lost_update():
    print("2) Потерянное обновление: две транзакции делают balance += 10")
    db = Database(); db.load({"balance": 100})
    t1, t2 = db.begin(), db.begin()
    t1.write("balance", t1.read("balance") + 10)
    t2.write("balance", t2.read("balance") + 10)
    t1.commit()
    try:
        t2.commit()
    except Abort as e:
        print("   ", e, "→ приложение повторяет T2 с новым снимком")
        t2 = db.begin()
        t2.write("balance", t2.read("balance") + 10)
        t2.commit()
    print(f"   итог: {db.begin().read('balance')} (без проверки конфликта T2 затёрла бы T1, и было бы 110)")
    assert db.begin().read("balance") == 120


def demo_write_skew(isolation):
    # Классический пример: в больнице должен дежурить хотя бы один врач (Cahill и др., 2008)
    db = Database(); db.load({"alice_on_call": True, "bob_on_call": True})
    t1, t2 = db.begin(isolation), db.begin(isolation)
    if t1.read("alice_on_call") + t1.read("bob_on_call") >= 2:
        t1.write("alice_on_call", False)               # Алиса уходит: «Боб же остаётся»
    if t2.read("alice_on_call") + t2.read("bob_on_call") >= 2:
        t2.write("bob_on_call", False)                 # Боб уходит: «Алиса же остаётся»
    t1.commit()
    try:
        t2.commit()
    except Abort as e:
        print("   ", e)
    r = db.begin()
    on_call = r.read("alice_on_call") + r.read("bob_on_call")
    print(f"   {isolation:12s}: дежурит врачей: {on_call}" + ("  ← инвариант нарушен (write skew)" if on_call == 0 else "  ✓"))
    return on_call


if __name__ == "__main__":
    demo_snapshot_read()
    demo_lost_update()
    print("3) Write skew: каждый проверяет «дежурят двое» и снимает с дежурства себя")
    assert demo_write_skew("SNAPSHOT") == 0
    assert demo_write_skew("SERIALIZABLE") == 1
