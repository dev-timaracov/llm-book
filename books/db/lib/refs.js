// Библиография учебника «Базы данных изнутри». Только первоисточники; номер = позиция в массиве.
const doi = (d) => `https://doi.org/${d}`;

export const REFS = [
  // --- основы и архитектура ---
  { id: 'codd1970', authors: 'E. F. Codd', title: 'A Relational Model of Data for Large Shared Data Banks', venue: 'Communications of the ACM, 13(6), 377–387', year: 1970, url: doi('10.1145/362384.362685') },
  { id: 'chamberlin1974', authors: 'D. D. Chamberlin, R. F. Boyce', title: 'SEQUEL: A Structured English Query Language', venue: 'ACM SIGFIDET Workshop', year: 1974, url: doi('10.1145/800296.811515') },
  { id: 'astrahan1976', authors: 'M. M. Astrahan, M. W. Blasgen, D. D. Chamberlin и др.', title: 'System R: Relational Approach to Database Management', venue: 'ACM TODS, 1(2), 97–137', year: 1976, url: doi('10.1145/320455.320457') },
  { id: 'stonebraker1976', authors: 'M. Stonebraker, E. Wong, P. Kreps, G. Held', title: 'The Design and Implementation of INGRES', venue: 'ACM TODS, 1(3), 189–222', year: 1976, url: doi('10.1145/320473.320476') },
  { id: 'hellerstein2007', authors: 'J. M. Hellerstein, M. Stonebraker, J. Hamilton', title: 'Architecture of a Database System', venue: 'Foundations and Trends in Databases, 1(2)', year: 2007, url: 'https://dsf.berkeley.edu/papers/fntdb07-architecture.pdf' },
  { id: 'harizopoulos2008', authors: 'S. Harizopoulos, D. J. Abadi, S. Madden, M. Stonebraker', title: 'OLTP Through the Looking Glass, and What We Found There', venue: 'SIGMOD 2008', year: 2008, url: doi('10.1145/1376616.1376713') },
  { id: 'petrov2019', authors: 'A. Petrov', title: 'Database Internals (книга)', venue: "O'Reilly", year: 2019, url: 'https://www.databass.dev/' },
  { id: 'kleppmann2017', authors: 'M. Kleppmann', title: 'Designing Data-Intensive Applications (книга)', venue: "O'Reilly", year: 2017, url: 'https://dataintensive.net/' },
  { id: 'cmu445', authors: 'A. Pavlo и др.', title: 'CMU 15-445/645: Database Systems (курс лекций)', venue: 'Carnegie Mellon University', year: 2024, url: 'https://15445.courses.cs.cmu.edu/' },

  // --- хранение и буферы ---
  { id: 'oneil1993', authors: "E. J. O'Neil, P. E. O'Neil, G. Weikum", title: 'The LRU-K Page Replacement Algorithm for Database Disk Buffering', venue: 'SIGMOD 1993', year: 1993, url: doi('10.1145/170035.170081') },
  { id: 'megiddo2003', authors: 'N. Megiddo, D. S. Modha', title: 'ARC: A Self-Tuning, Low Overhead Replacement Cache', venue: 'USENIX FAST 2003', year: 2003, url: 'https://www.usenix.org/conference/fast-03/arc-self-tuning-low-overhead-replacement-cache' },
  { id: 'abadi2008', authors: 'D. J. Abadi, S. R. Madden, N. Hachem', title: 'Column-Stores vs. Row-Stores: How Different Are They Really?', venue: 'SIGMOD 2008', year: 2008, url: doi('10.1145/1376616.1376712') },
  { id: 'stonebraker2005cstore', authors: 'M. Stonebraker, D. J. Abadi, A. Batkin и др.', title: 'C-Store: A Column-oriented DBMS', venue: 'VLDB 2005', year: 2005, url: 'http://db.csail.mit.edu/projects/cstore/vldb.pdf' },

  // --- индексы ---
  { id: 'bayer1972', authors: 'R. Bayer, E. McCreight', title: 'Organization and Maintenance of Large Ordered Indexes', venue: 'Acta Informatica, 1, 173–189', year: 1972, url: doi('10.1007/BF00288683') },
  { id: 'comer1979', authors: 'D. Comer', title: 'The Ubiquitous B-Tree', venue: 'ACM Computing Surveys, 11(2), 121–137', year: 1979, url: doi('10.1145/356770.356776') },
  { id: 'lehman1981', authors: 'P. L. Lehman, S. B. Yao', title: 'Efficient Locking for Concurrent Operations on B-Trees', venue: 'ACM TODS, 6(4), 650–670', year: 1981, url: doi('10.1145/319628.319663') },
  { id: 'graefe2011', authors: 'G. Graefe', title: 'Modern B-Tree Techniques', venue: 'Foundations and Trends in Databases, 3(4)', year: 2011, url: doi('10.1561/1900000028') },
  { id: 'fagin1979', authors: 'R. Fagin, J. Nievergelt, N. Pippenger, H. R. Strong', title: 'Extendible Hashing — A Fast Access Method for Dynamic Files', venue: 'ACM TODS, 4(3), 315–344', year: 1979, url: doi('10.1145/320083.320092') },
  { id: 'kraska2018', authors: 'T. Kraska, A. Beutel, E. H. Chi, J. Dean, N. Polyzotis', title: 'The Case for Learned Index Structures', venue: 'SIGMOD 2018', year: 2018, url: 'https://arxiv.org/abs/1712.01208' },

  // --- LSM ---
  { id: 'oneil1996', authors: "P. O'Neil, E. Cheng, D. Gawlick, E. O'Neil", title: 'The Log-Structured Merge-Tree (LSM-Tree)', venue: 'Acta Informatica, 33(4), 351–385', year: 1996, url: doi('10.1007/s002360050048') },
  { id: 'rosenblum1992', authors: 'M. Rosenblum, J. K. Ousterhout', title: 'The Design and Implementation of a Log-Structured File System', venue: 'ACM TOCS, 10(1), 26–52', year: 1992, url: doi('10.1145/146941.146943') },
  { id: 'bloom1970', authors: 'B. H. Bloom', title: 'Space/Time Trade-offs in Hash Coding with Allowable Errors', venue: 'Communications of the ACM, 13(7), 422–426', year: 1970, url: doi('10.1145/362686.362692') },
  { id: 'luo2020', authors: 'C. Luo, M. J. Carey', title: 'LSM-based Storage Techniques: A Survey', venue: 'The VLDB Journal, 29', year: 2020, url: 'https://arxiv.org/abs/1812.07527' },
  { id: 'dayan2017', authors: 'N. Dayan, M. Athanassoulis, S. Idreos', title: 'Monkey: Optimal Navigable Key-Value Store', venue: 'SIGMOD 2017', year: 2017, url: doi('10.1145/3035918.3064054') },
  { id: 'athanassoulis2016', authors: 'M. Athanassoulis, M. S. Kester, L. M. Maas и др.', title: 'Designing Access Methods: The RUM Conjecture', venue: 'EDBT 2016', year: 2016, url: 'https://stratos.seas.harvard.edu/files/stratos/files/rum.pdf' },
  { id: 'chang2006', authors: 'F. Chang, J. Dean, S. Ghemawat и др.', title: 'Bigtable: A Distributed Storage System for Structured Data', venue: 'OSDI 2006', year: 2006, url: 'https://www.usenix.org/legacy/event/osdi06/tech/chang/chang.pdf' },

  // --- выполнение и оптимизация запросов ---
  { id: 'graefe1994', authors: 'G. Graefe', title: 'Volcano — An Extensible and Parallel Query Evaluation System', venue: 'IEEE TKDE, 6(1), 120–135', year: 1994, url: doi('10.1109/69.273032') },
  { id: 'graefe1993', authors: 'G. Graefe', title: 'Query Evaluation Techniques for Large Databases', venue: 'ACM Computing Surveys, 25(2), 73–169', year: 1993, url: doi('10.1145/152610.152611') },
  { id: 'boncz2005', authors: 'P. Boncz, M. Zukowski, N. Nes', title: 'MonetDB/X100: Hyper-Pipelining Query Execution', venue: 'CIDR 2005', year: 2005, url: 'https://www.cidrdb.org/cidr2005/papers/P19.pdf' },
  { id: 'neumann2011', authors: 'T. Neumann', title: 'Efficiently Compiling Efficient Query Plans for Modern Hardware', venue: 'PVLDB, 4(9)', year: 2011, url: 'https://www.vldb.org/pvldb/vol4/p539-neumann.pdf' },
  { id: 'selinger1979', authors: 'P. G. Selinger, M. M. Astrahan, D. D. Chamberlin, R. A. Lorie, T. G. Price', title: 'Access Path Selection in a Relational Database Management System', venue: 'SIGMOD 1979', year: 1979, url: doi('10.1145/582095.582099') },
  { id: 'leis2015', authors: 'V. Leis, A. Gubichev, A. Mirchev, P. Boncz, A. Kemper, T. Neumann', title: 'How Good Are Query Optimizers, Really?', venue: 'PVLDB, 9(3)', year: 2015, url: 'https://www.vldb.org/pvldb/vol9/p204-leis.pdf' },

  // --- транзакции, изоляция, конкурентность ---
  { id: 'harder1983', authors: 'T. Härder, A. Reuter', title: 'Principles of Transaction-Oriented Database Recovery (термин ACID)', venue: 'ACM Computing Surveys, 15(4), 287–317', year: 1983, url: doi('10.1145/289.291') },
  { id: 'eswaran1976', authors: 'K. P. Eswaran, J. N. Gray, R. A. Lorie, I. L. Traiger', title: 'The Notions of Consistency and Predicate Locks in a Database System', venue: 'Communications of the ACM, 19(11), 624–633', year: 1976, url: doi('10.1145/360363.360369') },
  { id: 'berenson1995', authors: 'H. Berenson, P. Bernstein, J. Gray, J. Melton, E. O\'Neil, P. O\'Neil', title: 'A Critique of ANSI SQL Isolation Levels', venue: 'SIGMOD 1995', year: 1995, url: 'https://arxiv.org/abs/cs/0701157' },
  { id: 'bernstein1987', authors: 'P. A. Bernstein, V. Hadzilacos, N. Goodman', title: 'Concurrency Control and Recovery in Database Systems (книга, свободно доступна)', venue: 'Addison-Wesley', year: 1987, url: 'https://www.microsoft.com/en-us/research/people/philbe/book/' },
  { id: 'bernstein1983', authors: 'P. A. Bernstein, N. Goodman', title: 'Multiversion Concurrency Control — Theory and Algorithms', venue: 'ACM TODS, 8(4), 465–483', year: 1983, url: doi('10.1145/319996.319998') },
  { id: 'kung1981', authors: 'H. T. Kung, J. T. Robinson', title: 'On Optimistic Methods for Concurrency Control', venue: 'ACM TODS, 6(2), 213–226', year: 1981, url: doi('10.1145/319566.319567') },
  { id: 'cahill2008', authors: 'M. J. Cahill, U. Röhm, A. D. Fekete', title: 'Serializable Isolation for Snapshot Databases', venue: 'SIGMOD 2008', year: 2008, url: doi('10.1145/1376616.1376690') },
  { id: 'ports2012', authors: 'D. R. K. Ports, K. Grittner', title: 'Serializable Snapshot Isolation in PostgreSQL', venue: 'PVLDB, 5(12)', year: 2012, url: 'https://arxiv.org/abs/1208.4179' },
  { id: 'wu2017', authors: 'Y. Wu, J. Arulraj, J. Lin, R. Xian, A. Pavlo', title: 'An Empirical Evaluation of In-Memory Multi-Version Concurrency Control', venue: 'PVLDB, 10(7)', year: 2017, url: 'https://www.vldb.org/pvldb/vol10/p781-Wu.pdf' },

  // --- восстановление ---
  { id: 'mohan1992', authors: 'C. Mohan, D. Haderle, B. Lindsay, H. Pirahesh, P. Schwarz', title: 'ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging', venue: 'ACM TODS, 17(1), 94–162', year: 1992, url: doi('10.1145/128765.128770') },

  // --- распределённые системы ---
  { id: 'lamport1978', authors: 'L. Lamport', title: 'Time, Clocks, and the Ordering of Events in a Distributed System', venue: 'Communications of the ACM, 21(7), 558–565', year: 1978, url: doi('10.1145/359545.359563') },
  { id: 'lamport1998', authors: 'L. Lamport', title: 'The Part-Time Parliament (Paxos)', venue: 'ACM TOCS, 16(2), 133–169', year: 1998, url: doi('10.1145/279227.279229') },
  { id: 'ongaro2014', authors: 'D. Ongaro, J. Ousterhout', title: 'In Search of an Understandable Consensus Algorithm (Raft)', venue: 'USENIX ATC 2014', year: 2014, url: 'https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro' },
  { id: 'gray2006', authors: 'J. Gray, L. Lamport', title: 'Consensus on Transaction Commit', venue: 'ACM TODS, 31(1), 133–160', year: 2006, url: doi('10.1145/1132863.1132867') },
  { id: 'brewer2000', authors: 'E. A. Brewer', title: 'Towards Robust Distributed Systems (доклад, гипотеза CAP)', venue: 'PODC 2000, keynote', year: 2000, url: 'https://people.eecs.berkeley.edu/~brewer/cs262b-2004/PODC-keynote.pdf' },
  { id: 'gilbert2002', authors: 'S. Gilbert, N. Lynch', title: "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services", venue: 'ACM SIGACT News, 33(2), 51–59', year: 2002, url: doi('10.1145/564585.564601') },
  { id: 'abadi2012', authors: 'D. J. Abadi', title: 'Consistency Tradeoffs in Modern Distributed Database System Design (PACELC)', venue: 'IEEE Computer, 45(2), 37–42', year: 2012, url: doi('10.1109/MC.2012.33') },
  { id: 'vogels2009', authors: 'W. Vogels', title: 'Eventually Consistent', venue: 'Communications of the ACM, 52(1), 40–44', year: 2009, url: doi('10.1145/1435417.1435432') },
  { id: 'karger1997', authors: 'D. Karger, E. Lehman, T. Leighton и др.', title: 'Consistent Hashing and Random Trees', venue: 'STOC 1997', year: 1997, url: doi('10.1145/258533.258660') },
  { id: 'decandia2007', authors: 'G. DeCandia, D. Hastorun, M. Jampani и др.', title: "Dynamo: Amazon's Highly Available Key-value Store", venue: 'SOSP 2007', year: 2007, url: doi('10.1145/1294261.1294281') },
  { id: 'lakshman2010', authors: 'A. Lakshman, P. Malik', title: 'Cassandra: A Decentralized Structured Storage System', venue: 'ACM SIGOPS OSR, 44(2), 35–40', year: 2010, url: doi('10.1145/1773912.1773922') },
  { id: 'corbett2012', authors: 'J. C. Corbett, J. Dean, M. Epstein и др.', title: "Spanner: Google's Globally-Distributed Database", venue: 'OSDI 2012', year: 2012, url: 'https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett' },

  // --- виды баз данных ---
  { id: 'stonebraker2005one', authors: 'M. Stonebraker, U. Çetintemel', title: '"One Size Fits All": An Idea Whose Time Has Come and Gone', venue: 'ICDE 2005', year: 2005, url: doi('10.1109/ICDE.2005.1') },
  { id: 'stonebraker2024', authors: 'M. Stonebraker, A. Pavlo', title: 'What Goes Around Comes Around... And Around...', venue: 'SIGMOD Record, 53(2)', year: 2024, url: 'https://db.cs.cmu.edu/papers/2024/whatgoesaround-sigmodrec2024.pdf' },
  { id: 'kallman2008', authors: 'R. Kallman, H. Kimura, J. Natkins и др.', title: 'H-Store: A High-Performance, Distributed Main Memory Transaction Processing System', venue: 'PVLDB, 1(2)', year: 2008, url: doi('10.14778/1454159.1454211') },
  { id: 'angles2008', authors: 'R. Angles, C. Gutierrez', title: 'Survey of Graph Database Models', venue: 'ACM Computing Surveys, 40(1)', year: 2008, url: doi('10.1145/1322432.1322433') },
  { id: 'zobel2006', authors: 'J. Zobel, A. Moffat', title: 'Inverted Files for Text Search Engines', venue: 'ACM Computing Surveys, 38(2)', year: 2006, url: doi('10.1145/1132956.1132959') },
  { id: 'pelkonen2015', authors: 'T. Pelkonen, S. Franklin, J. Teller и др.', title: 'Gorilla: A Fast, Scalable, In-Memory Time Series Database', venue: 'PVLDB, 8(12)', year: 2015, url: 'https://www.vldb.org/pvldb/vol8/p1816-teller.pdf' },
  { id: 'malkov2016', authors: 'Y. A. Malkov, D. A. Yashunin', title: 'Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs (HNSW)', venue: 'IEEE TPAMI (препринт arXiv:1603.09320)', year: 2016, url: 'https://arxiv.org/abs/1603.09320' },
];
