// Библиография учебника. Все ссылки — на первоисточники (arXiv, журналы, официальные PDF).
// Номер ссылки в тексте определяется порядком в этом массиве.

export const REFS = [
  // --- основы: информация, нейросети, обратное распространение ---
  { id: 'shannon1948', authors: 'C. E. Shannon', title: 'A Mathematical Theory of Communication', venue: 'Bell System Technical Journal, 27(3), 379–423', year: 1948, url: 'https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf' },
  { id: 'rosenblatt1958', authors: 'F. Rosenblatt', title: 'The Perceptron: A Probabilistic Model for Information Storage and Organization in the Brain', venue: 'Psychological Review, 65(6), 386–408', year: 1958, url: 'https://doi.org/10.1037/h0042519' },
  { id: 'rumelhart1986', authors: 'D. E. Rumelhart, G. E. Hinton, R. J. Williams', title: 'Learning representations by back-propagating errors', venue: 'Nature, 323, 533–536', year: 1986, url: 'https://doi.org/10.1038/323533a0' },
  { id: 'cybenko1989', authors: 'G. Cybenko', title: 'Approximation by superpositions of a sigmoidal function', venue: 'Mathematics of Control, Signals and Systems, 2, 303–314', year: 1989, url: 'https://doi.org/10.1007/BF02551274' },
  { id: 'hornik1989', authors: 'K. Hornik, M. Stinchcombe, H. White', title: 'Multilayer feedforward networks are universal approximators', venue: 'Neural Networks, 2(5), 359–366', year: 1989, url: 'https://doi.org/10.1016/0893-6080(89)90020-8' },
  { id: 'baydin2015', authors: 'A. G. Baydin, B. A. Pearlmutter, A. A. Radul, J. M. Siskind', title: 'Automatic differentiation in machine learning: a survey', venue: 'JMLR 18(153)', year: 2018, url: 'https://arxiv.org/abs/1502.05767' },
  { id: 'goodfellow2016', authors: 'I. Goodfellow, Y. Bengio, A. Courville', title: 'Deep Learning (книга)', venue: 'MIT Press', year: 2016, url: 'https://www.deeplearningbook.org/' },

  // --- инициализация, нормализация, регуляризация ---
  { id: 'glorot2010', authors: 'X. Glorot, Y. Bengio', title: 'Understanding the difficulty of training deep feedforward neural networks', venue: 'AISTATS 2010', year: 2010, url: 'https://proceedings.mlr.press/v9/glorot10a.html' },
  { id: 'he2015init', authors: 'K. He, X. Zhang, S. Ren, J. Sun', title: 'Delving Deep into Rectifiers: Surpassing Human-Level Performance on ImageNet Classification', venue: 'ICCV 2015', year: 2015, url: 'https://arxiv.org/abs/1502.01852' },
  { id: 'he2016resnet', authors: 'K. He, X. Zhang, S. Ren, J. Sun', title: 'Deep Residual Learning for Image Recognition', venue: 'CVPR 2016', year: 2016, url: 'https://arxiv.org/abs/1512.03385' },
  { id: 'ioffe2015', authors: 'S. Ioffe, C. Szegedy', title: 'Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift', venue: 'ICML 2015', year: 2015, url: 'https://arxiv.org/abs/1502.03167' },
  { id: 'ba2016', authors: 'J. L. Ba, J. R. Kiros, G. E. Hinton', title: 'Layer Normalization', venue: 'arXiv:1607.06450', year: 2016, url: 'https://arxiv.org/abs/1607.06450' },
  { id: 'srivastava2014', authors: 'N. Srivastava, G. Hinton, A. Krizhevsky, I. Sutskever, R. Salakhutdinov', title: 'Dropout: A Simple Way to Prevent Neural Networks from Overfitting', venue: 'JMLR 15, 1929–1958', year: 2014, url: 'https://jmlr.org/papers/v15/srivastava14a.html' },
  { id: 'hendrycks2016', authors: 'D. Hendrycks, K. Gimpel', title: 'Gaussian Error Linear Units (GELUs)', venue: 'arXiv:1606.08415', year: 2016, url: 'https://arxiv.org/abs/1606.08415' },
  { id: 'xiong2020', authors: 'R. Xiong, Y. Yang, D. He и др.', title: 'On Layer Normalization in the Transformer Architecture', venue: 'ICML 2020', year: 2020, url: 'https://arxiv.org/abs/2002.04745' },

  // --- оптимизация ---
  { id: 'polyak1964', authors: 'B. T. Polyak', title: 'Some methods of speeding up the convergence of iteration methods', venue: 'USSR Computational Mathematics and Mathematical Physics, 4(5), 1–17', year: 1964, url: 'https://doi.org/10.1016/0041-5553(64)90137-5' },
  { id: 'sutskever2013', authors: 'I. Sutskever, J. Martens, G. Dahl, G. Hinton', title: 'On the importance of initialization and momentum in deep learning', venue: 'ICML 2013', year: 2013, url: 'https://proceedings.mlr.press/v28/sutskever13.html' },
  { id: 'hinton2012rmsprop', authors: 'T. Tieleman, G. Hinton', title: 'Lecture 6.5 — RMSProp: Divide the gradient by a running average of its recent magnitude', venue: 'COURSERA: Neural Networks for Machine Learning', year: 2012, url: 'https://www.cs.toronto.edu/~tijmen/csc321/slides/lecture_slides_lec6.pdf' },
  { id: 'kingma2014', authors: 'D. P. Kingma, J. Ba', title: 'Adam: A Method for Stochastic Optimization', venue: 'ICLR 2015', year: 2015, url: 'https://arxiv.org/abs/1412.6980' },
  { id: 'loshchilov2017', authors: 'I. Loshchilov, F. Hutter', title: 'Decoupled Weight Decay Regularization (AdamW)', venue: 'ICLR 2019', year: 2019, url: 'https://arxiv.org/abs/1711.05101' },
  { id: 'loshchilov2016', authors: 'I. Loshchilov, F. Hutter', title: 'SGDR: Stochastic Gradient Descent with Warm Restarts', venue: 'ICLR 2017', year: 2017, url: 'https://arxiv.org/abs/1608.03983' },
  { id: 'goyal2017', authors: 'P. Goyal, P. Dollár, R. Girshick и др.', title: 'Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour', venue: 'arXiv:1706.02677', year: 2017, url: 'https://arxiv.org/abs/1706.02677' },
  { id: 'pascanu2013', authors: 'R. Pascanu, T. Mikolov, Y. Bengio', title: 'On the difficulty of training recurrent neural networks', venue: 'ICML 2013', year: 2013, url: 'https://arxiv.org/abs/1211.5063' },
  { id: 'micikevicius2017', authors: 'P. Micikevicius, S. Narang, J. Alben и др.', title: 'Mixed Precision Training', venue: 'ICLR 2018', year: 2018, url: 'https://arxiv.org/abs/1710.03740' },

  // --- языковые модели до трансформера ---
  { id: 'bengio2003', authors: 'Y. Bengio, R. Ducharme, P. Vincent, C. Jauvin', title: 'A Neural Probabilistic Language Model', venue: 'JMLR 3, 1137–1155', year: 2003, url: 'https://www.jmlr.org/papers/volume3/bengio03a/bengio03a.pdf' },
  { id: 'mikolov2013', authors: 'T. Mikolov, K. Chen, G. Corrado, J. Dean', title: 'Efficient Estimation of Word Representations in Vector Space (word2vec)', venue: 'arXiv:1301.3781', year: 2013, url: 'https://arxiv.org/abs/1301.3781' },
  { id: 'hochreiter1997', authors: 'S. Hochreiter, J. Schmidhuber', title: 'Long Short-Term Memory', venue: 'Neural Computation, 9(8), 1735–1780', year: 1997, url: 'https://doi.org/10.1162/neco.1997.9.8.1735' },
  { id: 'sutskever2014', authors: 'I. Sutskever, O. Vinyals, Q. V. Le', title: 'Sequence to Sequence Learning with Neural Networks', venue: 'NeurIPS 2014', year: 2014, url: 'https://arxiv.org/abs/1409.3215' },
  { id: 'bahdanau2014', authors: 'D. Bahdanau, K. Cho, Y. Bengio', title: 'Neural Machine Translation by Jointly Learning to Align and Translate', venue: 'ICLR 2015', year: 2015, url: 'https://arxiv.org/abs/1409.0473' },
  { id: 'karpathy2015', authors: 'A. Karpathy', title: 'The Unreasonable Effectiveness of Recurrent Neural Networks (блог; датасет Tiny Shakespeare)', venue: 'karpathy.github.io', year: 2015, url: 'https://karpathy.github.io/2015/05/21/rnn-effectiveness/' },

  // --- токенизация ---
  { id: 'gage1994', authors: 'P. Gage', title: 'A New Algorithm for Data Compression', venue: 'The C Users Journal, 12(2), 23–38', year: 1994, url: 'http://www.pennelynn.com/Documents/CUJ/HTML/94HTML/19940045.HTM' },
  { id: 'sennrich2016', authors: 'R. Sennrich, B. Haddow, A. Birch', title: 'Neural Machine Translation of Rare Words with Subword Units', venue: 'ACL 2016', year: 2016, url: 'https://arxiv.org/abs/1508.07909' },
  { id: 'kudo2018', authors: 'T. Kudo, J. Richardson', title: 'SentencePiece: A simple and language independent subword tokenizer and detokenizer', venue: 'EMNLP 2018', year: 2018, url: 'https://arxiv.org/abs/1808.06226' },

  // --- трансформер и GPT ---
  { id: 'vaswani2017', authors: 'A. Vaswani, N. Shazeer, N. Parmar, J. Uszkoreit, L. Jones, A. N. Gomez, Ł. Kaiser, I. Polosukhin', title: 'Attention Is All You Need', venue: 'NeurIPS 2017', year: 2017, url: 'https://arxiv.org/abs/1706.03762' },
  { id: 'radford2018', authors: 'A. Radford, K. Narasimhan, T. Salimans, I. Sutskever', title: 'Improving Language Understanding by Generative Pre-Training (GPT-1)', venue: 'OpenAI technical report', year: 2018, url: 'https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf' },
  { id: 'radford2019', authors: 'A. Radford, J. Wu, R. Child, D. Luan, D. Amodei, I. Sutskever', title: 'Language Models are Unsupervised Multitask Learners (GPT-2)', venue: 'OpenAI technical report', year: 2019, url: 'https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf' },
  { id: 'brown2020', authors: 'T. B. Brown, B. Mann, N. Ryder и др.', title: 'Language Models are Few-Shot Learners (GPT-3)', venue: 'NeurIPS 2020', year: 2020, url: 'https://arxiv.org/abs/2005.14165' },
  { id: 'press2017', authors: 'O. Press, L. Wolf', title: 'Using the Output Embedding to Improve Language Models (weight tying)', venue: 'EACL 2017', year: 2017, url: 'https://arxiv.org/abs/1608.05859' },
  { id: 'elhage2021', authors: 'N. Elhage, N. Nanda, C. Olsson и др.', title: 'A Mathematical Framework for Transformer Circuits', venue: 'Transformer Circuits Thread', year: 2021, url: 'https://transformer-circuits.pub/2021/framework/index.html' },
  { id: 'olsson2022', authors: 'C. Olsson, N. Elhage, N. Nanda и др.', title: 'In-context Learning and Induction Heads', venue: 'arXiv:2209.11895', year: 2022, url: 'https://arxiv.org/abs/2209.11895' },

  // --- генерация ---
  { id: 'fan2018', authors: 'A. Fan, M. Lewis, Y. Dauphin', title: 'Hierarchical Neural Story Generation (top-k sampling)', venue: 'ACL 2018', year: 2018, url: 'https://arxiv.org/abs/1805.04833' },
  { id: 'holtzman2019', authors: 'A. Holtzman, J. Buys, L. Du, M. Forbes, Y. Choi', title: 'The Curious Case of Neural Text Degeneration (nucleus / top-p sampling)', venue: 'ICLR 2020', year: 2020, url: 'https://arxiv.org/abs/1904.09751' },
  { id: 'pope2022', authors: 'R. Pope, S. Douglas, A. Chowdhery и др.', title: 'Efficiently Scaling Transformer Inference (KV-кэш, анализ инференса)', venue: 'MLSys 2023', year: 2023, url: 'https://arxiv.org/abs/2211.05102' },
  { id: 'kwon2023', authors: 'W. Kwon, Z. Li, S. Zhuang и др.', title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention (vLLM)', venue: 'SOSP 2023', year: 2023, url: 'https://arxiv.org/abs/2309.06180' },

  // --- масштабирование ---
  { id: 'kaplan2020', authors: 'J. Kaplan, S. McCandlish, T. Henighan и др.', title: 'Scaling Laws for Neural Language Models', venue: 'arXiv:2001.08361', year: 2020, url: 'https://arxiv.org/abs/2001.08361' },
  { id: 'hoffmann2022', authors: 'J. Hoffmann, S. Borgeaud, A. Mensch и др.', title: 'Training Compute-Optimal Large Language Models (Chinchilla)', venue: 'NeurIPS 2022', year: 2022, url: 'https://arxiv.org/abs/2203.15556' },
  { id: 'wei2022emergent', authors: 'J. Wei, Y. Tay, R. Bommasani и др.', title: 'Emergent Abilities of Large Language Models', venue: 'TMLR 2022', year: 2022, url: 'https://arxiv.org/abs/2206.07682' },
  { id: 'wei2022cot', authors: 'J. Wei, X. Wang, D. Schuurmans и др.', title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models', venue: 'NeurIPS 2022', year: 2022, url: 'https://arxiv.org/abs/2201.11903' },

  // --- современные архитектурные улучшения ---
  { id: 'su2021', authors: 'J. Su, Y. Lu, S. Pan, A. Murtadha, B. Wen, Y. Liu', title: 'RoFormer: Enhanced Transformer with Rotary Position Embedding', venue: 'arXiv:2104.09864', year: 2021, url: 'https://arxiv.org/abs/2104.09864' },
  { id: 'zhang2019', authors: 'B. Zhang, R. Sennrich', title: 'Root Mean Square Layer Normalization', venue: 'NeurIPS 2019', year: 2019, url: 'https://arxiv.org/abs/1910.07467' },
  { id: 'shazeer2020', authors: 'N. Shazeer', title: 'GLU Variants Improve Transformer', venue: 'arXiv:2002.05202', year: 2020, url: 'https://arxiv.org/abs/2002.05202' },
  { id: 'shazeer2019', authors: 'N. Shazeer', title: 'Fast Transformer Decoding: One Write-Head is All You Need (Multi-Query Attention)', venue: 'arXiv:1911.02150', year: 2019, url: 'https://arxiv.org/abs/1911.02150' },
  { id: 'ainslie2023', authors: 'J. Ainslie, J. Lee-Thorp, M. de Jong и др.', title: 'GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints', venue: 'EMNLP 2023', year: 2023, url: 'https://arxiv.org/abs/2305.13245' },
  { id: 'dao2022', authors: 'T. Dao, D. Y. Fu, S. Ermon, A. Rudra, C. Ré', title: 'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness', venue: 'NeurIPS 2022', year: 2022, url: 'https://arxiv.org/abs/2205.14135' },
  { id: 'touvron2023', authors: 'H. Touvron, T. Lavril, G. Izacard и др.', title: 'LLaMA: Open and Efficient Foundation Language Models', venue: 'arXiv:2302.13971', year: 2023, url: 'https://arxiv.org/abs/2302.13971' },

  // --- выравнивание (alignment) ---
  { id: 'christiano2017', authors: 'P. Christiano, J. Leike, T. B. Brown и др.', title: 'Deep Reinforcement Learning from Human Preferences', venue: 'NeurIPS 2017', year: 2017, url: 'https://arxiv.org/abs/1706.03741' },
  { id: 'ouyang2022', authors: 'L. Ouyang, J. Wu, X. Jiang и др.', title: 'Training language models to follow instructions with human feedback (InstructGPT)', venue: 'NeurIPS 2022', year: 2022, url: 'https://arxiv.org/abs/2203.02155' },
  { id: 'schulman2017', authors: 'J. Schulman, F. Wolski, P. Dhariwal, A. Radford, O. Klimov', title: 'Proximal Policy Optimization Algorithms', venue: 'arXiv:1707.06347', year: 2017, url: 'https://arxiv.org/abs/1707.06347' },
  { id: 'rafailov2023', authors: 'R. Rafailov, A. Sharma, E. Mitchell, S. Ermon, C. D. Manning, C. Finn', title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model', venue: 'NeurIPS 2023', year: 2023, url: 'https://arxiv.org/abs/2305.18290' },
  { id: 'hu2021', authors: 'E. J. Hu, Y. Shen, P. Wallis и др.', title: 'LoRA: Low-Rank Adaptation of Large Language Models', venue: 'ICLR 2022', year: 2022, url: 'https://arxiv.org/abs/2106.09685' },

  // --- данные и инструменты ---
  { id: 'eldan2023', authors: 'R. Eldan, Y. Li', title: 'TinyStories: How Small Can Language Models Be and Still Speak Coherent English?', venue: 'arXiv:2305.07759', year: 2023, url: 'https://arxiv.org/abs/2305.07759' },
  { id: 'gao2020', authors: 'L. Gao, S. Biderman, S. Black и др.', title: 'The Pile: An 800GB Dataset of Diverse Text for Language Modeling', venue: 'arXiv:2101.00027', year: 2020, url: 'https://arxiv.org/abs/2101.00027' },
  { id: 'paszke2019', authors: 'A. Paszke, S. Gross, F. Massa и др.', title: 'PyTorch: An Imperative Style, High-Performance Deep Learning Library', venue: 'NeurIPS 2019', year: 2019, url: 'https://arxiv.org/abs/1912.01703' },
];

export const REF_INDEX = Object.fromEntries(REFS.map((r, i) => [r.id, { ...r, n: i + 1 }]));
