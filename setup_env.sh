#!/bin/bash
set -e

echo "🔄 Initializing and updating git submodules..."

# 0. Submodule initialisieren und auf main setzen
git submodule update --init --recursive

# Versuche alle Submodule auf main zu setzen (falls der Branch existiert)
git submodule foreach '
  echo "➡️ Processing $name in $path"
  cd $path
  if git show-ref --verify --quiet refs/heads/main || git ls-remote --exit-code --heads origin main > /dev/null; then
    git checkout main
    git pull origin main
  else
    echo "⚠️  Branch 'main' not found in $name"
  fi
'

echo "✅ Submodules ready."

# 1. Virtuelle Umgebung anlegen, falls nicht vorhanden
if [ ! -d ".venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv .venv
fi

# 2. Aktivieren (für direktes Testing im Terminal)
source .venv/bin/activate

# 3. Pip und wheel upgraden
pip install --upgrade pip wheel

# 4. Requirements installieren
if [ -f "requirements.txt" ]; then
  echo "📚 Installing requirements..."
  pip install -r requirements.txt
else
  echo "⚠️ requirements.txt not found!"
fi

echo "✅ Environment setup complete."
