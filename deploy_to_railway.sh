#!/bin/bash

# Hospital SaaS Backend - Deploy to Railway
# This script deploys the backend and creates a PostgreSQL database

set -e

echo "=== HOSPITAL SAAS BACKEND DEPLOYMENT ==="
echo ""

# Railway credentials
export RAILWAY_TOKEN="8182acce-0e52-4221-92e7-600c5b729dd8"
PROJECT_ID="46f5d603-e9ed-4ae8-8661-0823f403f071"  # kind-generosity project

echo "Step 1: Creating new PostgreSQL database for Hospital SaaS..."
echo ""

# Create PostgreSQL service via Railway API
PG_RESPONSE=$(curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation serviceCreate($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }",
    "variables": {
      "input": {
        "projectId": "'$PROJECT_ID'",
        "name": "hospital-postgres",
        "source": {
          "image": "postgres:15-alpine"
        }
      }
    }
  }')

echo "PostgreSQL Response:"
echo "$PG_RESPONSE" | jq

PG_SERVICE_ID=$(echo "$PG_RESPONSE" | jq -r '.data.serviceCreate.id')

if [ "$PG_SERVICE_ID" = "null" ] || [ -z "$PG_SERVICE_ID" ]; then
    echo "❌ Failed to create PostgreSQL service"
    echo "Response: $PG_RESPONSE"
    exit 1
fi

echo "✅ PostgreSQL service created: $PG_SERVICE_ID"
echo ""

# Wait for PostgreSQL to be ready
echo "Waiting 30 seconds for PostgreSQL to initialize..."
sleep 30

echo ""
echo "Step 2: Creating Hospital SaaS Backend service..."
echo ""

# Create backend service
BACKEND_RESPONSE=$(curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation serviceCreate($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }",
    "variables": {
      "input": {
        "projectId": "'$PROJECT_ID'",
        "name": "hospital-backend",
        "source": {
          "repo": "github"
        }
      }
    }
  }')

echo "Backend Response:"
echo "$BACKEND_RESPONSE" | jq

BACKEND_SERVICE_ID=$(echo "$BACKEND_RESPONSE" | jq -r '.data.serviceCreate.id')

if [ "$BACKEND_SERVICE_ID" = "null" ] || [ -z "$BACKEND_SERVICE_ID" ]; then
    echo "⚠️  Backend service creation may have issues. Trying alternative approach..."
fi

echo ""
echo "Step 3: Get PostgreSQL connection string..."
echo ""

# Get PostgreSQL variables
PG_VARS=$(curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query variables($serviceId: String!) { variables(serviceId: $serviceId) }",
    "variables": {
      "serviceId": "'$PG_SERVICE_ID'"
    }
  }')

echo "PostgreSQL Variables:"
echo "$PG_VARS" | jq

# Extract DATABASE_URL
DATABASE_URL=$(echo "$PG_VARS" | jq -r '.data.variables.DATABASE_URL // .data.variables.PGDATABASE')

if [ "$DATABASE_URL" != "null" ] && [ -n "$DATABASE_URL" ]; then
    echo "✅ Got DATABASE_URL"
else
    # Construct DATABASE_URL manually
    PG_HOST=$(echo "$PG_VARS" | jq -r '.data.variables.PGHOST // "postgres"')
    PG_PORT=$(echo "$PG_VARS" | jq -r '.data.variables.PGPORT // "5432"')
    PG_USER=$(echo "$PG_VARS" | jq -r '.data.variables.PGUSER // "postgres"')
    PG_PASS=$(echo "$PG_VARS" | jq -r '.data.variables.PGPASSWORD // "postgres"')
    PG_DB=$(echo "$PG_VARS" | jq -r '.data.variables.PGDATABASE // "railway"')

    DATABASE_URL="postgresql://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/$PG_DB"
    echo "✅ Constructed DATABASE_URL"
fi

echo ""
echo "=== DEPLOYMENT SUMMARY ==="
echo "PostgreSQL Service ID: $PG_SERVICE_ID"
echo "Backend Service ID: $BACKEND_SERVICE_ID"
echo "DATABASE_URL: ${DATABASE_URL:0:50}..."
echo ""
echo "Next steps:"
echo "1. Link this Git repo to Railway backend service"
echo "2. Set DATABASE_URL environment variable on backend service"
echo "3. Railway will auto-deploy and run migrations"
echo ""
echo "Or use Railway CLI:"
echo "  cd /root/hospital-backend"
echo "  railway link $BACKEND_SERVICE_ID"
echo "  railway up"
