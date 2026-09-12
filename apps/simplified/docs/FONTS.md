# Fonts for Simplified

Notes for upcoming study UI (SIM-004+). The radicals API does not render glyphs in a browser chrome yet, but UI work should pick fonts that match **mainland simplified** character shapes.

## Mainland-simplified glyph preference

- Prefer fonts that target **PRC / mainland simplified** forms (e.g. Source Han Sans SC / Noto Sans SC, or system stacks that resolve to PingFang SC / Microsoft YaHei on typical devices).
- Avoid defaulting to **Traditional Chinese** or **Japanese** CJK fonts for radical study: some glyphs differ in stroke count or structure even when the code point is shared.
- Combining radical forms (亻, 氵, 忄, 扌, 讠, 纟, …) must remain legible at list and detail sizes; test those variants explicitly when wiring CSS.
- Some seed `forms` use **radical / compatibility** code points (e.g. ⺮, ⻊, 疒, 宀, 冫, 囗), not only everyday Han characters. Study UI must confirm the chosen mainland-simplified font draws these glyphs (no tofu / missing-glyph boxes) at list and detail sizes.
- Keep CSS-first font loading (no Tailwind). Document any new webfont package in `docs/DEPENDENCY_ALLOWLIST.md` before adding it.
