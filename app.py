"""
AI Fashion Generator — Flask Backend (SDXL + LoRA)
===================================================
Stable Diffusion XL Base 1.0 with LoRA fine-tuning.
Optimised for NVIDIA GTX 1650 (4 GB VRAM) via sequential CPU offloading.

POST /generate
  Request  JSON : { "prompt": "sks fashion ..." }
  Response JSON : { "image": "/static/generated/generated_001.png" }

NOTE: Always include "sks fashion" in your prompts — this is the trigger
      word the LoRA model was trained on.
"""

import os
import gc
import time
import glob
import logging
import torch
from flask import Flask, request, jsonify, render_template

# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
# LoRA weights live at: fashion_lora_model/content/fashion_lora_output/
LORA_DIR      = os.path.join(BASE_DIR, "fashion_lora_model", "content", "fashion_lora_output")
GENERATED_DIR = os.path.join(BASE_DIR, "static", "generated")
BASE_MODEL_ID = "stabilityai/stable-diffusion-xl-base-1.0"

# Generation defaults  (safe for 4 GB VRAM)
DEFAULT_STEPS      = 20
DEFAULT_GUIDANCE   = 7.5
DEFAULT_WIDTH      = 768
DEFAULT_HEIGHT     = 768
LORA_ADAPTER_WEIGHT = 0.7   # prevents "burnt" colour effect

# Trigger word the LoRA was trained on — must appear in every prompt
LORA_TRIGGER_WORD = "sks fashion"

os.makedirs(GENERATED_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Flask app
# ─────────────────────────────────────────────────────────────
app = Flask(__name__)

# ─────────────────────────────────────────────────────────────
# Pipeline — lazy-loaded singleton (heavy model, load once)
# ─────────────────────────────────────────────────────────────
_pipeline = None


def get_pipeline():
    """
    Lazily loads the SDXL pipeline with LoRA weights.

    Loading order is critical for 4 GB VRAM:
      1. Load base model (fp16)
      2. Load & fuse LoRA weights into the model weights
      3. Unload raw LoRA adapter (frees the extra adapter tensors)
      4. Enable sequential CPU offloading  ← must come AFTER LoRA fuse
      5. Enable VAE slicing + tiling
    """
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    from diffusers import StableDiffusionXLPipeline

    # ── 1. CUDA check ────────────────────────────────────────
    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA is not available. Please install PyTorch with CUDA support:\n"
            "  pip install torch==2.3.1+cu121 torchvision==0.18.1+cu121 "
            "--index-url https://download.pytorch.org/whl/cu121"
        )

    gpu_name = torch.cuda.get_device_name(0)
    vram_gb  = round(torch.cuda.get_device_properties(0).total_memory / 1024 ** 3, 1)
    logger.info("GPU detected : %s  (%.1f GB VRAM)", gpu_name, vram_gb)

    # ── 2. Load SDXL base model (fp16) ───────────────────────
    logger.info("Loading SDXL base model : %s  (variant=fp16)", BASE_MODEL_ID)
    pipe = StableDiffusionXLPipeline.from_pretrained(
        BASE_MODEL_ID,
        variant="fp16",
        torch_dtype=torch.float16,
        use_safetensors=True,
    )
    logger.info("Base model loaded")

    # ── 3. Load & fuse LoRA weights ──────────────────────────
    #    IMPORTANT: fuse BEFORE enabling CPU offload.
    #    After fusing, unload the raw adapter tensors to free RAM/VRAM.
    lora_weights_path = os.path.join(LORA_DIR, "pytorch_lora_weights.safetensors")
    if os.path.isfile(lora_weights_path):
        logger.info("Loading LoRA weights : %s", lora_weights_path)
        try:
            # Load with an explicit adapter name so we can target it precisely
            pipe.load_lora_weights(LORA_DIR, adapter_name="fashion_lora")

            # Set the adapter scale, then bake it permanently into the weights.
            # fuse_lora() merges adapter deltas into the base weight matrices,
            # eliminating the runtime overhead of separate LoRA tensors.
            pipe.set_adapters(["fashion_lora"], adapter_weights=[LORA_ADAPTER_WEIGHT])
            pipe.fuse_lora(adapter_names=["fashion_lora"], lora_scale=1.0)

            # Remove the now-redundant raw adapter tensors from memory
            pipe.unload_lora_weights()

            logger.info(
                "LoRA fused into model  (adapter_weight=%.2f, then baked at scale=1.0)",
                LORA_ADAPTER_WEIGHT,
            )
        except Exception as exc:
            logger.warning(
                "LoRA loading failed: %s  — continuing with base SDXL only.", exc
            )
    else:
        logger.warning(
            "LoRA weights not found at '%s'. "
            "Running base SDXL only — images will NOT have fashion fine-tuning.",
            lora_weights_path,
        )

    # ── 4. Memory optimisations  (CRITICAL for 4 GB VRAM) ───
    #    Sequential CPU offload: only the currently-running UNet layer
    #    sits in VRAM; everything else lives in system RAM.
    #    Do NOT call pipe.to("cuda") — offloading handles device placement.
    pipe.enable_sequential_cpu_offload()
    logger.info("Sequential CPU offload  : enabled")

    pipe.enable_vae_slicing()
    logger.info("VAE slicing             : enabled")

    pipe.enable_vae_tiling()
    logger.info("VAE tiling              : enabled")

    # Optional: xformers attention  (even lower VRAM if installed)
    try:
        pipe.enable_xformers_memory_efficient_attention()
        logger.info("xformers attention      : enabled")
    except Exception:
        logger.info("xformers               : not installed — default attention is fine")

    # ── 5. Final cleanup ─────────────────────────────────────
    gc.collect()
    torch.cuda.empty_cache()

    logger.info("Pipeline ready  (SDXL + LoRA on sequential CPU offload)")
    _pipeline = pipe
    return _pipeline


def _next_filename() -> str:
    """Returns the next sequential filename like generated_001.png."""
    existing = glob.glob(os.path.join(GENERATED_DIR, "generated_*.png"))
    if not existing:
        return "generated_001.png"
    nums = []
    for f in existing:
        try:
            num = int(os.path.basename(f).replace("generated_", "").replace(".png", ""))
            nums.append(num)
        except ValueError:
            pass
    return f"generated_{(max(nums) + 1 if nums else 1):03d}.png"


def _ensure_trigger_word(prompt: str) -> str:
    """
    Prepend the LoRA trigger word if it is not already in the prompt.
    The model was trained on 'sks fashion' — without it the LoRA has no effect.
    """
    if LORA_TRIGGER_WORD.lower() not in prompt.lower():
        logger.info(
            "Trigger word '%s' not in prompt — prepending automatically.",
            LORA_TRIGGER_WORD,
        )
        return f"{LORA_TRIGGER_WORD}, {prompt}"
    return prompt


# ═════════════════════════════════════════════════════════════
# ROUTES
# ═════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    """
    Receive a text prompt, generate a fashion image using SDXL + LoRA,
    save it to static/generated/, and return the web-accessible path.
    """
    data   = request.get_json(force=True)
    prompt = data.get("prompt", "").strip()

    if not prompt:
        return jsonify({"error": "Prompt is required."}), 400

    # Automatically inject the LoRA trigger word if absent
    prompt = _ensure_trigger_word(prompt)

    num_steps = int(data.get("steps",    DEFAULT_STEPS))
    guidance  = float(data.get("guidance", DEFAULT_GUIDANCE))
    width     = int(data.get("width",    DEFAULT_WIDTH))
    height    = int(data.get("height",   DEFAULT_HEIGHT))

    logger.info(
        "Generation request — prompt: '%s'  steps: %d  guidance: %.1f  size: %dx%d",
        prompt, num_steps, guidance, width, height,
    )

    try:
        pipe = get_pipeline()

        # Use a time-based seed so every click gives a different image
        generator = torch.Generator(device="cpu").manual_seed(
            int(time.time()) % (2 ** 32)
        )

        gc.collect()
        torch.cuda.empty_cache()

        start = time.time()
        with torch.no_grad():
            result = pipe(
                prompt=prompt,
                num_inference_steps=num_steps,
                guidance_scale=guidance,
                width=width,
                height=height,
                generator=generator,
            )
        elapsed = round(time.time() - start, 1)
        logger.info("Image generated in %.1f s", elapsed)

        image     = result.images[0]
        filename  = _next_filename()
        save_path = os.path.join(GENERATED_DIR, filename)
        image.save(save_path, format="PNG")
        logger.info("Saved : %s", save_path)

        gc.collect()
        torch.cuda.empty_cache()

        return jsonify({
            "image": f"/static/generated/{filename}",
            "prompt": prompt,
            "time": elapsed,
        })

    except torch.cuda.OutOfMemoryError:
        gc.collect()
        torch.cuda.empty_cache()
        logger.exception("CUDA Out of Memory")
        return jsonify({
            "error": "GPU out of memory. Try reducing resolution or restarting the server."
        }), 500

    except Exception:
        logger.exception("Generation failed")
        return jsonify({"error": "Image generation failed. Check server logs."}), 500


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("AI Fashion Generator  (SDXL + LoRA)")
    logger.info("=" * 60)
    logger.info("Base model        : %s", BASE_MODEL_ID)
    logger.info("LoRA directory    : %s", LORA_DIR)
    logger.info("LoRA trigger word : %s", LORA_TRIGGER_WORD)
    logger.info("LoRA weight       : %.2f", LORA_ADAPTER_WEIGHT)
    logger.info("Output directory  : %s", GENERATED_DIR)
    logger.info("Resolution        : %d x %d", DEFAULT_WIDTH, DEFAULT_HEIGHT)
    logger.info("Inference steps   : %d", DEFAULT_STEPS)
    logger.info("Guidance scale    : %.1f", DEFAULT_GUIDANCE)
    logger.info("CUDA available    : %s", torch.cuda.is_available())
    if torch.cuda.is_available():
        logger.info("GPU               : %s", torch.cuda.get_device_name(0))
    logger.info("=" * 60)
    app.run(debug=False, host="0.0.0.0", port=5000)
