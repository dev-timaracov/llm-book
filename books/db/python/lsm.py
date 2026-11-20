"""
lsm.py — key-value хранилище на LSM-дереве с нуля (глава 7).

LSM-дерево (Log-Structured Merge-Tree) предложили О'Нил и др. (1996). Так устроены
LevelDB, RocksDB, Cassandra, HBase, ScyllaDB. Путь записи:

  put(k, v) → 1) дописать в журнал WAL и сделать fsync (долговечность)
            → 2) положить в memtable (отсортированная структура в памяти)
            → 3) когда memtable разросся — сбросить его на диск неизменяемым SSTable
  get(k)    → memtable → SSTable от новых к старым; Bloom-фильтр (Bloom, 1970) каждого
              SSTable позволяет не читать файл, если ключа там точно нет
  compact() → слить несколько SSTable в один, выбросив перезаписанные значения и удалённые ключи

После «падения» процесса данные восстанавливаются: SSTable уже на диске, а то, что было
только в memtable, проигрывается из WAL.

Запуск:  python lsm.py
"""
import hashlib
import json
import math
import os
import shutil
import struct

TOMBSTONE = None   # значение-«надгробие»: ключ удалён


# ------------------------------- Bloom-фильтр -------------------------------
class BloomFilter:
    """m бит, k хеш-функций. Ложноположительные ответы возможны, ложноотрицательные — никогда."""

    def __init__(self, n_items, fp_rate=0.01):
        n = max(1, n_items)
        self.m = max(8, int(-n * math.log(fp_rate) / math.log(2) ** 2))   # оптимальное число бит
        self.k = max(1, round(self.m / n * math.log(2)))                  # оптимальное число хешей
        self.bits = bytearray((self.m + 7) // 8)

    def _positions(self, key):
        # двойное хеширование: h_i = h1 + i·h2 (Kirsch & Mitzenmacher) из одного SHA-256
        d = hashlib.sha256(key.encode()).digest()
        h1, h2 = int.from_bytes(d[:8], "little"), int.from_bytes(d[8:16], "little") | 1
        return [(h1 + i * h2) % self.m for i in range(self.k)]

    def add(self, key):
        for p in self._positions(key):
            self.bits[p // 8] |= 1 << (p % 8)

    def might_contain(self, key):
        return all(self.bits[p // 8] & (1 << (p % 8)) for p in self._positions(key))

    def to_dict(self):
        return {"m": self.m, "k": self.k, "bits": self.bits.hex()}

    @classmethod
    def from_dict(cls, d):
        bf = cls.__new__(cls)
        bf.m, bf.k, bf.bits = d["m"], d["k"], bytearray.fromhex(d["bits"])
        return bf


# ------------------------------- SSTable -------------------------------
class SSTable:
    """Неизменяемый отсортированный файл: [длина][JSON-запись]... + разреженный индекс + Bloom-фильтр.

    Разреженный индекс хранит смещение каждой INDEX_EVERY-й записи, поэтому поиск = бинарный поиск
    по индексу в памяти + последовательное чтение не более INDEX_EVERY записей с диска.
    """
    INDEX_EVERY = 16

    def __init__(self, path):
        self.path = path
        with open(path + ".meta", encoding="utf-8") as f:
            meta = json.load(f)
        self.index = meta["index"]           # [[ключ, смещение], ...]
        self.count = meta["count"]
        self.bloom = BloomFilter.from_dict(meta["bloom"])
        self.reads = 0                       # сколько раз реально открывали файл

    @classmethod
    def write(cls, path, items):
        """items: отсортированный список (ключ, значение)."""
        bloom = BloomFilter(len(items))
        index = []
        with open(path, "wb") as f:
            for i, (k, v) in enumerate(items):
                if i % cls.INDEX_EVERY == 0:
                    index.append([k, f.tell()])
                rec = json.dumps([k, v]).encode()
                f.write(struct.pack("<I", len(rec)) + rec)
                bloom.add(k)
            f.flush()
            os.fsync(f.fileno())
        with open(path + ".meta", "w", encoding="utf-8") as f:
            json.dump({"index": index, "count": len(items), "bloom": bloom.to_dict()}, f)
        return cls(path)

    def get(self, key):
        """Возвращает (найден?, значение). Значение может быть TOMBSTONE."""
        if not self.index or not self.bloom.might_contain(key):
            return False, None
        lo, hi = 0, len(self.index) - 1        # последняя точка индекса с ключом <= key
        if key < self.index[0][0]:
            return False, None
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if self.index[mid][0] <= key:
                lo = mid
            else:
                hi = mid - 1
        self.reads += 1
        with open(self.path, "rb") as f:
            f.seek(self.index[lo][1])
            for _ in range(self.INDEX_EVERY):
                head = f.read(4)
                if not head:
                    break
                k, v = json.loads(f.read(struct.unpack("<I", head)[0]))
                if k == key:
                    return True, v
                if k > key:
                    break
        return False, None

    def items(self):
        with open(self.path, "rb") as f:
            while head := f.read(4):
                k, v = json.loads(f.read(struct.unpack("<I", head)[0]))
                yield k, v

    def delete_files(self):
        os.remove(self.path)
        os.remove(self.path + ".meta")


# ------------------------------- само хранилище -------------------------------
class LSMStore:
    def __init__(self, directory, memtable_limit=1000, compact_threshold=4):
        self.dir = directory
        self.memtable_limit = memtable_limit
        self.compact_threshold = compact_threshold
        os.makedirs(directory, exist_ok=True)
        self.memtable = {}
        self.stats = {"bytes_written_by_user": 0, "bytes_written_to_disk": 0, "flushes": 0, "compactions": 0}
        # SSTable храним от старых к новым; номер в имени файла задаёт порядок
        names = sorted((n for n in os.listdir(directory) if n.endswith(".sst")), key=lambda n: int(n.split(".")[0]))
        self.sstables = [SSTable(os.path.join(directory, n)) for n in names]
        self.next_id = 1 + max([int(n.split(".")[0]) for n in names] or [0])
        self._recover_from_wal()
        self.wal = open(self._wal_path(), "a", encoding="utf-8")

    def _wal_path(self):
        return os.path.join(self.dir, "wal.log")

    def _recover_from_wal(self):
        """Проигрываем журнал: всё, что было записано, но не попало в SSTable до падения."""
        if not os.path.exists(self._wal_path()):
            return
        n = 0
        with open(self._wal_path(), encoding="utf-8") as f:
            for line in f:
                try:
                    k, v = json.loads(line)
                except json.JSONDecodeError:
                    break        # оборванная последняя запись (упали посреди write) — её не было
                self.memtable[k] = v
                n += 1
        if n:
            print(f"  восстановление: из WAL проиграно {n} записей")

    # ---------- запись ----------
    def put(self, key, value):
        line = json.dumps([key, value]) + "\n"
        self.wal.write(line)
        self.wal.flush()
        os.fsync(self.wal.fileno())          # без fsync «подтверждённая» запись может пропасть при сбое питания
        self.stats["bytes_written_by_user"] += len(line)
        self.stats["bytes_written_to_disk"] += len(line)
        self.memtable[key] = value
        if len(self.memtable) >= self.memtable_limit:
            self.flush()

    def delete(self, key):
        self.put(key, TOMBSTONE)             # удаление = запись «надгробия»; старые версии уберёт компакция

    def flush(self):
        if not self.memtable:
            return
        path = os.path.join(self.dir, f"{self.next_id}.sst")
        self.next_id += 1
        self.sstables.append(SSTable.write(path, sorted(self.memtable.items())))
        self.stats["bytes_written_to_disk"] += os.path.getsize(path)
        self.stats["flushes"] += 1
        self.memtable = {}
        # SSTable надёжно на диске → журнал больше не нужен
        self.wal.close()
        open(self._wal_path(), "w").close()
        self.wal = open(self._wal_path(), "a", encoding="utf-8")
        if len(self.sstables) >= self.compact_threshold:
            self.compact()

    def compact(self):
        """Size-tiered компакция в простейшем виде: слить ВСЕ SSTable в один (k-путевое слияние)."""
        merged = {}
        for sst in self.sstables:            # от старых к новым: новые значения перезаписывают старые
            for k, v in sst.items():
                merged[k] = v
        # надгробия можно выбросить, только когда сливаем самый старый уровень — ниже версий нет
        items = sorted((k, v) for k, v in merged.items() if v is not TOMBSTONE)
        path = os.path.join(self.dir, f"{self.next_id}.sst")
        self.next_id += 1
        new = SSTable.write(path, items)
        self.stats["bytes_written_to_disk"] += os.path.getsize(path)
        self.stats["compactions"] += 1
        for sst in self.sstables:
            sst.delete_files()
        self.sstables = [new]

    # ---------- чтение ----------
    def get(self, key):
        if key in self.memtable:
            v = self.memtable[key]
            return None if v is TOMBSTONE else v
        for sst in reversed(self.sstables):  # от новых к старым: первая найденная версия — актуальная
            found, v = sst.get(key)
            if found:
                return None if v is TOMBSTONE else v
        return None

    def write_amplification(self):
        return self.stats["bytes_written_to_disk"] / max(1, self.stats["bytes_written_by_user"])

    def close(self):
        self.wal.close()


if __name__ == "__main__":
    import random
    random.seed(1)
    d = "data/lsm_demo"
    shutil.rmtree(d, ignore_errors=True)

    db = LSMStore(d, memtable_limit=500, compact_threshold=4)
    truth = {}
    for i in range(6000):
        k = f"user:{random.randrange(3000):05d}"
        if random.random() < 0.1 and truth:
            db.delete(k); truth.pop(k, None)
        else:
            v = {"visits": i}
            db.put(k, v); truth[k] = v
    print(f"после 6000 операций: SSTable на диске: {len(db.sstables)}, в memtable: {len(db.memtable)}, "
          f"сбросов {db.stats['flushes']}, компакций {db.stats['compactions']}")
    print(f"write amplification ≈ {db.write_amplification():.2f} (байт на диск / байт от пользователя)")

    # «падение»: просто бросаем объект, не вызывая flush — memtable в памяти теряется
    in_memtable = len(db.memtable)
    db.wal.close(); del db
    db = LSMStore(d, memtable_limit=500, compact_threshold=4)
    assert len(db.memtable) == in_memtable
    assert all(db.get(k) == v for k, v in truth.items()), "после восстановления данные должны совпасть"
    assert all(db.get(f"user:{k:05d}") is None for k in range(3000) if f"user:{k:05d}" not in truth)
    print("после «падения» и перезапуска все данные на месте ✓")

    # Bloom-фильтр экономит чтения файлов для отсутствующих ключей
    db.flush()
    for s in db.sstables: s.reads = 0
    absent = [f"user:{k:05d}x" for k in range(3000)]       # ключи ВНУТРИ диапазона SSTable, но отсутствующие
    for k in absent:
        db.get(k)
    print(f"{len(absent)} запросов отсутствующих ключей → открытий файлов SSTable: {sum(s.reads for s in db.sstables)} "
          f"(без Bloom-фильтра было бы {len(absent) * len(db.sstables)}; ожидаем ≈1% ложных срабатываний)")
    db.close()
