#!/bin/bash
# Script de instalação — rode UMA VEZ antes de usar

echo "📦 Instalando dependências Python..."
pip3 install -r requirements.txt

echo ""
echo "✅ Instalação concluída!"
echo ""
echo "Próximo passo:"
echo "  1. Copie o arquivo .env.exemplo para .env"
echo "  2. Abra o .env e cole seus tokens"
echo "  3. Execute: python3 coletar.py"
