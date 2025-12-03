#!/bin/bash

# Hospital SaaS Backend - Manual Railway Deployment Helper
# This script provides manual deployment instructions

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       Hospital SaaS Backend - Railway Deployment Helper       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found!"
    echo ""
    echo "Install Railway CLI:"
    echo "  npm i -g @railway/cli"
    echo ""
    exit 1
fi

echo "✅ Railway CLI is installed"
echo ""

# Repository info
echo "📦 Repository Information:"
echo "   GitHub: https://github.com/maanisingh/hospital-backend"
echo "   Branch: main"
echo "   Status: All code committed and pushed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DEPLOYMENT OPTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Option 1: Deploy via Railway Web Dashboard (Recommended)"
echo "────────────────────────────────────────────────────────────────"
echo "1. Go to: https://railway.app/new"
echo "2. Click 'Deploy from GitHub repo'"
echo "3. Authorize Railway to access your GitHub"
echo "4. Select: maanisingh/hospital-backend"
echo "5. Railway will automatically:"
echo "   ✓ Detect Node.js project"
echo "   ✓ Install dependencies"
echo "   ✓ Build the application"
echo ""
echo "6. Add PostgreSQL:"
echo "   ✓ Click '+ New' in your project"
echo "   ✓ Select 'Database' → 'PostgreSQL'"
echo "   ✓ Wait 30 seconds for database to provision"
echo ""
echo "7. Set Environment Variables:"
echo "   ✓ Go to your backend service settings"
echo "   ✓ Click 'Variables' tab"
echo "   ✓ Add these variables:"
echo ""
echo "   DATABASE_URL=\${{Postgres.DATABASE_URL}}"
echo "   NODE_ENV=production"
echo "   PORT=3000"
echo "   JWT_SECRET=hospital-saas-jwt-secret-production-2025"
echo "   FRONTEND_URL=https://hospital-saas.alexandratechlab.com"
echo ""
echo "8. Generate Public Domain:"
echo "   ✓ Go to 'Settings' → 'Networking'"
echo "   ✓ Click 'Generate Domain'"
echo "   ✓ Your API will be at: https://your-project.up.railway.app"
echo ""
echo "9. Deploy:"
echo "   ✓ Click 'Deploy' button"
echo "   ✓ Wait 2-3 minutes for build"
echo "   ✓ Check logs for success"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Option 2: Deploy via Railway CLI"
echo "────────────────────────────────────────────────────────────────"
echo "Run these commands:"
echo ""
echo "  cd /root/hospital-backend"
echo "  railway login"
echo "  railway init"
echo "  railway add --database postgresql"
echo "  railway up"
echo ""
echo "Then set environment variables:"
echo "  railway variables set NODE_ENV=production"
echo "  railway variables set PORT=3000"
echo "  railway variables set JWT_SECRET=hospital-saas-jwt-secret-production-2025"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 Quick Checklist:"
echo "  [ ] GitHub repo accessible: https://github.com/maanisingh/hospital-backend"
echo "  [ ] Railway account created: https://railway.app"
echo "  [ ] GitHub authorized on Railway"
echo "  [ ] Project created on Railway"
echo "  [ ] PostgreSQL database added"
echo "  [ ] Environment variables configured"
echo "  [ ] Domain generated"
echo "  [ ] Deployment successful"
echo "  [ ] Health check passing"
echo ""

echo "🧪 Test After Deployment:"
echo "  curl https://your-project.up.railway.app/api/health"
echo ""
echo "  curl -X POST https://your-project.up.railway.app/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"superadmin@hospital.com\",\"password\":\"password123\"}'"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📚 Need Help?"
echo "  • Railway Docs: https://docs.railway.com/guides/express"
echo "  • Full Guide: ./RAILWAY_DEPLOYMENT_GUIDE.md"
echo "  • RBAC Details: ./RBAC_IMPLEMENTATION_COMPLETE.md"
echo ""

echo "✨ Everything is ready! Choose an option above to deploy."
echo ""
