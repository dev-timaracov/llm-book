// Реальный лог обучения, полученный при подготовке учебника (Linux, 4 ядра CPU, ~2.5 минуты).
export const CPU_CMD = '--device cpu --n_layer 4 --n_head 4 --n_embd 128 --block_size 64 --batch_size 32 --max_iters 1500 --eval_interval 500 --eval_iters 20 --log_interval 250 --dropout 0.0 --lr 2e-3';
export const CPU_TIME = '≈2.5 мин (4 ядра)';
export const CPU_LOG = `параметров (без позиционных эмбеддингов): 0.80M; устройство: cpu
loss в начале должен быть ≈ ln(65) = 4.174
...
шаг     0 | loss 4.1876 | lr 2.00e-05 | норма град. 5.45 | 307,932 ток/с
шаг   250 | loss 2.2906 | lr 1.95e-03 | норма град. 1.00 | 23,053 ток/с
[eval] шаг 500: train 1.9460, val 2.0459
        сохранён чекпоинт (лучший val 2.0459)
шаг   500 | loss 1.9664 | lr 1.64e-03 | норма град. 1.02 | 22,098 ток/с
шаг   750 | loss 1.6891 | lr 1.16e-03 | норма град. 1.02 | 23,179 ток/с
[eval] шаг 1000: train 1.6424, val 1.8171
        сохранён чекпоинт (лучший val 1.8171)
шаг  1000 | loss 1.6109 | lr 6.38e-04 | норма град. 0.92 | 22,688 ток/с
шаг  1250 | loss 1.5107 | lr 2.46e-04 | норма град. 0.91 | 24,141 ток/с
[eval] шаг 1500: train 1.5362, val 1.7219
        сохранён чекпоинт (лучший val 1.7219)
готово. лучший val loss: 1.7219. Запустите: python sample.py --out_dir out

real    2m22s`;
export const CPU_SAMPLE = `$ python sample.py --num_samples 1 --num_tokens 200 --start "ROMEO:" --top_p 0.9
загружен чекпоинт: шаг 1500, val loss 1.7219
---------------- образец 1 ----------------
ROMEO:
There of this serve and brother than with heart.

DUKE VINCENTIO:
Here were some, for I may again in for briet
With most sate you make and fair: your content
For such a bone ear your deplection of co`;
