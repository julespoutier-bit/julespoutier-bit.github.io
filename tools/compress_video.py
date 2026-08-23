"""
Compress a raw video clip for the site, using the same ffmpeg settings
used throughout the project (H.264, yuv420p, faststart, no audio).

Usage: drag a video file onto compress-video.bat, or run:
  python compress_video.py "path\\to\\clip.mov"

Output is written next to the source file as <name>.mp4, ready to pick
up from admin.html's file picker.
"""

import shutil
import subprocess
import sys
from pathlib import Path

PRESETS = {
    "1": {"label": "Hero video (project or homepage)", "max_dim": 1600, "crf": 22},
    "2": {"label": "Grid / breakdown clip", "max_dim": 1080, "crf": 24},
}


def pause():
    try:
        input("Press Enter to close...")
    except EOFError:
        pass


def main():
    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found on PATH. Install it first (winget install Gyan.FFmpeg).")
        pause()
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Drag a video file onto compress-video.bat, or pass a file path as an argument.")
        pause()
        sys.exit(1)

    src = Path(sys.argv[1])
    if not src.is_file():
        print(f"File not found: {src}")
        pause()
        sys.exit(1)

    print(f"Compressing: {src.name}\n")
    print("What is this clip for?")
    for key, preset in PRESETS.items():
        print(f"  {key}) {preset['label']} — max {preset['max_dim']}px, crf {preset['crf']}")
    print("  3) Custom")

    choice = input("Choice [1/2/3]: ").strip()

    if choice in PRESETS:
        max_dim = PRESETS[choice]["max_dim"]
        crf = PRESETS[choice]["crf"]
    else:
        max_dim = int(input("Max width/height in px (e.g. 1280): ").strip())
        crf = int(input("Quality crf, lower = better (18-28 typical, e.g. 23): ").strip())

    out = src.with_suffix(".mp4")
    if out.resolve() == src.resolve():
        out = src.with_name(src.stem + "-compressed.mp4")

    scale_filter = f"scale='min({max_dim},iw)':'min({max_dim},ih)':force_original_aspect_ratio=decrease"

    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-vf", scale_filter,
        "-c:v", "libx264", "-crf", str(crf), "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(out),
    ]

    print("\nRunning ffmpeg...\n")
    result = subprocess.run(cmd)

    if result.returncode != 0:
        print("\nffmpeg failed — see the error above.")
        pause()
        sys.exit(1)

    before = src.stat().st_size / (1024 * 1024)
    after = out.stat().st_size / (1024 * 1024)
    print(f"\nDone: {out}")
    print(f"{before:.1f} MB -> {after:.1f} MB")
    pause()


if __name__ == "__main__":
    main()
