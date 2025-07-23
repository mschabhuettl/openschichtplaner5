#!/bin/bash
set -e

echo "🔄 Initializing and updating git submodules..."

# 0. Submodule initialisieren und auf main setzen (ohne unnötiges cd)
git submodule update --init --recursive

git submodule foreach '
  echo "➡️ Processing $name"
  if git show-ref --verify --quiet refs/heads/main || git ls-remote --exit-code --heads origin main > /dev/null; then
    git checkout main
    git pull origin main
  else
    echo "⚠️  Branch main not found in $name"
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

# 5. PyCharm misc.xml generieren mit lokalem venv-Pfad
echo "🧠 Generating PyCharm .idea/misc.xml..."

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
VENV_PATH="$(pwd)/.venv"

mkdir -p .idea

cat > .idea/misc.xml <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="Black">
    <option name="sdkName" value="Python ${PYTHON_VERSION} virtualenv at ${VENV_PATH}" />
  </component>
  <component name="ProjectRootManager"
             version="2"
             project-jdk-name="Python ${PYTHON_VERSION} virtualenv at ${VENV_PATH}"
             project-jdk-type="Python SDK" />
</project>
EOF

echo "✅ Environment and PyCharm config complete."
