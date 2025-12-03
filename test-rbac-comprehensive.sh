#!/bin/bash

# Comprehensive RBAC Testing Script
# Tests all 9 roles against critical endpoints

API_URL="https://hospital-api.alexandratechlab.com"
ORG_ID="137161a0-8e87-4147-85c7-a703bc15372d"

echo "🧪 Comprehensive RBAC Testing"
echo "=============================="
echo ""

# Test users
declare -A USERS
USERS[SuperAdmin]="superadmin@hospital.com:admin123"
USERS[HospitalAdmin]="hospitaladmin@hospital.com:admin123"
USERS[Doctor]="doctor@hospital.com:doctor123"
USERS[Nurse]="nurse@hospital.com:nurse123"
USERS[Receptionist]="receptionist@hospital.com:reception123"
USERS[Pharmacist]="pharmacist@hospital.com:pharma123"
USERS[LabTechnician]="labtech@hospital.com:lab123"
USERS[Radiologist]="radiologist@hospital.com:radio123"
USERS[Billing]="billing@hospital.com:billing123"

# Test matrix: endpoint:expected_roles
declare -A TEST_MATRIX
TEST_MATRIX["GET:/api/patients"]="SuperAdmin,HospitalAdmin,Doctor,Nurse,Receptionist"
TEST_MATRIX["POST:/api/departments/:id/beds"]="SuperAdmin,HospitalAdmin"
TEST_MATRIX["GET:/api/pharmacy/medicines"]="SuperAdmin,HospitalAdmin,Doctor,Pharmacist"
TEST_MATRIX["POST:/api/pharmacy/medicines"]="SuperAdmin,HospitalAdmin,Pharmacist"
TEST_MATRIX["POST:/api/pharmacy/prescriptions"]="SuperAdmin,HospitalAdmin,Doctor"
TEST_MATRIX["GET:/api/lab/tests"]="SuperAdmin,HospitalAdmin,Doctor,Nurse,LabTechnician"
TEST_MATRIX["GET:/api/billing/invoices"]="SuperAdmin,HospitalAdmin,Doctor,Receptionist,Billing"
TEST_MATRIX["POST:/api/billing/invoices"]="SuperAdmin,HospitalAdmin,Receptionist,Billing"
TEST_MATRIX["GET:/api/users"]="SuperAdmin,HospitalAdmin"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test endpoint access
test_access() {
    local role=$1
    local method=$2
    local endpoint=$3
    local expected_roles=$4
    local creds=${USERS[$role]}
    local email=$(echo $creds | cut -d: -f1)
    local password=$(echo $creds | cut -d: -f2)

    # Login
    local login_response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$email\", \"password\": \"$password\"}")

    local token=$(echo $login_response | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$token" ]; then
        echo "  ⚠️  $role: Login failed"
        return
    fi

    # Test endpoint
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$API_URL$endpoint" \
        -H "Authorization: Bearer $token")

    # Check if role should have access
    if echo ",$expected_roles," | grep -q ",$role,"; then
        # Should have access
        if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
            echo "  ✅ $role: Access granted ($http_code)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "  ❌ $role: Should have access but got $http_code"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        # Should NOT have access
        if [ "$http_code" = "403" ]; then
            echo "  ✅ $role: Access denied ($http_code) - Correct"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "  ❌ $role: Should be denied but got $http_code"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Run tests
echo "Testing Key Endpoints Against All Roles"
echo "========================================"
echo ""

echo "1. Patient Access (GET /api/patients)"
echo "   Expected: SuperAdmin, HospitalAdmin, Doctor, Nurse, Receptionist"
for role in "${!USERS[@]}"; do
    test_access "$role" "GET" "/api/patients?orgId=$ORG_ID" "SuperAdmin,HospitalAdmin,Doctor,Nurse,Receptionist"
done
echo ""

echo "2. Bed Creation (POST /api/departments/*/beds)"
echo "   Expected: SuperAdmin, HospitalAdmin only"
# Get a department ID first
DEPT_RESPONSE=$(curl -s "$API_URL/api/departments?orgId=$ORG_ID" -H "Authorization: Bearer $(curl -s -X POST "$API_URL/auth/login" -H "Content-Type: application/json" -d '{"email": "superadmin@hospital.com", "password": "admin123"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)")
DEPT_ID=$(echo $DEPT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$DEPT_ID" ]; then
    for role in "${!USERS[@]}"; do
        test_access "$role" "POST" "/api/departments/$DEPT_ID/beds" "SuperAdmin,HospitalAdmin"
    done
fi
echo ""

echo "3. Medicine Management (GET /api/pharmacy/medicines)"
echo "   Expected: SuperAdmin, HospitalAdmin, Doctor, Pharmacist"
for role in "${!USERS[@]}"; do
    test_access "$role" "GET" "/api/pharmacy/medicines?orgId=$ORG_ID" "SuperAdmin,HospitalAdmin,Doctor,Pharmacist"
done
echo ""

echo "4. User Management (GET /api/users)"
echo "   Expected: SuperAdmin, HospitalAdmin only"
for role in "${!USERS[@]}"; do
    test_access "$role" "GET" "/api/users?orgId=$ORG_ID" "SuperAdmin,HospitalAdmin"
done
echo ""

echo "========================================"
echo "RBAC Test Summary"
echo "========================================"
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ ALL RBAC TESTS PASSED!"
    exit 0
else
    echo "⚠️  Some RBAC tests failed"
    exit 1
fi
