"""
Generate Old Z app icons for Android mipmap directories.
Design: Dark background with a stylized golden "Z" mark + subtle green accent.
"""
import os
from PIL import Image, ImageDraw

# === Colors ===
BG = (10, 11, 13)               # #0A0B0D
BG_LIGHTER = (18, 20, 24)       # slightly lighter for depth
GOLD = (212, 168, 83)           # #D4A853
GOLD_LIGHT = (232, 196, 106)    # #E8C46A
GREEN = (80, 200, 120)          # #50C878
BORDER = (40, 42, 48)           # subtle border

BASE_DIR = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')

SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}


def create_icon(size):
    """Create the main app icon at given size."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background
    radius = int(size * 0.22)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BG + (255,))

    # Subtle inner glow ring
    inset = max(1, size // 40)
    inner_radius = max(1, radius - inset)
    draw.rounded_rectangle(
        (inset, inset, size - 1 - inset, size - 1 - inset),
        radius=inner_radius,
        outline=BORDER + (120,),
        width=max(1, size // 120)
    )

    # === Draw stylized Z ===
    cx, cy = size / 2, size / 2
    z_half = size * 0.30  # half-size of the Z
    stroke = max(int(size * 0.12), 2)
    cap = max(int(size * 0.06), 1)  # serif cap size

    # Z path points
    tl = (cx - z_half, cy - z_half)  # top-left
    tr = (cx + z_half, cy - z_half)  # top-right
    bl = (cx - z_half, cy + z_half)  # bottom-left
    br = (cx + z_half, cy + z_half)  # bottom-right

    # Draw the Z with gold color
    # Top bar
    draw.line([tl, tr], fill=GOLD, width=stroke)
    # Diagonal
    draw.line([tr, bl], fill=GOLD, width=stroke)
    # Bottom bar
    draw.line([bl, br], fill=GOLD, width=stroke)

    # Serif caps (small vertical lines at corners)
    draw.line([(tl[0], tl[1] - cap), (tl[0], tl[1] + cap)], fill=GOLD_LIGHT, width=max(1, stroke // 2))
    draw.line([(tr[0], tr[1] - cap), (tr[0], tr[1] + cap)], fill=GOLD_LIGHT, width=max(1, stroke // 2))
    draw.line([(bl[0], bl[1] - cap), (bl[0], bl[1] + cap)], fill=GOLD_LIGHT, width=max(1, stroke // 2))
    draw.line([(br[0], br[1] - cap), (br[0], br[1] + cap)], fill=GOLD_LIGHT, width=max(1, stroke // 2))

    # Green accent dot at center of diagonal
    dot_r = max(int(size * 0.04), 1)
    draw.ellipse(
        [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
        fill=GREEN + (255,)
    )

    return img


def create_foreground(size=512):
    """Create adaptive icon foreground (transparent bg, icon centered with safe zone padding)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2
    z_half = size * 0.28
    stroke = max(int(size * 0.08), 3)
    cap = max(int(size * 0.04), 1)

    tl = (cx - z_half, cy - z_half)
    tr = (cx + z_half, cy - z_half)
    bl = (cx - z_half, cy + z_half)
    br = (cx + z_half, cy + z_half)

    draw.line([tl, tr], fill=GOLD, width=stroke)
    draw.line([tr, bl], fill=GOLD, width=stroke)
    draw.line([bl, br], fill=GOLD, width=stroke)

    draw.line([(tl[0], tl[1] - cap), (tl[0], tl[1] + cap)], fill=GOLD_LIGHT, width=max(1, stroke // 2))
    draw.line([(tr[0], tr[1] - cap), (tr[0], tr[1] + cap)], fill=GOLD_LIGHT, width=max(1, stroke // 2))
    draw.line([(bl[0], bl[1] - cap), (bl[0], bl[1] + cap)], fill=GOLD_LIGHT, width=max(1, stroke // 2))
    draw.line([(br[0], br[1] - cap), (br[0], br[1] + cap)], fill=GOLD_LIGHT, width=max(1, stroke // 2))

    dot_r = max(int(size * 0.03), 1)
    draw.ellipse(
        [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
        fill=GREEN + (255,)
    )

    return img


def create_round_icon(size):
    """Create a round icon by masking to a circle."""
    icon = create_icon(size)

    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((0, 0, size - 1, size - 1), fill=255)

    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(icon, mask=mask)
    return result


def main():
    print("Generating Old Z app icons...")

    for dir_name, size in SIZES.items():
        dir_path = os.path.join(BASE_DIR, dir_name)
        os.makedirs(dir_path, exist_ok=True)

        # Standard icon
        icon = create_icon(size)
        icon_path = os.path.join(dir_path, 'ic_launcher.png')
        icon.save(icon_path, 'PNG')
        print(f"  {dir_name}/ic_launcher.png ({size}x{size})")

        # Round icon
        round_icon = create_round_icon(size)
        round_path = os.path.join(dir_path, 'ic_launcher_round.png')
        round_icon.save(round_path, 'PNG')
        print(f"  {dir_name}/ic_launcher_round.png ({size}x{size})")

        # Foreground for adaptive icon
        fg_size = max(size * 2, 108)
        fg = create_foreground(fg_size)
        fg_path = os.path.join(dir_path, 'ic_launcher_foreground.png')
        fg.save(fg_path, 'PNG')
        print(f"  {dir_name}/ic_launcher_foreground.png ({fg_size}x{fg_size})")

    # Large foreground for xxxhdpi (512x512)
    fg512 = create_foreground(512)
    fg512_path = os.path.join(BASE_DIR, 'mipmap-xxxhdpi', 'ic_launcher_foreground.png')
    fg512.save(fg512_path, 'PNG')
    print(f"  mipmap-xxxhdpi/ic_launcher_foreground.png (512x512)")

    print("\nDone!")


if __name__ == '__main__':
    main()
