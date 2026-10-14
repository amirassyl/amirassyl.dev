"""Pixel Amir sprite generator: shapes -> letter grid -> PNG preview.

Usage: python3 scripts/twin-sprite.py preview.png
Prints the letter grid; paste it into SPRITE in public/twin.js. Colours here are
for the preview only; the site takes them from the --twin-* tokens in global.css.
Needs Pillow (pip install pillow).

Chibi rules: about two heads tall, big low eyes with a highlight, no neck,
round jaw, blush, tiny mouth, coloured outlines (selout) instead of black.
"""
import math, sys, json
from PIL import Image

W, H = 24, 32
PAL = {
    'K': '#24170f', 'H': '#3d2a1f', 'h': '#5e4333',            # hair + outline
    'o': '#a8664a', 'S': '#f4c9a4', 's': '#e3ad88',            # skin
    'E': '#2a1d18', 'w': '#ffffff', 'G': '#7d675b', 'b': '#f29a8c', 'm': '#b4574a',
    'n': '#1b2340', 'W': '#f6f3ec', 'N': '#2c3a66',            # tee
    'q': '#161d33', 'J': '#33456f', 'j': '#27375a',            # jeans
    'F': '#ffffff', 'B': '#2a2a2a',                            # sneakers
}
OUTLINE = {'H': 'K', 'h': 'K', 'S': 'o', 's': 'o', 'b': 'o', 'W': 'n', 'N': 'n', 'J': 'q', 'j': 'q', 'F': 'B'}

g = [['.'] * W for _ in range(H)]
def put(x, y, c):
    if 0 <= x < W and 0 <= y < H: g[y][x] = c

CX, CY, RX, RY = 11.5, 9.6, 9.6, 8.2
def in_head(x, y): return ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2 <= 1

# Face
for y in range(H):
    for x in range(W):
        if in_head(x, y): put(x, y, 'S')

# Hair: a fluffy wavy cap a bit bigger than the head, above a wavy fringe line.
HAIRLINE = {3: 11, 4: 10, 5: 8, 6: 7, 7: 6, 8: 6, 9: 7, 10: 6, 11: 5, 12: 5, 13: 6, 14: 7, 15: 6, 16: 6, 17: 7, 18: 8, 19: 10, 20: 11}
for y in range(H):
    for x in range(W):
        a = math.atan2(y - CY, x - CX)
        wave = 0.55 * math.sin(7 * a)
        inside = ((x - CX) / (RX + 1.0 + wave)) ** 2 + ((y - CY + 0.6) / (RY + 1.0 + wave)) ** 2 <= 1
        if inside and y < HAIRLINE.get(x, 99 if not (4 <= x <= 19) else 0) and y < 12:
            put(x, y, 'H')
# Wave highlights: short arcs
for x, y in [(6, 3), (7, 2), (8, 2), (9, 3), (13, 3), (14, 2), (15, 2), (16, 3), (4, 6), (5, 5), (10, 5), (11, 4), (12, 4), (17, 5), (18, 6)]:
    if g[y][x] == 'H': put(x, y, 'h')

# Body: no neck, short and round. Columns are symmetric around 11.5.
for y in range(18, 25):
    lo, hi = (8, 15) if y == 18 else (7, 16)
    for x in range(lo, hi + 1):
        put(x, y, 'N' if y in (20, 22, 24) else 'W')
for y in range(19, 24):  # stubby arms touching the body: sleeve, then hand
    for x in (6, 17):
        put(x, y, 'S' if y >= 22 else ('N' if y == 20 else 'W'))
for y in range(25, 29):  # jeans
    for x in range(7, 17):
        if y >= 27 and x in (11, 12): continue
        put(x, y, 'j' if x in (10, 13) and y >= 27 else 'J')
# Coloured outline (selout): any filled pixel next to empty space becomes its region's outline colour.
src = [row[:] for row in g]
for y in range(H):
    for x in range(W):
        c = src[y][x]
        if c == '.' or c not in OUTLINE: continue
        edge = any(not (0 <= x + dx < W and 0 <= y + dy < H) or src[y + dy][x + dx] == '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge: g[y][x] = OUTLINE[c]
# Sneakers: white with a dark outline and sole, drawn by hand
for x0 in (6, 13):
    for y, row in ((29, 'BFFFB'), (30, 'BFFBB' if x0 == 13 else 'BBFFB'), (31, 'BBBBB')):
        for i, c in enumerate(row):
            put(x0 + i, y, c)

# Face features (drawn after outlining so they stay crisp)
GLASSES = []
for ex in (7, 15):  # each eye is 2 wide: round frame one pixel around it
    GLASSES += [(ex, 10), (ex + 1, 10), (ex, 14), (ex + 1, 14)]
    GLASSES += [(ex - 1, y) for y in (11, 12, 13)] + [(ex + 2, y) for y in (11, 12, 13)]
GLASSES += [(10, 11), (11, 11), (12, 11), (13, 11)]  # bridge
for x, y in GLASSES:
    put(x, y, 'G')
for x in (7, 8, 15, 16):
    for y in (11, 12, 13):
        put(x, y, 'E')
put(7, 11, 'w'); put(15, 11, 'w')
for x in (4, 19): put(x, 15, 'b')
put(5, 15, 'b'); put(18, 15, 'b')
put(11, 16, 'm'); put(12, 16, 'm')
put(10, 15, 'm'); put(13, 15, 'm')

GRID = [''.join(r) for r in g]
if __name__ == '__main__':
    scale = 12
    img = Image.new('RGBA', (W * scale, H * scale), (252, 252, 250, 255))
    for y, row in enumerate(GRID):
        for x, c in enumerate(row):
            if c != '.':
                col = tuple(int(PAL[c][i:i + 2], 16) for i in (1, 3, 5)) + (255,)
                img.paste(col, (x * scale, y * scale, (x + 1) * scale, (y + 1) * scale))
    img.save(sys.argv[1])
    print('\n'.join(GRID))
