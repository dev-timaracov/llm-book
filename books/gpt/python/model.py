"""
model.py — GPT (decoder-only трансформер) с нуля на PyTorch.

Главы 9–13 учебника. Архитектура повторяет GPT-2 (Radford и др., 2019):
  - токенные + обучаемые позиционные эмбеддинги
  - N блоков: x = x + Attn(LN(x));  x = x + MLP(LN(x))   (pre-LayerNorm, Xiong и др., 2020)
  - финальный LayerNorm и линейная «голова», веса которой связаны с эмбеддингами
    (weight tying, Press & Wolf, 2017)
Внимание — scaled dot-product attention из «Attention Is All You Need» (Vaswani и др., 2017)
с каузальной маской: токен видит только себя и предыдущие.

Каждая строка намеренно написана «руками», без nn.MultiheadAttention и nn.TransformerBlock.
"""
import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class GPTConfig:
    vocab_size: int = 50304   # размер словаря (у GPT-2 50257; округление до кратного 64 ускоряет GPU)
    block_size: int = 256     # максимальная длина контекста T
    n_layer: int = 6          # число блоков трансформера
    n_head: int = 6           # число голов внимания
    n_embd: int = 384         # ширина модели C (размер вектора каждого токена)
    dropout: float = 0.0      # вероятность dropout (Srivastava и др., 2014)
    bias: bool = True         # использовать ли bias в Linear и LayerNorm


class LayerNorm(nn.Module):
    """y = (x - mean) / sqrt(var + eps) * weight + bias   — Ba, Kiros, Hinton (2016).
    Нормируем каждый вектор токена отдельно по его C компонентам."""

    def __init__(self, ndim, bias=True, eps=1e-5):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(ndim))
        self.bias = nn.Parameter(torch.zeros(ndim)) if bias else None
        self.eps = eps

    def forward(self, x):
        mean = x.mean(dim=-1, keepdim=True)
        var = x.var(dim=-1, keepdim=True, unbiased=False)
        x = (x - mean) / torch.sqrt(var + self.eps)
        x = x * self.weight
        return x + self.bias if self.bias is not None else x


class CausalSelfAttention(nn.Module):
    """Многоголовое каузальное самовнимание.
    Attention(Q, K, V) = softmax(Q Kᵀ / sqrt(d_k) + mask) V"""

    def __init__(self, cfg: GPTConfig):
        super().__init__()
        assert cfg.n_embd % cfg.n_head == 0, "n_embd должно делиться на n_head"
        self.n_head = cfg.n_head
        self.n_embd = cfg.n_embd
        # одна матрица сразу для Q, K и V — так быстрее, чем три отдельных
        self.c_attn = nn.Linear(cfg.n_embd, 3 * cfg.n_embd, bias=cfg.bias)
        # выходная проекция: смешивает результаты голов
        self.c_proj = nn.Linear(cfg.n_embd, cfg.n_embd, bias=cfg.bias)
        self.c_proj.RESIDUAL_SCALE = True   # особая инициализация, см. GPT._init_weights
        self.attn_dropout = nn.Dropout(cfg.dropout)
        self.resid_dropout = nn.Dropout(cfg.dropout)
        self.dropout = cfg.dropout
        # нижнетреугольная матрица: mask[i, j] = 1, если j <= i
        mask = torch.tril(torch.ones(cfg.block_size, cfg.block_size))
        self.register_buffer("mask", mask.view(1, 1, cfg.block_size, cfg.block_size), persistent=False)
        # если доступен «слитый» быстрый кернел (FlashAttention, Dao и др., 2022) — используем его
        self.flash = hasattr(F, "scaled_dot_product_attention")

    def forward(self, x):
        B, T, C = x.size()          # батч, длина последовательности, ширина
        hs = C // self.n_head       # размер одной головы

        q, k, v = self.c_attn(x).split(self.n_embd, dim=2)          # 3 × (B, T, C)
        # (B, T, C) -> (B, T, nh, hs) -> (B, nh, T, hs): головы становятся «батч-измерением»
        q = q.view(B, T, self.n_head, hs).transpose(1, 2)
        k = k.view(B, T, self.n_head, hs).transpose(1, 2)
        v = v.view(B, T, self.n_head, hs).transpose(1, 2)

        if self.flash:
            # математически то же самое, что ветка ниже, но не хранит матрицу T×T целиком
            y = F.scaled_dot_product_attention(
                q, k, v, attn_mask=None, dropout_p=self.dropout if self.training else 0.0, is_causal=True)
        else:
            att = (q @ k.transpose(-2, -1)) / math.sqrt(hs)          # (B, nh, T, T) — «сходство» токенов
            att = att.masked_fill(self.mask[:, :, :T, :T] == 0, float("-inf"))  # запрет смотреть в будущее
            att = F.softmax(att, dim=-1)                              # каждая строка — распределение
            att = self.attn_dropout(att)
            y = att @ v                                               # (B, nh, T, hs) — взвешенная сумма значений

        y = y.transpose(1, 2).contiguous().view(B, T, C)              # склеиваем головы обратно
        return self.resid_dropout(self.c_proj(y))


class MLP(nn.Module):
    """Позиционно-независимая двухслойная сеть: Linear(C→4C) → GELU → Linear(4C→C)."""

    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.c_fc = nn.Linear(cfg.n_embd, 4 * cfg.n_embd, bias=cfg.bias)
        self.c_proj = nn.Linear(4 * cfg.n_embd, cfg.n_embd, bias=cfg.bias)
        self.c_proj.RESIDUAL_SCALE = True
        self.dropout = nn.Dropout(cfg.dropout)

    def forward(self, x):
        x = self.c_fc(x)
        x = F.gelu(x, approximate="tanh")   # GELU (Hendrycks & Gimpel, 2016), tanh-вариант как в GPT-2
        x = self.c_proj(x)
        return self.dropout(x)


class Block(nn.Module):
    """Блок трансформера с pre-LayerNorm и остаточными связями (He и др., 2016)."""

    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.ln_1 = LayerNorm(cfg.n_embd, bias=cfg.bias)
        self.attn = CausalSelfAttention(cfg)
        self.ln_2 = LayerNorm(cfg.n_embd, bias=cfg.bias)
        self.mlp = MLP(cfg)

    def forward(self, x):
        x = x + self.attn(self.ln_1(x))   # токены «общаются» друг с другом
        x = x + self.mlp(self.ln_2(x))    # каждый токен «думает» сам по себе
        return x


class GPT(nn.Module):
    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.cfg = cfg
        self.transformer = nn.ModuleDict(dict(
            wte=nn.Embedding(cfg.vocab_size, cfg.n_embd),   # token embedding
            wpe=nn.Embedding(cfg.block_size, cfg.n_embd),   # position embedding
            drop=nn.Dropout(cfg.dropout),
            h=nn.ModuleList([Block(cfg) for _ in range(cfg.n_layer)]),
            ln_f=LayerNorm(cfg.n_embd, bias=cfg.bias),
        ))
        self.lm_head = nn.Linear(cfg.n_embd, cfg.vocab_size, bias=False)
        # weight tying: матрица «токен → вектор» и «вектор → логиты токенов» одна и та же
        self.transformer.wte.weight = self.lm_head.weight
        self.apply(self._init_weights)

    def _init_weights(self, module):
        # как в GPT-2: N(0, 0.02); проекции в остаточный поток масштабируем на 1/sqrt(2·n_layer),
        # чтобы дисперсия суммы 2·n_layer слагаемых в остаточном потоке не росла с глубиной
        if isinstance(module, nn.Linear):
            std = 0.02
            if getattr(module, "RESIDUAL_SCALE", False):
                std *= (2 * self.cfg.n_layer) ** -0.5
            nn.init.normal_(module.weight, mean=0.0, std=std)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def num_params(self, non_embedding=True):
        n = sum(p.numel() for p in self.parameters())
        if non_embedding:
            n -= self.transformer.wpe.weight.numel()
        return n

    def forward(self, idx, targets=None):
        B, T = idx.size()
        assert T <= self.cfg.block_size, f"последовательность {T} длиннее block_size {self.cfg.block_size}"
        pos = torch.arange(0, T, dtype=torch.long, device=idx.device)       # (T,)
        x = self.transformer.wte(idx) + self.transformer.wpe(pos)          # (B, T, C)
        x = self.transformer.drop(x)
        for block in self.transformer.h:
            x = block(x)
        x = self.transformer.ln_f(x)
        logits = self.lm_head(x)                                           # (B, T, vocab_size)
        loss = None
        if targets is not None:
            # кросс-энтропия по всем B·T позициям сразу: каждая позиция — отдельная задача
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))
        return logits, loss

    def configure_optimizers(self, weight_decay, learning_rate, betas, device_type):
        # AdamW (Loshchilov & Hutter, 2019). Weight decay применяем только к матрицам:
        # bias и параметры LayerNorm (одномерные) не регуляризуем.
        params = [p for p in self.parameters() if p.requires_grad]
        decay = [p for p in params if p.dim() >= 2]
        no_decay = [p for p in params if p.dim() < 2]
        groups = [{"params": decay, "weight_decay": weight_decay},
                  {"params": no_decay, "weight_decay": 0.0}]
        print(f"параметров с decay: {sum(p.numel() for p in decay):,}; без decay: {sum(p.numel() for p in no_decay):,}")
        fused = device_type == "cuda"
        return torch.optim.AdamW(groups, lr=learning_rate, betas=betas, fused=fused)

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None, top_p=None):
        """Авторегрессионная генерация: предсказываем токен, дописываем, повторяем."""
        for _ in range(max_new_tokens):
            idx_cond = idx[:, -self.cfg.block_size:]          # модель видит не больше block_size токенов
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / max(temperature, 1e-6)  # интересует только последняя позиция
            if top_k is not None:                               # top-k (Fan и др., 2018)
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = float("-inf")
            if top_p is not None:                               # nucleus / top-p (Holtzman и др., 2020)
                sorted_logits, sorted_idx = torch.sort(logits, descending=True)
                cum = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)
                remove = cum - F.softmax(sorted_logits, dim=-1) > top_p   # оставляем минимальный префикс с массой ≥ p
                sorted_logits[remove] = float("-inf")
                logits = torch.full_like(logits, float("-inf")).scatter(1, sorted_idx, sorted_logits)
            probs = F.softmax(logits, dim=-1)
            next_id = torch.multinomial(probs, num_samples=1)
            idx = torch.cat((idx, next_id), dim=1)
        return idx


if __name__ == "__main__":
    # Самопроверка: размер GPT-2 small должен получиться ≈124M параметров
    cfg = GPTConfig(vocab_size=50257, block_size=1024, n_layer=12, n_head=12, n_embd=768)
    m = GPT(cfg)
    print(f"GPT-2 small: {sum(p.numel() for p in m.parameters()):,} параметров")
    x = torch.randint(0, cfg.vocab_size, (2, 16))
    y = torch.randint(0, cfg.vocab_size, (2, 16))
    logits, loss = m(x, y)
    print("logits:", tuple(logits.shape), f"loss при случайных весах: {loss.item():.3f}",
          f"(ожидаем ≈ ln(V) = {math.log(cfg.vocab_size):.3f})")
