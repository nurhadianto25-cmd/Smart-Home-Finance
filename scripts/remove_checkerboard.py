import glob, os
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = "/app/frontend/assets/images/savings"

def process(path):
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im).astype(np.int16)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    bright = (r + g + b) / 3.0
    grayish = (mx - mn) <= 20
    # any light grayish pixel = checkerboard background / mist
    bg_like = grayish & (bright >= 166)

    labels, n = ndimage.label(bg_like)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    bg_mask = np.isin(labels, list(border))
    # grow background by 1px to eat anti-aliased fringe
    bg_mask = ndimage.binary_dilation(bg_mask, iterations=1)

    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.asarray(im), alpha]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")

    bbox = img.getbbox()
    if bbox:
        pad = 16
        x0, y0, x1, y1 = bbox
        x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
        x1 = min(img.width, x1 + pad); y1 = min(img.height, y1 + pad)
        img = img.crop((x0, y0, x1, y1))
    img.save(path)
    print("done", os.path.basename(path), img.size)

for p in sorted(glob.glob(f"{OUT}/*.png")):
    process(p)
