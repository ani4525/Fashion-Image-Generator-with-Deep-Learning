# AI Fashion Generator — Setup Guide

## Project Structure

```
project/
├── app.py                          ← Fixed Flask backend (this file)
├── requirements.txt                ← Pinned compatible dependencies
├── setup_env.bat                   ← Windows one-click setup
├── setup_env.sh                    ← Linux/macOS one-click setup
│
├── fashion_lora_model/
│   └── content/
│       └── fashion_lora_output/
│           └── pytorch_lora_weights.safetensors   ← Your LoRA model
│
├── templates/
│   └── index.html                  ← Frontend (unchanged)
├── static/
│   ├── css/style.css
│   ├── js/main.js
│   └── generated/                  ← Generated images saved here
```

---

## What Was Fixed

### 1. Python Version
**Problem:** Python 3.13 causes `cannot import name 'GroupName' from torch.distributed`.
**Fix:** Use **Python 3.10.x** exclusively. This error is a known PyTorch incompatibility
with Python 3.13's changed enum internals. Python 3.10 is the most stable version
for the entire PyTorch + Diffusers + Accelerate ecosystem.

### 2. PyTorch / CUDA Stack
**Problem:** Mismatched or too-new PyTorch versions fail with your GTX 1650.
**Fix:** Pinned to `torch==2.3.1+cu121`. Your GTX 1650 (Turing / sm_75) is fully
supported by CUDA 12.1 with driver 595+.

### 3. LoRA Loading Order Bug
**Problem:** The original code enabled `sequential_cpu_offload()` and *then* tried
to load/fuse LoRA, which causes internal hook conflicts in diffusers.
**Fix:** The correct order is:
```
Load base model → Load LoRA → Fuse LoRA → Unload raw adapter → Enable CPU offload
```

### 4. LoRA Fuse API
**Problem:** `pipe.fuse_lora(lora_scale=0.7)` silently fails in diffusers 0.29 unless
you also specify `adapter_names`.
**Fix:**
```python
pipe.load_lora_weights(LORA_DIR, adapter_name="fashion_lora")
pipe.set_adapters(["fashion_lora"], adapter_weights=[LORA_ADAPTER_WEIGHT])
pipe.fuse_lora(adapter_names=["fashion_lora"], lora_scale=1.0)
pipe.unload_lora_weights()   # Free adapter memory after fusing
```

### 5. Missing Trigger Word
**Problem:** Your LoRA was trained with the trigger word `"sks fashion"`. Without it
in the prompt, the LoRA has no effect and you get plain SDXL output.
**Fix:** `app.py` now automatically prepends `"sks fashion,"` if it's not in the prompt.

---

## Setup Instructions

### Step 1 — Install Python 3.10

Download from: https://www.python.org/downloads/release/python-31011/

> **Important:** Do NOT use Python 3.11, 3.12, or 3.13.
> During installation, tick **"Add Python to PATH"**.

Verify:
```
python --version   # Must show Python 3.10.x
```

### Step 2 — Run the Setup Script

**Windows:**
```
Double-click setup_env.bat
```
or from terminal:
```
setup_env.bat
```

**Linux/macOS:**
```bash
bash setup_env.sh
```

This creates a virtual environment called `venv_fashion` and installs all
pinned dependencies (~2 GB download).

### Step 3 — Start the Server

**Windows:**
```
venv_fashion\Scripts\activate
python app.py
```

**Linux/macOS:**
```bash
source venv_fashion/bin/activate
python app.py
```

### Step 4 — Open the App

Open your browser and go to: **http://localhost:5000**

---

## First Run Notes

On the **very first request**, the app downloads the SDXL base model from
Hugging Face (~6.5 GB). This is a one-time download; it is cached at:
- Windows: `C:\Users\<you>\.cache\huggingface\hub\`
- Linux: `~/.cache/huggingface/hub/`

Subsequent runs load from cache and start in ~60–90 seconds.

---

## Writing Good Prompts

Your LoRA was trained on the trigger phrase **"sks fashion"**. Include it in
every prompt for best results:

✅ Good prompts:
```
sks fashion, elegant evening gown, deep red silk, flowing skirt, haute couture
sks fashion, streetwear outfit, oversized hoodie, cargo pants, urban style
sks fashion, bridal dress, lace details, white, long train
```

❌ Prompts without the trigger word will use base SDXL only (still works but
no fashion fine-tuning effect).

---

## VRAM Optimisations Active

| Feature | Purpose |
|---|---|
| `variant="fp16"` | Halves model memory usage |
| `enable_sequential_cpu_offload()` | Only active UNet layer stays in VRAM |
| `enable_vae_slicing()` | Encodes image in strips instead of all at once |
| `enable_vae_tiling()` | Tiles large VAE decode operations |

With these settings, generation at 768×768 uses ~2–3.5 GB VRAM peak.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `cannot import name 'GroupName'` | Python 3.11/3.12/3.13 | Use Python 3.10 |
| `CUDA not available` | Wrong PyTorch build | Reinstall with `--index-url https://download.pytorch.org/whl/cu121` |
| `CUDA out of memory` | VRAM exhausted | Close other GPU apps; restart server |
| `LoRA weights not found` | Wrong path | Ensure `fashion_lora_model/content/fashion_lora_output/pytorch_lora_weights.safetensors` exists |
| First request takes forever | Downloading SDXL (~6.5 GB) | Wait; check internet connection |
| Images look generic | Trigger word missing | Include `sks fashion` in prompt |
| Port 5000 already in use | Another Flask app running | `python app.py` uses port 5000; kill other processes or change port |

---

## Expected Generation Time on GTX 1650

| Steps | Resolution | Approx. Time |
|---|---|---|
| 20 | 512×512 | ~3–5 min |
| 20 | 768×768 | ~8–14 min |
| 30 | 768×768 | ~12–20 min |

Sequential CPU offload is slower than full GPU mode, but it's the only way to
fit SDXL on a 4 GB card.
