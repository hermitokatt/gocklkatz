#!/usr/bin/env python3
"""Scan files for a set of extended regular expressions, one process for all of them.

Usage:
    content_scan.py <patterns-file>            # file paths, one per line, on stdin

Prints one `<file>:<line>:<text>` line per match and exits:

    0  the scan ran (whether or not anything matched)
    2  the scan could not run — a pattern was invalid, or a named file was unreadable

`grep` and `xargs` are deliberately not used. Getting their exit codes right across BSD and GNU
means distinguishing "no match" (grep 1, which xargs reports as 123) from "could not run", and
the first version of this check got that wrong on CI while passing on macOS. One process, explicit
exit codes, the same behaviour everywhere.

Patterns are read from a file, one per line, `#` comments allowed, matched case-insensitively.
The matched text is printed because these are path and secret patterns rather than personal
identities; identities are handled by `identity_scan.py`, which prints only a digest.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Files whose bytes are not text carry no reviewable content, so they are skipped rather than
# read. Reporting them as "could not read" made the scan fail on ordinary PNG assets, which would
# have trained everyone to ignore the failure — the opposite of what a fail-closed check is for.
BINARY_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".pdf", ".zip", ".gz", ".tgz", ".tar", ".mp4", ".webm", ".mp3", ".wav",
    ".sqlite", ".db", ".wasm",
}


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    patterns_path = argv[1]
    files = [line.strip() for line in sys.stdin.read().splitlines() if line.strip()]

    raw = []
    for line in Path(patterns_path).read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            raw.append(line)
    if not raw:
        print(f"content_scan: {patterns_path} contains no patterns", file=sys.stderr)
        return 2

    try:
        combined = re.compile("|".join(f"(?:{p})" for p in raw), re.IGNORECASE)
    except re.error as exc:
        print(f"content_scan: invalid pattern: {exc}", file=sys.stderr)
        return 2

    unreadable = []
    for name in files:
        if Path(name).suffix.lower() in BINARY_SUFFIXES:
            continue
        try:
            text = Path(name).read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            unreadable.append(f"{name}: {exc.strerror}")
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            if combined.search(line):
                print(f"{name}:{line_no}:{line}")

    if unreadable:
        for entry in unreadable:
            print(f"content_scan: cannot read {entry}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
