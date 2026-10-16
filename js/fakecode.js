export const MAIN_PY = `"""Hanzi trainer: sequence encoder for tone and pinyin classification."""
import os
import json
import random
import argparse
from pathlib import Path

import numpy as np
import torch
from torch import nn, optim
from torch.utils.data import DataLoader, Dataset

from utils import load_corpus, build_vocab, set_seed

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BATCH_SIZE = 64
LEARNING_RATE = 3e-4
MAX_LEN = 48


class HanziDataset(Dataset):
    def __init__(self, samples, vocab):
        self.samples = samples
        self.vocab = vocab

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        text, tone = self.samples[idx]
        ids = [self.vocab.get(ch, 0) for ch in text[:MAX_LEN]]
        ids += [0] * (MAX_LEN - len(ids))
        return torch.tensor(ids), torch.tensor(tone)


class Encoder(nn.Module):
    def __init__(self, vocab_size, dim=256, hidden=512):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, dim, padding_idx=0)
        self.rnn = nn.GRU(dim, hidden, batch_first=True, bidirectional=True)
        self.drop = nn.Dropout(0.2)
        self.head = nn.Linear(hidden * 2, 5)

    def forward(self, x):
        h, _ = self.rnn(self.embed(x))
        pooled = h.mean(dim=1)
        return self.head(self.drop(pooled))


def accuracy(logits, target):
    pred = logits.argmax(dim=-1)
    return (pred == target).float().mean().item()


def train_one_epoch(model, loader, optimizer, criterion):
    model.train()
    total, acc = 0.0, 0.0
    for step, (x, y) in enumerate(loader):
        x, y = x.to(DEVICE), y.to(DEVICE)
        optimizer.zero_grad()
        logits = model(x)
        loss = criterion(logits, y)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        total += loss.item()
        acc += accuracy(logits, y)
    return total / len(loader), acc / len(loader)


@torch.no_grad()
def evaluate(model, loader, criterion):
    model.eval()
    total, acc = 0.0, 0.0
    for x, y in loader:
        x, y = x.to(DEVICE), y.to(DEVICE)
        logits = model(x)
        total += criterion(logits, y).item()
        acc += accuracy(logits, y)
    return total / len(loader), acc / len(loader)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--data", type=Path, default=Path("data/corpus.json"))
    args = parser.parse_args()

    set_seed(42)
    samples = load_corpus(args.data)
    vocab = build_vocab(samples)
    random.shuffle(samples)
    split = int(len(samples) * 0.9)

    train_ds = HanziDataset(samples[:split], vocab)
    val_ds = HanziDataset(samples[split:], vocab)
    train_dl = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=BATCH_SIZE)

    model = Encoder(len(vocab)).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(args.epochs):
        loss, acc = train_one_epoch(model, train_dl, optimizer, criterion)
        val_loss, val_acc = evaluate(model, val_dl, criterion)
        print(f"epoch {epoch:03d} loss={loss:.4f} acc={acc:.3f} val={val_acc:.3f}")


if __name__ == "__main__":
    main()
`.split('\n');

export const UTILS_PY = `import json
import random
from collections import Counter
from pathlib import Path

import numpy as np
import torch


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def load_corpus(path: Path):
    with open(path, "r", encoding="utf-8") as fh:
        rows = json.load(fh)
    return [(r["text"], int(r["tone"])) for r in rows if r.get("text")]


def build_vocab(samples, min_freq: int = 2):
    counter = Counter(ch for text, _ in samples for ch in text)
    vocab = {"<pad>": 0}
    for ch, freq in counter.most_common():
        if freq >= min_freq:
            vocab[ch] = len(vocab)
    return vocab


def batchify(items, size):
    for i in range(0, len(items), size):
        yield items[i : i + size]
`.split('\n');

export const README_MD = `# hanzi-trainer

Tone classification experiments for Mandarin syllables.

## Usage

    python main.py --epochs 100

## Notes

- Dataset lives in data/corpus.json
- Checkpoints are written to runs/
`.split('\n');

export const REQ_TXT = ['numpy>=1.26', 'torch>=2.2', 'tqdm>=4.66', 'pandas>=2.1'];

/** Blocks of code that get "typed" into main.py / utils.py over time. */
export const POOL = [
  [
    '',
    'def plot_history(history, out_dir="runs"):',
    '    os.makedirs(out_dir, exist_ok=True)',
    '    xs = list(range(len(history["loss"])))',
    '    np.save(os.path.join(out_dir, "loss.npy"), np.array(history["loss"]))',
    '    return xs',
  ],
  [
    '',
    'class EarlyStopping:',
    '    def __init__(self, patience=8, delta=1e-4):',
    '        self.patience = patience',
    '        self.delta = delta',
    '        self.best = float("inf")',
    '        self.count = 0',
    '',
    '    def step(self, value):',
    '        if value < self.best - self.delta:',
    '            self.best, self.count = value, 0',
    '            return False',
    '        self.count += 1',
    '        return self.count >= self.patience',
  ],
  [
    '',
    'def save_checkpoint(model, optimizer, epoch, path):',
    '    state = {',
    '        "epoch": epoch,',
    '        "model": model.state_dict(),',
    '        "optim": optimizer.state_dict(),',
    '    }',
    '    torch.save(state, path)',
  ],
  [
    '',
    'def confusion_matrix(preds, targets, classes=5):',
    '    m = np.zeros((classes, classes), dtype=int)',
    '    for p, t in zip(preds, targets):',
    '        m[t][p] += 1',
    '    return m',
  ],
  [
    '',
    'def lr_lambda(step, warmup=500):',
    '    if step < warmup:',
    '        return (step + 1) / warmup',
    '    return max(0.05, 0.5 * (1 + np.cos(np.pi * (step - warmup) / 10000)))',
  ],
  [
    '',
    'def tokenize(text):',
    '    # split on whitespace and punctuation, keep hanzi as single tokens',
    '    out, buf = [], ""',
    '    for ch in text:',
    '        if "\\u4e00" <= ch <= "\\u9fff":',
    '            if buf:',
    '                out.append(buf)',
    '                buf = ""',
    '            out.append(ch)',
    '        elif ch.isalnum():',
    '            buf += ch',
    '    if buf:',
    '        out.append(buf)',
    '    return out',
  ],
];
