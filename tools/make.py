import json, sys
from PIL import Image
d = json.load(open('cat.json'))
rows, cols = d['rows'], d['colors']
def rgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)
N = 32
im = Image.new('RGBA', (N, N), (0,0,0,0))
px = im.load()
SKY1, SKY2, HILL, HILL2, EDGE = rgb('#4da6ff'), rgb('#8fd3ff'), rgb('#3fae4a'), rgb('#2a7d3a'), rgb('#1a1226')
r = 5  # rounded corner radius
def inside(x, y):
    for cx, cy in ((r, r), (N-1-r, r), (r, N-1-r), (N-1-r, N-1-r)):
        if (x < r if cx == r else x > N-1-r) and (y < r if cy == r else y > N-1-r):
            return (x-cx)**2 + (y-cy)**2 <= r*r + 1
    return True
for y in range(N):
    for x in range(N):
        if not inside(x, y): continue
        c = SKY1 if y < 12 else SKY2
        if y in (11, 12, 13) and (x + y) % 2 == 0: c = SKY2 if y == 11 else SKY1  # dither band
        if y >= 25: c = HILL if y < 28 else HILL2
        px[x, y] = c
# 1px dark rim
for y in range(N):
    for x in range(N):
        if px[x, y][3] and any(not (0 <= x+dx < N and 0 <= y+dy < N) or px[x+dx, y+dy][3] == 0 for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
            px[x, y] = EDGE
# cat, 28x26, centred, sitting on the hill
ox, oy = 2, 4
for y, row in enumerate(rows):
    for x, ch in enumerate(row):
        if ch != '.' and ch in cols and 0 <= oy+y < N:
            if px[ox+x, oy+y][3]:
                px[ox+x, oy+y] = rgb(cols[ch])
im.save('icon32.png')
big = {s: im.resize((s, s), Image.NEAREST) for s in (32, 64, 128, 256, 512)}
big[512].save('icon512.png'); big[256].save('preview.png')
small = {s: im.resize((s, s), Image.LANCZOS) for s in (16, 24, 48)}
allimgs = {**small, **big}
allimgs[256].save('sky-cat.ico', sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)], append_images=[allimgs[s] for s in (16, 24, 32, 48, 64, 128)])
print('ok')
