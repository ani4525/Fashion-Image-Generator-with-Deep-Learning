@echo off
REM ════════════════════════════════════════════════════════════
REM  AI Fashion Generator — Windows Environment Setup
REM  Run this ONCE from the project root folder.
REM  Requires: Python 3.10.x already installed on your machine.
REM  Download Python 3.10: https://www.python.org/downloads/release/python-31011/
REM ════════════════════════════════════════════════════════════

echo.
echo  [1/5] Checking Python version...
python --version 2>NUL
IF ERRORLEVEL 1 (
    echo  ERROR: Python not found. Install Python 3.10 from:
    echo         https://www.python.org/downloads/release/python-31011/
    pause
    exit /b 1
)

REM Warn if Python is not 3.10
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo  Python version: %PYVER%
echo  [WARNING] This project requires Python 3.10.x
echo  [WARNING] Python 3.11 / 3.12 / 3.13 cause torch.distributed errors.
echo.

echo  [2/5] Creating virtual environment (venv_fashion)...
python -m venv venv_fashion
IF ERRORLEVEL 1 (
    echo  ERROR: Failed to create virtual environment.
    pause
    exit /b 1
)

echo  [3/5] Activating virtual environment...
call venv_fashion\Scripts\activate.bat

echo  [4/5] Upgrading pip...
python -m pip install --upgrade pip

echo  [5/5] Installing dependencies (PyTorch CUDA 12.1 + diffusers stack)...
echo  This will download ~5-7 GB of model weights on first run.
echo  Package install itself is ~2 GB. Please wait...
echo.

pip install torch==2.3.1+cu121 torchvision==0.18.1+cu121 torchaudio==2.3.1+cu121 ^
    --index-url https://download.pytorch.org/whl/cu121

pip install ^
    diffusers==0.29.2 ^
    transformers==4.41.2 ^
    accelerate==0.30.1 ^
    safetensors==0.4.3 ^
    Pillow==10.3.0 ^
    invisible-watermark==0.2.0 ^
    scipy==1.13.1 ^
    omegaconf==2.3.0 ^
    flask==3.0.3

echo.
echo  ════════════════════════════════════════════════════
echo   Setup complete!
echo.
echo   To START the server:
echo     1. Open a terminal in the project folder
echo     2. Run: venv_fashion\Scripts\activate
echo     3. Run: python app.py
echo     4. Open: http://localhost:5000
echo  ════════════════════════════════════════════════════
echo.
pause
