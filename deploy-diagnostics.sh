#!/bin/bash
# Deploy Diagnostics für Toolsapp
# Schritt-für-Schritt Überprüfung nach einem Deploy

set -e  # Exit on error

echo "=========================================="
echo "TOOLSAPP DEPLOY DIAGNOSTICS"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find toolsapp root (where this script is)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TOOLSAPP_ROOT="$SCRIPT_DIR"

echo "📍 Toolsapp Root: $TOOLSAPP_ROOT"
echo ""

# Check 1: APP_DATA_DIR environment variable
echo "[1] Checking APP_DATA_DIR environment..."
if [ -z "$APP_DATA_DIR" ]; then
    echo -e "${YELLOW}⚠️  APP_DATA_DIR is NOT set${NC}"
    echo "   Current behavior: Using app/ directory for databases"
    echo "   On production, consider setting: export APP_DATA_DIR=/path/to/data"
else
    echo -e "${GREEN}✓ APP_DATA_DIR is set to: $APP_DATA_DIR${NC}"
fi
echo ""

# Check 2: Database files
echo "[2] Checking database files..."
echo "   app/users.sqlite: $([ -f "$TOOLSAPP_ROOT/app/users.sqlite" ] && echo 'EXISTS (size:' $(stat -f%z "$TOOLSAPP_ROOT/app/users.sqlite" 2>/dev/null || stat -c%s "$TOOLSAPP_ROOT/app/users.sqlite" 2>/dev/null || echo "?")' bytes)' || echo 'MISSING')"
echo "   data/users.sqlite: $([ -f "$TOOLSAPP_ROOT/data/users.sqlite" ] && echo 'EXISTS' || echo 'MISSING')"

# Check for duplicate DB scenario
if [ -f "$TOOLSAPP_ROOT/app/users.sqlite" ] && [ -f "$TOOLSAPP_ROOT/data/users.sqlite" ]; then
    echo -e "${RED}⚠️  WARNING: Both app/ and data/ databases exist!${NC}"
    echo "   This can cause user sync issues. Recommended steps:"
    echo "   1) Decide which one has the 'real' data"
    echo "   2) Delete the other one OR"
    echo "   3) Set APP_DATA_DIR to point to the correct location"
fi
echo ""

# Check 3: Run PHP diagnosis
echo "[3] Running PHP diagnosis script..."
echo ""
cd "$TOOLSAPP_ROOT"
php diagnose.php
echo ""

# Check 4: Recommendations
echo "[4] DEPLOYMENT RECOMMENDATIONS"
echo ""
echo "After deploying new code:"
echo ""
echo "  1️⃣  Set environment variable (in .htaccess or web server config):"
echo "     SetEnv APP_DATA_DIR /home/www/HTML_Tools/toolsapp/data"
echo ""
echo "  2️⃣  Create data directory with proper permissions:"
echo "     mkdir -p /home/www/HTML_Tools/toolsapp/data"
echo "     chmod 775 /home/www/HTML_Tools/toolsapp/data"
echo ""
echo "  3️⃣  Run database migrations:"
echo "     cd /home/www/HTML_Tools/toolsapp"
echo "     export APP_DATA_DIR=/home/www/HTML_Tools/toolsapp/data"
echo "     php app/migrate.php"
echo ""
echo "  4️⃣  Verify login works:"
echo "     Visit: https://your-domain.com/login.php"
echo "     Try logging in with a known user"
echo ""
echo "  5️⃣  If login still fails, run diagnosis:"
echo "     curl https://your-domain.com/diagnose.php"
echo "     (or: php diagnose.php from command line)"
echo ""
echo "=========================================="
