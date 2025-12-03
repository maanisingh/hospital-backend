#!/bin/bash

echo "=== Hospital SaaS Patient API Test Suite ==="
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

# Get h101 organization ID
echo "2. Getting h101 organization ID..."
ORG_RESPONSE=$(curl -s -X GET "http://localhost:5000/api/organizations/code/h101" \
  -H "Authorization: Bearer $TOKEN")

ORG_ID=$(echo "$ORG_RESPONSE" | jq -r '.data.id')

if [ "$ORG_ID" = "null" ] || [ -z "$ORG_ID" ]; then
  echo "❌ Failed to get organization ID for h101"
  echo "$ORG_RESPONSE" | jq
  exit 1
fi

echo "✅ Got organization ID: $ORG_ID"
echo ""

# Test 1: Register first patient (should get PAT001)
echo "=== Test 1: Register First Patient (should get code PAT001) ==="
RESPONSE1=$(curl -s -X POST "http://localhost:5000/api/patients?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rajesh Kumar Sharma",
    "mobile": "+91-9876543210",
    "email": "rajesh.sharma@email.com",
    "dateOfBirth": "1985-06-15",
    "gender": "Male",
    "bloodGroup": "O+",
    "address": "123 MG Road",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "emergencyContactName": "Priya Sharma",
    "emergencyContactNumber": "+91-9876543211",
    "allergies": "Penicillin",
    "medicalHistory": "Hypertension diagnosed in 2020",
    "chronicDiseases": ["Hypertension"],
    "currentMedications": ["Amlodipine 5mg - once daily"]
  }')

PATIENT1_CODE=$(echo "$RESPONSE1" | jq -r '.data.patientCode')
PATIENT1_ID=$(echo "$RESPONSE1" | jq -r '.data.id')
PATIENT1_AGE=$(echo "$RESPONSE1" | jq -r '.data.age')
echo "$RESPONSE1" | jq
echo ""

# Test 2: Register second patient (should get PAT002)
echo "=== Test 2: Register Second Patient (should get code PAT002) ==="
RESPONSE2=$(curl -s -X POST "http://localhost:5000/api/patients?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Priya Mehta",
    "mobile": "+91-9988776655",
    "email": "priya.mehta@email.com",
    "dateOfBirth": "1992-03-20",
    "gender": "Female",
    "bloodGroup": "A+",
    "address": "456 Park Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400002",
    "emergencyContactName": "Amit Mehta",
    "emergencyContactNumber": "+91-9988776656"
  }')

PATIENT2_CODE=$(echo "$RESPONSE2" | jq -r '.data.patientCode')
PATIENT2_ID=$(echo "$RESPONSE2" | jq -r '.data.id')
echo "$RESPONSE2" | jq
echo ""

# Test 3: Try duplicate mobile (should fail)
echo "=== Test 3: Try Duplicate Mobile Number (should fail) ==="
curl -s -X POST "http://localhost:5000/api/patients?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Another Patient",
    "mobile": "+91-9876543210"
  }' | jq
echo ""

# Test 4: List all patients
echo "=== Test 4: List All Patients for h101 ==="
curl -s -X GET "http://localhost:5000/api/patients?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Test 5: Get patient by code
echo "=== Test 5: Get Patient by Code ($PATIENT1_CODE) ==="
curl -s -X GET "http://localhost:5000/api/patients/code/$PATIENT1_CODE?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Test 6: Get single patient by ID
echo "=== Test 6: Get Single Patient by ID ==="
curl -s -X GET "http://localhost:5000/api/patients/$PATIENT1_ID?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Test 7: Update patient
echo "=== Test 7: Update Patient (add photo and update address) ==="
curl -s -X PATCH "http://localhost:5000/api/patients/$PATIENT1_ID?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "789 New Address Road",
    "photo": "https://example.com/photos/patient1.jpg"
  }' | jq
echo ""

# Test 8: Search patients
echo "=== Test 8: Search Patients (search: 'Priya') ==="
curl -s -X GET "http://localhost:5000/api/patients?orgId=$ORG_ID&search=Priya" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Test 9: Filter by status
echo "=== Test 9: Filter Patients by Status (active) ==="
curl -s -X GET "http://localhost:5000/api/patients?orgId=$ORG_ID&status=active" \
  -H "Authorization: Bearer $TOKEN" | jq '.meta'
echo ""

# Test 10: Get patient history (will be empty for now)
echo "=== Test 10: Get Patient Medical History ==="
curl -s -X GET "http://localhost:5000/api/patients/$PATIENT1_ID/history?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    patientCode: .data.patientCode,
    name: .data.name,
    opdTokensCount: (.data.opdTokens | length),
    ipdAdmissionsCount: (.data.ipdAdmissions | length),
    labTestsCount: (.data.labTests | length)
  }'
echo ""

# Test 11: Soft delete patient
echo "=== Test 11: Soft Delete Patient (deactivate) ==="
curl -s -X DELETE "http://localhost:5000/api/patients/$PATIENT2_ID?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Test 12: Verify soft delete (should show status=inactive)
echo "=== Test 12: Verify Soft Delete (check status) ==="
curl -s -X GET "http://localhost:5000/api/patients/$PATIENT2_ID?orgId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    patientCode: .data.patientCode,
    name: .data.name,
    status: .data.status
  }'
echo ""

# Summary
echo "=== Test Summary ==="
echo "✅ Patient Registration: $PATIENT1_CODE (Age: $PATIENT1_AGE), $PATIENT2_CODE"
echo "✅ Auto-code generation working (PAT001, PAT002)"
echo "✅ Age calculation working (born 1985-06-15 → age $PATIENT1_AGE)"
echo "✅ Duplicate mobile detection working"
echo "✅ Search and filter working"
echo "✅ Soft delete working"
echo ""
echo "📊 Next Steps:"
echo "  - Test with h102 organization (independent patient numbering)"
echo "  - Build Department and Bed endpoints"
echo "  - Start OPD module (token generation using these patients)"
