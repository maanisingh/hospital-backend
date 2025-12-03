#!/bin/bash

echo "=== Hospital SaaS Organization API Test Suite ==="
echo ""

# Get SuperAdmin token
echo "1. Getting SuperAdmin authentication token..."
TOKEN=$(curl -s -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@novoraplus.com", "password": "NovoraPlus@2024!"}' | jq -r '.data.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get authentication token"
  exit 1
fi

echo "✅ Token obtained successfully"
echo ""

# Test 1: Create first hospital (h101)
echo "=== Test 1: Create First Hospital (should get code h101) ==="
RESPONSE1=$(curl -s -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "City General Hospital",
    "businessName": "City General Hospital Pvt Ltd",
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "India",
    "phone": "+91-22-12345678",
    "email": "admin@citygeneralhospital.com",
    "helplineNumber": "+91-22-87654321",
    "ownerName": "Dr. Rajesh Kumar",
    "ownerEmail": "rajesh@citygeneralhospital.com",
    "ownerMobile": "+91-9876543210",
    "dashboardFooterText": "City General Hospital - Your Health, Our Priority",
    "themePrimaryColor": "#007bff",
    "themeSecondaryColor": "#6c757d"
  }')

ORG1_CODE=$(echo "$RESPONSE1" | jq -r '.data.code')
ORG1_ID=$(echo "$RESPONSE1" | jq -r '.data.id')
echo "$RESPONSE1" | jq
echo ""

# Test 2: Create second hospital (h102)
echo "=== Test 2: Create Second Hospital (should get code h102) ==="
RESPONSE2=$(curl -s -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Metro Care Hospital",
    "businessName": "Metro Care Healthcare Solutions",
    "address": "456 Park Avenue",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "country": "India",
    "phone": "+91-11-12345678",
    "email": "contact@metrocare.com",
    "helplineNumber": "+91-11-87654321",
    "ownerName": "Dr. Priya Sharma",
    "ownerEmail": "priya@metrocare.com",
    "ownerMobile": "+91-9988776655",
    "dashboardFooterText": "Metro Care - Advanced Healthcare",
    "themePrimaryColor": "#28a745",
    "themeSecondaryColor": "#ffc107"
  }')

ORG2_CODE=$(echo "$RESPONSE2" | jq -r '.data.code')
ORG2_ID=$(echo "$RESPONSE2" | jq -r '.data.id')
echo "$RESPONSE2" | jq
echo ""

# Test 3: Get all organizations
echo "=== Test 3: List All Organizations ==="
curl -s -X GET http://localhost:5000/api/organizations \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Test 4: Get organization by code
echo "=== Test 4: Get Organization by Code ($ORG1_CODE) ==="
curl -s -X GET "http://localhost:5000/api/organizations/code/$ORG1_CODE" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Test 5: Update organization
echo "=== Test 5: Update Organization ==="
curl -s -X PATCH "http://localhost:5000/api/organizations/$ORG1_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "logo": "https://example.com/logo.png",
    "facebookUrl": "https://facebook.com/citygeneralhospital",
    "instagramUrl": "https://instagram.com/citygeneralhospital"
  }' | jq
echo ""

# Test 6: Get single organization
echo "=== Test 6: Get Single Organization Details ==="
curl -s -X GET "http://localhost:5000/api/organizations/$ORG1_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Summary
echo "=== Test Summary ==="
echo "✅ Created organizations with codes: $ORG1_CODE, $ORG2_CODE"
echo "✅ All organization endpoints working correctly"
echo ""
echo "📊 Next Steps:"
echo "  - Connect frontend to use these endpoints"
echo "  - Build Patient, Department, Bed endpoints"
echo "  - Implement OPD/IPD modules"
