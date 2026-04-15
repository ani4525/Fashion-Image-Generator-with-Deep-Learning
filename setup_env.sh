#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
# AI Fashion Generator — Linux / macOS Environment Setup
# Run ONCE from the project root: bash setup_env.sh
# Requires: Python 3.10.x  (pyenv recommended)
# ════════════════════════════════════════════════════════════
set -e

echo ""
echo " [1/5] Checking Python version..."
python3 --version

echo ""
echo " [2/5] Creating virtual environment (venv_fashion)..."
python3 -m venv venv_fashion

echo " [3/5] Activating virtual environment..."
source venv_fashion/bin/activate

echo " [4/5] Upgrading pip..."
pip install --upgrade pip

echo " [5/5] Installing dependencies..."
pip install torch==2.3.1+cu121 torchvision==0.18.1+cu121 torchaudio==2.3.1+cu121 \
    --index-url https://download.pytorch.org/whl/cu121

pip install \
    diffusers==0.29.2 \
    transformers==4.41.2 \
    accelerate==0.30.1 \
    safetensors==0.4.3 \
    Pillow==10.3.0 \
    invisible-watermark==0.2.0 \
    scipy==1.13.1 \
    omegaconf==2.3.0 \
    flask==3.0.3

echo ""
echo " ════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  To START the server:"
echo "    source venv_fashion/bin/activate"
echo "    python app.py"
echo "    Open: http://localhost:5000"
echo " ════════════════════════════════════════════════"
