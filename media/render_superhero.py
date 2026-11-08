import math, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from multiprocessing import Pool

W, H, K, FPS, DUR = 1280, 720, 2, 24, 30
GROUND = 560
HS = 1.25

def lerp(a, b, t): return a + (b - a) * t
def clamp(x, a=0, b=1): return max(a, min(b, x))
def sstep(a, b, t):
    u = clamp((t - a) / (b - a)); return u * u * (3 - 2 * u)
def mix(c1, c2, t): return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))

# ---- camera -------------------------------------------------------
_ts = np.linspace(0, 30, 3001)
_v = np.interp(_ts, [0, 9, 12, 20, 24, 30], [110, 110, 50, 50, 80, 8])
_cam = np.concatenate([[0], np.cumsum((_v[1:] + _v[:-1]) / 2 * 0.01)])
def cam(t): return float(np.interp(t, _ts, _cam))
def camy(t): return 150 * sstep(21, 30, t)
def X(t, sx): return cam(t) + sx

# ---- event layout (world coords) ---------------------------------
TX = X(10, 830)                  # tree
CX = X(14.5, 900)                # child
RX = cam(30) + 560               # rooftop hero spot
DUCK0 = X(16.5, 540)
def mom(t): return DUCK0 + 75 * (t - 16.5) if t < 21.5 else DUCK0 + 75 * 5 + 20 * (t - 21.5) * max(0, 1 - (t - 21.5) / 3)
BR = (TX + 70, 393)              # kitten branch spot
KG = (TX + 138, 572)             # kitten on ground
def bp(t):
    u = t - 14.6
    return (CX + 22 + 14 * u + 18 * math.sin(1.1 * u), 455 - 120 * u)

HERO_KF = [
    (0, X(0, 260), 330), (4, X(4, 500), 250), (8, X(8, 420), 300), (10, X(10, 380), 270),
    (11.4, TX - 110, 350), (12.3, TX + 38, 388), (13.4, TX + 70, 470), (14.3, TX + 100, 535),
    (14.9, TX + 120, 440), (15.8, CX - 160, 330),
    (16.5, bp(16.5)[0] - 36 * HS, bp(16.5)[1] + 90 + 6 * HS), (17.4, CX - 90, 470), (18.2, CX - 52, 515),
    (19.0, mom(19) + 110, 520), (20.6, mom(20.6) + 110, 515), (21.6, mom(21.6) + 130, 400),
    (23, RX - 220, 225), (24.6, RX, 243), (27, RX, 243), (30.1, RX, 243),
]
def catmull(kfs, t):
    ts = [k[0] for k in kfs]
    i = max(0, min(len(kfs) - 2, np.searchsorted(ts, t) - 1))
    p = lambda j: kfs[max(0, min(len(kfs) - 1, j))]
    u = (t - kfs[i][0]) / (kfs[i + 1][0] - kfs[i][0]); u = clamp(u)
    out = []
    for c in (1, 2):
        p0, p1, p2, p3 = p(i - 1)[c], p(i)[c], p(i + 1)[c], p(i + 2)[c]
        out.append(0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return out

# ---- static scenery -----------------------------------------------
PAL = [(255, 170, 140), (250, 205, 120), (240, 140, 165), (150, 200, 232), (192, 162, 232), (255, 190, 120), (130, 212, 190)]
def make_buildings(seed, x0, x1, wr, hr, gap):
    r = random.Random(seed); out = []; x = x0
    while x < x1:
        w = r.randint(*wr); h = r.randint(*hr)
        cols = max(2, w // 36); rows = max(2, h // 44)
        out.append(dict(x=x, w=w, h=h, c=r.choice(PAL), cols=cols, rows=rows,
                        win=[[r.random() for _ in range(cols)] for _ in range(rows)], roof=r.choice([0, 1, 2])))
        x += w + r.randint(*gap)
    return out
END = cam(30) + 1400
FAR = make_buildings(1, -100, END * 0.2 + 1500, (70, 150), (120, 330), (0, 20))
MID = make_buildings(2, -100, END * 0.5 + 1500, (100, 190), (180, 400), (0, 40))
NEAR = make_buildings(3, -100, END * 0.8 + 1500, (140, 250), (200, 440), (0, 30))
LAMPS = [CX - 340 + i * 520 for i in range(0, 8)]
CLOUDS = [(random.Random(i).uniform(0, 3000), random.Random(i + 9).uniform(60, 260), random.Random(i + 5).uniform(0.7, 1.3)) for i in range(14)]
rr = random.Random(7)
FIREFLIES = [(rr.uniform(0, W), rr.uniform(120, 640), rr.uniform(0, 6.28), rr.uniform(0.3, 0.9), rr.uniform(8, 30)) for _ in range(60)]

SKY_A = [((120, 120, 205), 0.0), ((255, 150, 150), 0.55), ((255, 214, 130), 1.0)]
SKY_B = [((40, 40, 120), 0.0), ((190, 95, 160), 0.6), ((255, 160, 120), 1.0)]
def sky_col(stops, y):
    for (c1, p1), (c2, p2) in zip(stops, stops[1:]):
        if y <= p2: return mix(c1, c2, (y - p1) / (p2 - p1))
    return stops[-1][0]

class Cv:
    def __init__(self, img):
        self.im = img; self.d = ImageDraw.Draw(img)
    def poly(self, pts, fill): self.d.polygon([(x * K, y * K) for x, y in pts], fill=fill)
    def rect(self, x0, y0, x1, y1, fill, r=0):
        b = [x0 * K, y0 * K, x1 * K, y1 * K]
        if r: self.d.rounded_rectangle(b, r * K, fill=fill)
        else: self.d.rectangle(b, fill=fill)
    def ell(self, cx, cy, rx, ry, fill): self.d.ellipse([(cx - rx) * K, (cy - ry) * K, (cx + rx) * K, (cy + ry) * K], fill=fill)
    def line(self, pts, fill, w): self.d.line([(x * K, y * K) for x, y in pts], fill=fill, width=int(w * K), joint='curve')
    def arc(self, cx, cy, rx, ry, a0, a1, fill, w): self.d.arc([(cx - rx) * K, (cy - ry) * K, (cx + rx) * K, (cy + ry) * K], a0, a1, fill=fill, width=int(w * K))
    def star(self, x, y, r, fill):
        self.poly([(x, y - r), (x + r * .18, y - r * .18), (x + r, y), (x + r * .18, y + r * .18), (x, y + r), (x - r * .18, y + r * .18), (x - r, y), (x - r * .18, y - r * .18)], fill)

def glow(g, x, y, r, col):  # g: small image drawn at 1/4 scale
    ImageDraw.Draw(g).ellipse([(x - r) / 4, (y - r) / 4, (x + r) / 4, (y + r) / 4], fill=col)

# ---- characters ---------------------------------------------------
SKIN = (255, 214, 186); SUIT = (64, 124, 232); RED = (236, 72, 78); GOLD = (255, 214, 70)
def hero(c, x, y, s, t, st, tilt, mode, blink):
    ca, sa = math.cos(tilt), math.sin(tilt)
    T = lambda px, py: (x + (px * ca - py * sa) * s, y + (px * sa + py * ca) * s)
    def E(cx, cy, rx, ry, fill, n=28):
        c.poly([T(cx + rx * math.cos(a * 6.2832 / n), cy + ry * math.sin(a * 6.2832 / n)) for a in range(n)], fill)
    sway = math.sin(t * 2.2)
    # cape
    pts = [T(-14, -22), T(10, -22)]
    L = lerp(70, 52, st)
    back = []
    for i in range(9):
        u = i / 8
        bx = lerp(-12, -12 - (1 - st) * 70 - st * 6, u) + sway * 6 * u * (1 - st) + math.sin(t * 2.6 + u * 3) * 5 * u
        by = -22 + u * (L * (0.55 + 0.45 * st)) * 1.0 + (1 - st) * math.sin(t * 2 + u * 4) * 8 * u
        back.append(T(bx - (st * math.sin(t * 1.5 + u * 3) * 8 * u), by))
    low = []
    for i in range(9):
        u = 1 - i / 8
        bx = lerp(10, -12 - (1 - st) * 70 - st * 6, u) + sway * 6 * u * (1 - st) + math.sin(t * 2.6 + u * 3 + 1) * 5 * u + (1 - u) * 8 * st
        by = -22 + (1 - 0) * (L * (0.55 + 0.45 * st)) * u * 1.0 + 10 + (1 - st) * math.sin(t * 2 + u * 4 + 1) * 8 * u
        low.append(T(bx, by))
    c.poly(pts[:1] + back + low[::-1][:0] + low + pts[1:], (214, 52, 70))
    c.poly(pts[:1] + back[:5] + [T(-12, 0)], (236, 80, 88))
    # legs
    for k, (lx, ph) in enumerate(((-7, 0), (7, 1.5))):
        fx = lerp(-34 - k * 8, lx, st); fy = lerp(26 + k * 4 + math.sin(t * 3 + ph) * 3, 46, st)
        c.line([T(lx, 12), T(fx, fy)], (50, 100, 200), 11 * s)
        E(fx, fy, 8.5, 6.5, RED)
    # body
    c.rect(*T(-17, -22), *T(17, 20), SUIT, 0) if False else E(0, -2, 19, 23, SUIT)
    E(0, 14, 17, 7, RED)
    c.star(*T(0, -4), 8 * s, GOLD)
    # arms
    if mode == 'carry': hands = [(36, -6), (30, 4)]
    elif mode == 'wave': hands = [(26, 28), (30, -38 + math.sin(t * 5) * 6)]
    else:
        hf = [(38, -34), (20, 4)]; hs = [(22, 30), (-22, 30)]
        hands = [(lerp(a[0], b[0], st), lerp(a[1], b[1], st)) for a, b in zip(hf, hs)]
    for (hx, hy), sh in zip(hands, ((10, -12), (-8, -12))):
        c.line([T(*sh), T(hx, hy)], SUIT, 10 * s)
        E(hx, hy, 6.5, 6.5, SKIN)
    # head
    E(0, -52, 33, 31, SKIN)
    E(-26, -57, 5, 7, SKIN); E(26, -57, 5, 7, SKIN)
    c.poly([T(-30, -66), T(-14, -86), T(4, -82), T(22, -88), T(32, -66), T(20, -76), T(0, -72), T(-18, -74)], (122, 78, 50))
    E(0, -50, 33, 14, RED)  # mask band
    for ex in (-13, 13):
        E(ex + 4, -50, 11.5, 12.5 * (0.1 if blink else 1), (255, 255, 255))
        if not blink:
            E(ex + 7, -49, 7, 8, (70, 44, 36)); E(ex + 9, -52, 2.6, 2.6, (255, 255, 255))
    E(-21, -35, 6, 3.4, (255, 150, 150)); E(25, -35, 6, 3.4, (255, 150, 150))
    pts = [T(-7 + 14 * i / 8 + 4, -33 + 6 * math.sin(i / 8 * 3.14)) for i in range(9)]
    c.line(pts, (180, 60, 70), 2.6 * s)

def kitten(c, x, y, s, t, tail=1.0):
    c.line([(x - 16 * s, y), (x - 28 * s, y - 6 * s - math.sin(t * 3) * 6 * s * tail), (x - 30 * s, y - 20 * s - math.sin(t * 3) * 8 * s * tail)], (240, 150, 70), 6 * s)
    c.ell(x, y + 2 * s, 18 * s, 14 * s, (248, 170, 90))
    c.ell(x, y - 18 * s, 15 * s, 13 * s, (248, 170, 90))
    c.poly([(x - 14 * s, y - 24 * s), (x - 12 * s, y - 40 * s), (x - 3 * s, y - 29 * s)], (248, 170, 90))
    c.poly([(x + 14 * s, y - 24 * s), (x + 12 * s, y - 40 * s), (x + 3 * s, y - 29 * s)], (248, 170, 90))
    for ex in (-6, 6):
        c.ell(x + ex * s, y - 19 * s, 3.8 * s, 4.8 * s, (40, 30, 30)); c.ell(x + ex * s + s, y - 21 * s, 1.3 * s, 1.3 * s, (255, 255, 255))
    c.ell(x, y - 13 * s, 2 * s, 1.5 * s, (240, 110, 130))

def child(c, x, base, t, happy, bounce):
    y = base - bounce
    c.rect(x - 11, y - 52, x + 11, y - 12, (255, 120, 160), 8)
    c.rect(x - 9, y - 14, x - 2, y, (80, 100, 190), 3); c.rect(x + 2, y - 14, x + 9, y, (80, 100, 190), 3)
    hx, hy = x + 16, y - 48
    if happy: c.line([(x + 8, y - 46), (x + 22, y - 72 - bounce * 0.2)], (255, 120, 160), 6)
    else: c.line([(x + 8, y - 46), (hx, hy)], (255, 120, 160), 6)
    c.ell(x, y - 66, 17, 17, SKIN)
    c.poly([(x - 18, y - 70), (x - 8, y - 86), (x + 10, y - 86), (x + 18, y - 70), (x + 8, y - 78), (x - 6, y - 78)], (90, 56, 40))
    c.ell(x - 6, y - 66, 2.8, 3.4, (50, 34, 30)); c.ell(x + 6, y - 66, 2.8, 3.4, (50, 34, 30))
    c.ell(x - 11, y - 58, 3.6, 2.2, (255, 150, 150)); c.ell(x + 11, y - 58, 3.6, 2.2, (255, 150, 150))
    if happy: c.arc(x, y - 60, 6, 5, 20, 160, (160, 60, 60), 2)
    else: c.ell(x, y - 56, 2.4, 3, (160, 60, 60))

def balloon(c, bx, by, col=(240, 70, 100)):
    c.ell(bx, by, 22, 27, col); c.poly([(bx - 4, by + 26), (bx + 4, by + 26), (bx, by + 33)], col)
    c.ell(bx - 8, by - 10, 5, 8, (255, 190, 200))

def duck(c, x, y, s, t, ph):
    bob = math.sin(t * 6 + ph) * 1.5 * s
    c.ell(x, y - 12 * s + bob, 16 * s, 11 * s, (255, 220, 70))
    c.ell(x + 11 * s, y - 24 * s + bob, 9 * s, 9 * s, (255, 220, 70))
    c.poly([(x + 18 * s, y - 24 * s + bob), (x + 27 * s, y - 22 * s + bob), (x + 18 * s, y - 19 * s + bob)], (255, 140, 50))
    c.ell(x + 13 * s, y - 27 * s + bob, 2 * s, 2.4 * s, (40, 30, 30))
    c.ell(x - 3 * s, y - 12 * s + bob, 9 * s, 5 * s, (255, 200, 50))
    for lx in (-4, 4):
        c.line([(x + lx * s, y - 3 * s), (x + lx * s + math.sin(t * 6 + ph + lx) * 2 * s, y)], (255, 140, 50), 2 * s)

def tree(c, x, cyv):
    c.rect(x - 14, 300 + cyv, x + 14, 585 + cyv, (150, 100, 70), 6)
    c.line([(x + 8, 420 + cyv), (x + 110, 400 + cyv)], (150, 100, 70), 12)
    for dx, dy, r in ((-60, 330, 70), (60, 320, 75), (0, 260, 85), (-20, 350, 60), (50, 350, 55), (-85, 290, 50)):
        c.ell(x + dx, dy + cyv, r, r, (118, 190, 100))
    for dx, dy, r in ((-30, 270, 55), (40, 300, 45), (0, 330, 40)):
        c.ell(x + dx, dy + cyv, r, r, (150, 212, 112))

def building(c, b, f, base, cx, cyv, t, dusk, tint, lit_glow=None):
    x = b['x'] - cx * f; y = base + cyv * f
    if x > W + 10 or x + b['w'] < -10: return
    col = mix(b['c'], tint[0], tint[1])
    dark = mix(col, (70, 50, 110), 0.28)
    top = y - b['h']
    c.rect(x, top, x + b['w'], y + 400, col)
    c.rect(x + b['w'] * 0.78, top, x + b['w'], y + 400, dark)
    c.rect(x - 3, top - 6, x + b['w'] + 3, top + 4, mix(col, (255, 240, 200), 0.3))
    if b['roof'] == 1: c.poly([(x + 8, top - 6), (x + b['w'] / 2, top - 40), (x + b['w'] - 8, top - 6)], mix(col, (200, 90, 90), 0.4))
    if b['roof'] == 2: c.rect(x + b['w'] * 0.2, top - 24, x + b['w'] * 0.45, top - 6, dark, 3)
    cw = b['w'] / b['cols']; rh = (b['h'] - 20) / b['rows']
    ramp = 0.05 + 0.85 * dusk
    for r in range(b['rows']):
        for k in range(b['cols']):
            wx = x + k * cw + cw * 0.25; wy = top + 14 + r * rh + rh * 0.2
            ww, wh = cw * 0.5, rh * 0.6
            if b['win'][r][k] < ramp:
                c.rect(wx, wy, wx + ww, wy + wh, (255, 224, 140), 2)
                if lit_glow is not None: glow(lit_glow, wx + ww / 2, wy + wh / 2, 26, (16, 11, 4))
            else:
                c.rect(wx, wy, wx + ww, wy + wh, mix(col, (255, 255, 255), 0.35), 2)

def sparkles(c, g, pts, t):
    for (x, y, ph, r) in pts:
        a = 0.5 + 0.5 * math.sin(t * 5 + ph)
        if a > 0.15:
            c.star(x, y, r * (0.4 + a), (255, 250, 215)); glow(g, x * 1, y * 1, 22 * a + 6, (90, 80, 40))

def frame(i):
    t = i / FPS
    dusk = t / 30
    cx = cam(t); cyv = camy(t)
    img = Image.new('RGB', (W * K, H * K))
    # sky
    col = Image.new('RGB', (1, 1440))
    col.putdata([mix(sky_col(SKY_A, y / 1440), sky_col(SKY_B, y / 1440), dusk * 0.9) for y in range(1440)])
    # shift sky slightly with camy
    img.paste(col.resize((W * K, H * K)))
    c = Cv(img)
    g = Image.new('RGB', (W // 4, H // 4), (0, 0, 0))
    # sun
    sx, sy = 880 - cx * 0.03, 360 + cyv * 0.15 + dusk * 40
    glow(g, sx, sy, 220, (40, 24, 10)); glow(g, sx, sy, 130, (50, 34, 14))
    c.ell(sx, sy, 82, 82, mix((255, 238, 170), (255, 170, 110), dusk))
    # clouds
    for (wx, wy, sc) in CLOUDS:
        px = (wx - cx * 0.08 + t * 6) % 3200 - 400
        cc = mix((255, 205, 200), (230, 140, 180), dusk)
        for dx, dy, r in ((0, 0, 34), (36, 6, 28), (-36, 8, 26), (14, -14, 26)):
            c.ell(px + dx * sc, wy * 0.6 + dy * sc + cyv * 0.1, r * sc, r * sc * 0.8, cc)
    tint_far = ((200, 140, 175), 0.0)
    far_c = mix((222, 150, 170), (120, 85, 160), dusk); mid_tint = ((170, 110, 160), 0.15 + 0.35 * dusk); near_tint = ((120, 80, 130), 0.08 + 0.22 * dusk)
    for b in FAR:
        bb = dict(b); bb['c'] = far_c
        x = b['x'] - cx * 0.2; y = 470 + cyv * 0.3
        if -300 < x < W: c.rect(x, y - b['h'], x + b['w'], y + 300, far_c)
    for b in MID: building(c, b, 0.5, 520, cx, cyv, t, dusk, mid_tint)
    for b in NEAR: building(c, b, 0.8, 570, cx, cyv, t, dusk, near_tint, g)
    # ground
    gy = GROUND + cyv
    c.rect(0, gy, W, gy + 600, mix((255, 205, 160), (200, 130, 140), dusk))
    c.rect(0, gy + 40, W, gy + 600, mix((150, 120, 135), (90, 70, 110), dusk))
    c.rect(0, gy + 38, W, gy + 46, mix((255, 230, 190), (220, 170, 170), dusk))
    for k in range(-1, 14):
        x = k * 160 - (cx % 160); c.rect(x, gy + 120, x + 80, gy + 128, (255, 232, 170))
    # crosswalk
    cwx = DUCK0 + 120 - cx
    for k in range(7): c.rect(cwx + k * 38, gy + 52, cwx + k * 38 + 22, gy + 150, (250, 240, 225))
    # lamp posts
    for lx in LAMPS:
        x = lx - cx
        if -40 < x < W + 40:
            c.rect(x - 3, gy - 130, x + 3, gy + 28, (90, 70, 90), 2); c.ell(x, gy - 136, 11, 11, (255, 232, 160))
            glow(g, x, gy - 136, 80, (30, 22, 8))
    # tree & kitten
    tx = TX - cx
    kp = (BR[0] - cx, BR[1] + cyv)
    if -250 < tx < W + 250:
        tree(c, tx, cyv)
        if t < 12.3: kp = (BR[0] - cx, BR[1] + cyv)
        else: kp = None
    # child
    chx = CX - cx
    happy = t >= 18.3
    bounce = (abs(math.sin((t - 18.3) * 4)) * 14 * clamp(1 - (t - 18.3) / 6)) if happy else 0
    if -50 < chx < W + 50:
        child(c, chx, 590 + cyv, t, happy, bounce)
    # ducks
    for j, (off, sc) in enumerate(((0, 1.9), (-70, 1.2), (-118, 1.1), (-162, 1.0))):
        mt = mom(t) + off
        duck(c, mt - cx, 650 + cyv + (j % 2) * 8, sc, t, j)
    # roof building (front layer)
    rx0 = RX - 170 - cx
    if rx0 < W + 20:
        rc = mix((246, 178, 150), (170, 100, 140), dusk * 0.6); rd = mix(rc, (80, 50, 110), .28)
        top = 300 + cyv
        c.rect(rx0, top, rx0 + 340, top + 700, rc); c.rect(rx0 + 260, top, rx0 + 340, top + 700, rd)
        c.rect(rx0 - 8, top - 2, rx0 + 348, top + 14, mix(rc, (255, 240, 200), .4), 4)
        c.rect(rx0 + 20, top - 30, rx0 + 60, top, (200, 130, 110), 4)
        for r in range(6):
            for k in range(4):
                wx = rx0 + 26 + k * 78; wy = top + 44 + r * 64
                c.rect(wx, wy, wx + 42, wy + 38, (255, 224, 140) if (r * 3 + k * 5) % 7 < 4 + dusk * 3 else mix(rc, (255, 255, 255), .35), 3)
        for k in range(9):   # string lights
            bx = rx0 + 8 + k * 40; byy = top - 4 + 14 * math.sin(k / 8 * 3.14)
            c.ell(bx, byy + 4, 4, 4, (255, 235, 150)); glow(g, bx, byy + 4, 40, (30, 24, 8))
        # glow edge
    # kitten
    if t < 12.3 and kp: kitten(c, kp[0], kp[1], 1.3, t)
    else:
        hx, hy = catmull(HERO_KF, t); hy += cyv
        carry = (hx + 36 * HS - cx, hy - 6 * HS)
        ground = (KG[0] - cx, KG[1] + cyv)
        u = sstep(14.0, 14.6, t)
        pos = (lerp(carry[0], ground[0], u), lerp(carry[1] + 8, ground[1], u)) if t < 14.6 else ground
        if -60 < pos[0] < W + 60: kitten(c, pos[0], pos[1], 1.3, t, 1.4 if t > 14.6 else 0.3)
    # balloon
    if t < 14.6: bpos = (chx + 22, 455 + cyv)
    elif t < 16.5: b0 = bp(t); bpos = (b0[0] - cx, b0[1] + cyv)
    else:
        hx, hy = catmull(HERO_KF, t); hy += cyv
        hand = (hx + 36 * HS - cx, hy - 6 * HS)
        if t < 18.3: bpos = (hand[0], hand[1] - 90)
        else:
            u = sstep(18.3, 18.9, t)
            ch = (chx + 22, 455 + cyv - bounce)
            bpos = (lerp(hand[0], ch[0], u), lerp(hand[1] - 90, ch[1], u)) if t < 18.9 else ch
    if t < 14.6 or 16.5 <= t < 18.9 or t >= 18.9:
        anchor = (chx + 22, 590 + cyv - 72 - 1.2 * bounce) if happy else (chx + 16, 590 + cyv - 48)
        if t >= 18.3 or t < 14.6:
            c.line([(bpos[0], bpos[1] + 30), (anchor[0], anchor[1])], (255, 255, 255), 1.5)
        else:
            c.line([(bpos[0], bpos[1] + 30), (bpos[0], bpos[1] + 90)], (255, 255, 255), 1.5)
    else:
        c.line([(bpos[0], bpos[1] + 30), (bpos[0] - 8, bpos[1] + 60)], (255, 255, 255), 1.5)
    balloon(c, bpos[0], bpos[1])
    # hero
    hx, hy = catmull(HERO_KF, t)
    st = sstep(23.6, 24.8, t)
    hy += cyv + (1 - st) * math.sin(t * 1.6) * 7 + st * math.sin(t * 1.0) * 0
    if t < 10: mode = 'fly'
    elif 12.3 <= t < 14.3 or 16.4 <= t < 18.3: mode = 'carry'
    elif 18.3 <= t < 22: mode = 'wave'
    else: mode = 'fly'
    lean = 0.28 * (1 - st) * (0.6 + 0.4 * math.sin(t * 1.3)) if mode == 'fly' else 0.05 * (1 - st)
    blink = (t % 3.7) < 0.13
    hsx = hx - cx
    # soft shadow when low
    hero(c, hsx, hy, HS, t, st, lean, mode, blink)
    # sparkle trail / bursts
    pts = []
    rs = random.Random(int(t * 12))
    if t < 23.8:
        for n in range(4):
            pts.append((hsx - 30 - n * 26 + rs.uniform(-12, 12), hy + 10 + rs.uniform(-30, 30), n + i * 0.1, 5 + rs.random() * 4))
    for (t0, bx, by) in ((14.3, KG[0] - cx, KG[1] + cyv - 50), (18.5, chx, 470 + cyv), (21.0, mom(21) - cx, 590 + cyv)):
        if 0 < t - t0 < 2.2:
            for n in range(7):
                a = n * 0.9 + t0; r = 20 + (t - t0) * 30 + n * 3
                pts.append((bx + math.cos(a) * r, by + math.sin(a) * r * .7 - (t - t0) * 20, n * 1.7, 6))
    # fireflies
    ffa = sstep(17, 23, t)
    for (fx, fy, ph, sp, amp) in FIREFLIES:
        if rs.random() < 0 : pass
        x = (fx + math.sin(t * sp + ph) * amp - t * 4) % W; y = fy + math.cos(t * sp * 0.8 + ph) * amp * 0.8
        a = ffa * (0.5 + 0.5 * math.sin(t * 2 + ph))
        if a > 0.1:
            r = 2.2 + a * 1.5; c.ell(x, y, r, r, (255, 244, 170)); glow(g, x, y, 22 * a + 6, (int(110 * a), int(100 * a), int(30 * a)))
    sparkles(c, g, pts, t)
    # compose
    out = img.resize((W, H), Image.LANCZOS)
    gg = g.filter(ImageFilter.GaussianBlur(2.5)).resize((W, H), Image.BICUBIC)
    out = ImageChops.add(out, gg)
    # warm vignette
    return np.asarray(out).tobytes()

if __name__ == '__main__':
    import imageio
    n = FPS * DUR
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        for tt in (2, 9, 12.5, 14.5, 17, 19, 22, 27, 29.5):
            Image.frombytes('RGB', (W, H), frame(int(tt * FPS))).save(f'/tmp/f_{tt}.png')
        sys.exit()
    w = imageio.get_writer('/tmp/out.mp4', fps=FPS, codec='libx264', quality=8, macro_block_size=1, pixelformat='yuv420p')
    with Pool(2) as p:
        for k, b in enumerate(p.imap(frame, range(n), chunksize=4)):
            w.append_data(np.frombuffer(b, np.uint8).reshape(H, W, 3))
            if k % 60 == 0: print(k, flush=True)
    w.close()
