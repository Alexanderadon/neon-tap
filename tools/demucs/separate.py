"""Separate one or more tracks into lead (vocals) + backing with Demucs, CPU, everything on D:.
Usage: python separate.py <mp3...>   → D:\neon-tap-tools\stems\<id>\{lead,backing}.wav
"""
import os, sys, subprocess, pathlib
ROOT = pathlib.Path(r"D:\neon-tap-tools")
FFMPEG = ROOT / "ffmpeg.exe"
os.environ["PATH"] = str(ROOT) + os.pathsep + os.environ.get("PATH", "")
os.environ["TORCH_HOME"] = str(ROOT / "torch-home")
os.environ["TMP"] = os.environ["TEMP"] = str(ROOT / "tmp")
(ROOT / "tmp").mkdir(exist_ok=True)
import torch  # noqa: E402
from demucs.pretrained import get_model  # noqa: E402
from demucs.apply import apply_model  # noqa: E402
import numpy as np  # noqa: E402

def decode(path: str, sr: int) -> torch.Tensor:
    raw = subprocess.run([str(FFMPEG), "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(sr), "-"], capture_output=True, check=True).stdout
    arr = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy()
    return torch.from_numpy(arr)

def encode(path: pathlib.Path, wav: torch.Tensor, sr: int) -> None:
    data = wav.clamp(-1, 1).T.contiguous().numpy().astype(np.float32).tobytes()
    subprocess.run([str(FFMPEG), "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(sr), "-i", "-", "-codec:a", "libmp3lame", "-b:a", "128k", str(path)], input=data, check=True)

model = get_model("htdemucs")
model.eval()
sr = model.samplerate
for mp3 in sys.argv[1:]:
    track_id = pathlib.Path(mp3).stem
    out = ROOT / "stems" / track_id
    out.mkdir(parents=True, exist_ok=True)
    wav = decode(mp3, sr)
    ref = wav.mean(0)
    mix = (wav - ref.mean()) / (ref.std() + 1e-8)
    with torch.no_grad():
        sources = apply_model(model, mix[None], device="cpu", shifts=1, split=True, overlap=0.25, progress=False)[0]
    sources = sources * (ref.std() + 1e-8) + ref.mean()
    names = model.sources  # ['drums', 'bass', 'other', 'vocals']
    rms = {n: float(sources[i].pow(2).mean().sqrt()) for i, n in enumerate(names)}
    mix_rms = float(wav.pow(2).mean().sqrt()) + 1e-8
    # The lead is what the player "plays": the vocal when the song has one, otherwise the melodic
    # layer (synths, guitars, keys = Demucs' "other"). Drums and bass always keep going underneath.
    vocal_song = rms["vocals"] / mix_rms >= 0.12
    lead_names = ["vocals"] if vocal_song else ["other", "vocals"]
    lead = sum(sources[names.index(n)] for n in lead_names)
    backing = sum(sources[i] for i, n in enumerate(names) if n not in lead_names)
    encode(out / "lead.mp3", lead, sr)
    encode(out / "backing.mp3", backing, sr)
    # The four raw stems (analysis only, never shipped): the chart generator reads onsets per instrument.
    for i, n in enumerate(names):
        encode(out / f"stem-{n}.mp3", sources[i], sr)
    (out / "lead.txt").write_text("+".join(lead_names))
    print(f"{track_id}: lead={'+'.join(lead_names)} " + " ".join(f"{n}={rms[n] / mix_rms:.2f}" for n in names), flush=True)
