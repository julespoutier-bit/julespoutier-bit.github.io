"""
Small GUI for compressing a raw clip for the site, using the same ffmpeg
settings used throughout the project (H.264, yuv420p, faststart, no audio).

Double-click this file to open it — no console window, no typing.
"""

import shutil
import subprocess
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk

PRESETS = {
    "Hero video (project or homepage)": {"max_dim": 1600, "crf": 22},
    "Grid / breakdown clip": {"max_dim": 1080, "crf": 24},
}


def compress_file(src, max_dim, crf):
    """Run ffmpeg on src, return (output_path, before_mb, after_mb). Raises on failure."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg not found on PATH.")

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
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip()[-500:] or "ffmpeg failed with no output.")

    before = src.stat().st_size / (1024 * 1024)
    after = out.stat().st_size / (1024 * 1024)
    return out, before, after


class App:
    def __init__(self, root):
        self.root = root
        self.src_path = None

        root.title("Video Compressor")
        root.resizable(False, False)
        try:
            root.call("tk", "scaling", 1.3)
        except tk.TclError:
            pass

        self.preset_var = tk.StringVar(value=next(iter(PRESETS)))
        self.status_var = tk.StringVar(value="Choose a video to get started.")

        frame = ttk.Frame(root, padding=24)
        frame.grid()

        ttk.Label(frame, text="Video Compressor", font=("Segoe UI", 15, "bold")).grid(
            row=0, column=0, sticky="w", pady=(0, 14)
        )

        self.file_label = ttk.Label(frame, text="No file selected", foreground="#777")
        self.file_label.grid(row=1, column=0, sticky="w", pady=(0, 8))

        ttk.Button(frame, text="Choose video…", command=self.choose_file).grid(
            row=2, column=0, sticky="we", pady=(0, 18)
        )

        ttk.Label(frame, text="For:").grid(row=3, column=0, sticky="w", pady=(0, 4))
        for i, (name, preset) in enumerate(PRESETS.items()):
            ttk.Radiobutton(
                frame,
                text=f"{name}   ·   {preset['max_dim']}px, crf {preset['crf']}",
                value=name,
                variable=self.preset_var,
            ).grid(row=4 + i, column=0, sticky="w", pady=2)

        self.compress_btn = ttk.Button(
            frame, text="Compress", command=self.start_compress, state="disabled"
        )
        self.compress_btn.grid(row=6, column=0, sticky="we", pady=(18, 10))

        self.status_label = ttk.Label(
            frame, textvariable=self.status_var, wraplength=340, foreground="#333", justify="left"
        )
        self.status_label.grid(row=7, column=0, sticky="w")

    def choose_file(self):
        path = filedialog.askopenfilename(
            title="Choose a video file",
            filetypes=[("Video files", "*.mov *.mp4 *.mkv *.avi *.m4v"), ("All files", "*.*")],
        )
        if not path:
            return
        self.src_path = Path(path)
        self.file_label.config(text=self.src_path.name, foreground="#000")
        self.compress_btn.config(state="normal")
        self.status_var.set("Ready.")

    def start_compress(self):
        if not self.src_path:
            return
        self.compress_btn.config(state="disabled")
        self.status_var.set("Compressing…")
        threading.Thread(target=self._run_compress, daemon=True).start()

    def _run_compress(self):
        preset = PRESETS[self.preset_var.get()]
        try:
            out, before, after = compress_file(self.src_path, preset["max_dim"], preset["crf"])
            message = f"Done: {out.name}\n{before:.1f} MB → {after:.1f} MB"
        except Exception as e:
            message = f"Error: {e}"
        self.root.after(0, self._finish, message)

    def _finish(self, message):
        self.status_var.set(message)
        self.compress_btn.config(state="normal")


if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()
