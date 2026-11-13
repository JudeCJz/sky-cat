#!/usr/bin/env python3
"""Inline every <script src="..."> of sky-cat/index.html into dist/sky-cat.html."""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def main():
    with open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as f:
        html = f.read()

    def inline(m):
        path = os.path.join(ROOT, m.group(1))
        with open(path, encoding='utf-8') as f:
            js = f.read().replace('</script', '<\\/script')
        return '<script>\n' + js + '\n</script>'

    out = re.sub(r'<script\s+src="([^"]+)"\s*>\s*</script>', inline, html)
    dist = os.path.join(ROOT, 'dist')
    os.makedirs(dist, exist_ok=True)
    target = os.path.join(dist, 'sky-cat.html')
    with open(target, 'w', encoding='utf-8') as f:
        f.write(out)
    print('wrote %s (%.1f KB)' % (target, os.path.getsize(target) / 1024.0))


if __name__ == '__main__':
    main()
