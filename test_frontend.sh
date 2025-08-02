#!/bin/bash
# Test script for OpenSchichtplaner5 Frontend

echo "Testing OpenSchichtplaner5 Frontend..."
echo "======================================"

# Test if server is running
if ! curl -s http://localhost:8080/api/health > /dev/null; then
    echo "❌ Server is not running. Please start with: ./start_webserver.sh"
    exit 1
fi

echo "✅ Server is running"

# Test API endpoints
echo ""
echo "Testing API endpoints:"
echo "----------------------"

# Health check
HEALTH=$(curl -s http://localhost:8080/api/health | jq -r '.status' 2>/dev/null || echo "unknown")
if [ "$HEALTH" = "healthy" ]; then
    echo "✅ Health check: $HEALTH"
else
    echo "❌ Health check failed or jq not installed"
fi

# Test if we can get employees
EMPLOYEES_RESPONSE=$(curl -s http://localhost:8080/api/employees)
if echo "$EMPLOYEES_RESPONSE" | grep -q "id" 2>/dev/null; then
    echo "✅ Employees endpoint working"
else
    echo "❌ Employees endpoint failed"
fi

# Test if we can get groups
GROUPS_RESPONSE=$(curl -s http://localhost:8080/api/groups)
if echo "$GROUPS_RESPONSE" | grep -q "id" 2>/dev/null; then
    echo "✅ Groups endpoint working"
else
    echo "❌ Groups endpoint failed"
fi

echo ""
echo "Testing Frontend routes:"
echo "------------------------"

# Test frontend root
if curl -s http://localhost:8080/ | grep -q "OpenSchichtplaner5" 2>/dev/null; then
    echo "✅ Frontend root (/) - serves HTML dashboard"
else
    echo "❌ Frontend root failed"
fi

# Test API documentation
if curl -s http://localhost:8080/api/docs | grep -q "swagger" 2>/dev/null; then
    echo "✅ API documentation available"
else
    echo "❌ API documentation failed"
fi

# Test static files
if curl -s http://localhost:8080/static/js/app.js | head -1 | grep -q "." 2>/dev/null; then
    echo "✅ JavaScript files accessible"
else
    echo "❌ JavaScript files failed"
fi

if curl -s http://localhost:8080/static/css/styles.css | head -1 | grep -q "." 2>/dev/null; then
    echo "✅ CSS files accessible"
else
    echo "❌ CSS files failed"
fi

echo ""
echo "🌐 Frontend URLs:"
echo "  Dashboard:     http://localhost:8080/"
echo "  Dienstplan:    http://localhost:8080/schichtplan/dienstplan"
echo "  Einsatzplan:   http://localhost:8080/schichtplan/einsatzplan"
echo "  Jahresplan:    http://localhost:8080/schichtplan/jahresplan"
echo "  API Docs:      http://localhost:8080/api/docs"
echo "  API Health:    http://localhost:8080/api/health"
echo ""
echo "Test completed! 🚀"