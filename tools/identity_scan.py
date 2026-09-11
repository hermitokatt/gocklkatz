#!/usr/bin/env python3
"""Find forbidden identities in files, by digest.

Usage:
    identity_scan.py <digests-file>            # file paths, one per line, on stdin

Reads SHA-256 digests (one per line, `#` comments allowed) and prints one line per match:

    <file>:<line>: forbidden identity (digest <first 12 hex>)

The matched text is deliberately not printed. Echoing it would defeat the point of storing only
digests: a finding report is itself written to a log or a terminal, and neither should carry the
identity.

Matching is on a lowercased word token, and on each adjacent pair of tokens. Single tokens catch
addresses and identifiers; pairs catch a given name and surname separated by a space. Two tokens
is the longest window, which keeps this linear in file size.

Exit code is 0 whether or not anything matched: the caller decides what a finding means.
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

WORD = re.compile(r"[0-9A-Za-z_.@+-]+")


def load_digests(path: str) -> set[str]:
    out = set()
    for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        out.add(line.lower())
    return out


def digests_of(text: str) -> set[str]:
    """Digests of every lowercased token and every adjacent token pair."""
    seen: set[str] = set()
    for line in text.splitlines():
        tokens = [t.lower() for t in WORD.findall(line)]
        for i, tok in enumerate(tokens):
            seen.add(hashlib.sha256(tok.encode()).hexdigest())
            if i + 1 < len(tokens):
                pair = f"{tok} {tokens[i + 1]}"
                seen.add(hashlib.sha256(pair.encode()).hexdigest())
    return seen


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    digests_path = argv[1]
    files = [line.strip() for line in sys.stdin.read().splitlines() if line.strip()]
    wanted = load_digests(digests_path)
    if not wanted:
        return 0

    findings: list[str] = []
    for name in files:
        try:
            text = Path(name).read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            print(f"identity_scan: cannot read {name}: {exc.strerror}", file=sys.stderr)
            return 2
        for line_no, line in enumerate(text.splitlines(), start=1):
            tokens = [t.lower() for t in WORD.findall(line)]
            windows = list(tokens)
            windows += [f"{tokens[i]} {tokens[i + 1]}" for i in range(len(tokens) - 1)]
            for window in windows:
                digest = hashlib.sha256(window.encode()).hexdigest()
                if digest in wanted:
                    findings.append(f"{name}:{line_no}: forbidden identity (digest {digest[:12]})")
                    break

    for f in findings:
        print(f)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
