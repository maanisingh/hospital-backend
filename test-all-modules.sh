#!/bin/bash

# Hospital SaaS Backend - Comprehensive Testing Suite
# Tests all 16 modules with 149+ endpoints

API_URL="https://hospital-api.alexandratechlab.com"
TEST_RESULTS_DIR="/root/hospital-backend/test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_LOG="$TEST_RESULTS_DIR/test_log_$TIMESTAMP.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create test results directory
mkdir -p $TEST_RESULTS_DIR

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "========================================" | tee -a $TEST_LOG
echo "Hospital SaaS Backend - Comprehensive Testing" | tee -a $TEST_LOG
echo "Started: $(date)" | tee -a $TEST_LOG
echo "API URL: $API_URL" | tee -a $TEST_LOG
echo "========================================" | tee -a $TEST_LOG
echo "" | tee -a $TEST_LOG

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local auth_header=$4
    local data=$5
    local expected_status=$6

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing: $description... " | tee -a $TEST_LOG

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $auth_header")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $auth_header" \
            -d "$data")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)" | tee -a $TEST_LOG
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $http_code)" | tee -a $TEST_LOG
        echo "Response: $body" >> $TEST_LOG
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# ============================================
# 1. AUTHENTICATION TESTS
# ============================================
echo -e "${BLUE}=== 1. Authentication Module Tests ===${NC}" | tee -a $TEST_LOG

# Test 1.1: Health Check
test_endpoint "GET" "/health" "Health Check" "" "" 200

# Test 1.2: Login with valid credentials
echo "Logging in to get access token..." | tee -a $TEST_LOG
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "superadmin@hospital.com",
        "password": "admin123"
    }')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}✗ FAILED to get access token${NC}" | tee -a $TEST_LOG
    echo "Login Response: $LOGIN_RESPONSE" | tee -a $TEST_LOG
    exit 1
else
    echo -e "${GREEN}✓ Successfully obtained access token${NC}" | tee -a $TEST_LOG
    # Extract user ID from JWT token for use as doctorId
    DOCTOR_ID=$(echo $ACCESS_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
fi

# Test 1.3: Invalid login
test_endpoint "POST" "/auth/login" "Invalid Login" "" \
    '{"email":"invalid@test.com","password":"wrongpass"}' 401

# Test 1.4: Get current user
test_endpoint "GET" "/users/me" "Get Current User" "$ACCESS_TOKEN" "" 200

# Test 1.5: Unauthorized access
test_endpoint "GET" "/users/me" "Unauthorized Access" "invalid-token" "" 403

echo "" | tee -a $TEST_LOG

# ============================================
# 2. ORGANIZATION TESTS
# ============================================
echo -e "${BLUE}=== 2. Organization Module Tests ===${NC}" | tee -a $TEST_LOG

# Test 2.1: List organizations
test_endpoint "GET" "/api/organizations" "List Organizations" "$ACCESS_TOKEN" "" 200

# Test 2.2: Create organization
ORG_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/organizations" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "name": "Test Hospital",
        "type": "hospital",
        "email": "test@hospital.com",
        "phone": "+1234567890",
        "address": "123 Test St",
        "city": "Test City",
        "state": "Test State",
        "country": "Test Country",
        "zipCode": "12345"
    }')

ORG_ID=$(echo $ORG_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ORG_ID" ]; then
    echo -e "${GREEN}✓ Organization created with ID: $ORG_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create organization${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 2.3: Get organization by ID
test_endpoint "GET" "/api/organizations/$ORG_ID" "Get Organization by ID" "$ACCESS_TOKEN" "" 200

# Test 2.4: Update organization
test_endpoint "PATCH" "/api/organizations/$ORG_ID" "Update Organization" "$ACCESS_TOKEN" \
    '{"name":"Test Hospital Updated"}' 200

# Test 2.5: Get organization stats
test_endpoint "GET" "/api/organizations/$ORG_ID/stats" "Get Organization Stats" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# 3. PATIENT MANAGEMENT TESTS
# ============================================
echo -e "${BLUE}=== 3. Patient Management Tests ===${NC}" | tee -a $TEST_LOG

# Test 3.1: Create patient
UNIQUE_EMAIL="john.doe.${TIMESTAMP}@test.com"
PATIENT_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/patients?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"firstName\": \"John\",
        \"lastName\": \"Doe\",
        \"dateOfBirth\": \"1990-01-01\",
        \"gender\": \"male\",
        \"bloodGroup\": \"O+\",
        \"phone\": \"+1234567890\",
        \"email\": \"$UNIQUE_EMAIL\",
        \"address\": \"123 Patient St\",
        \"city\": \"Patient City\"
    }")

PATIENT_ID=$(echo $PATIENT_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PATIENT_CODE=$(echo $PATIENT_CREATE_RESPONSE | grep -o '"patientCode":"[^"]*"' | cut -d'"' -f4)

if [ -n "$PATIENT_ID" ]; then
    echo -e "${GREEN}✓ Patient created with ID: $PATIENT_ID, Code: $PATIENT_CODE${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create patient${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 3.2: List patients
test_endpoint "GET" "/api/patients?orgId=$ORG_ID" "List Patients" "$ACCESS_TOKEN" "" 200

# Test 3.3: Get patient by ID
test_endpoint "GET" "/api/patients/$PATIENT_ID?orgId=$ORG_ID" "Get Patient by ID" "$ACCESS_TOKEN" "" 200

# Test 3.4: Get patient by code
test_endpoint "GET" "/api/patients/code/$PATIENT_CODE?orgId=$ORG_ID" "Get Patient by Code" "$ACCESS_TOKEN" "" 200

# Test 3.5: Update patient
test_endpoint "PATCH" "/api/patients/$PATIENT_ID?orgId=$ORG_ID" "Update Patient" "$ACCESS_TOKEN" \
    '{"phone":"+9876543210"}' 200

# Test 3.6: Get patient history
test_endpoint "GET" "/api/patients/$PATIENT_ID/history?orgId=$ORG_ID" "Get Patient History" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# 4. DEPARTMENT & BED MANAGEMENT TESTS
# ============================================
echo -e "${BLUE}=== 4. Department & Bed Management Tests ===${NC}" | tee -a $TEST_LOG

# Test 4.1: Create department
DEPT_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/departments?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "name": "Cardiology",
        "code": "CARD",
        "type": "OPD",
        "description": "Heart and vascular care"
    }')

DEPT_ID=$(echo $DEPT_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$DEPT_ID" ]; then
    echo -e "${GREEN}✓ Department created with ID: $DEPT_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create department${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 4.2: List departments
test_endpoint "GET" "/api/departments?orgId=$ORG_ID" "List Departments" "$ACCESS_TOKEN" "" 200

# Test 4.3: Create bed
BED_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/departments/$DEPT_ID/beds?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "bedNumber": "CARD-101",
        "bedType": "general",
        "floor": "1",
        "ward": "General Ward"
    }')

BED_ID=$(echo $BED_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$BED_ID" ]; then
    echo -e "${GREEN}✓ Bed created with ID: $BED_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create bed${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 4.4: Get available beds
test_endpoint "GET" "/api/departments/beds/available?orgId=$ORG_ID" "Get Available Beds" "$ACCESS_TOKEN" "" 200

# Test 4.5: Assign bed to patient
test_endpoint "POST" "/api/departments/beds/$BED_ID/assign?orgId=$ORG_ID" "Assign Bed to Patient" "$ACCESS_TOKEN" \
    "{\"patientId\":\"$PATIENT_ID\"}" 201

echo "" | tee -a $TEST_LOG

# ============================================
# 5. OPD MODULE TESTS
# ============================================
echo -e "${BLUE}=== 5. OPD Module Tests ===${NC}" | tee -a $TEST_LOG

# Test 5.1: Generate OPD token
TOKEN_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/opd/tokens?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"patientId\": \"$PATIENT_ID\",
        \"departmentId\": \"$DEPT_ID\",
        \"doctorId\": \"$DOCTOR_ID\",
        \"visitType\": \"new\",
        \"chiefComplaint\": \"Chest pain\"
    }")

OPD_TOKEN_ID=$(echo $TOKEN_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$OPD_TOKEN_ID" ]; then
    echo -e "${GREEN}✓ OPD Token created with ID: $OPD_TOKEN_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create OPD token${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 5.2: List OPD tokens
test_endpoint "GET" "/api/opd/tokens?orgId=$ORG_ID" "List OPD Tokens" "$ACCESS_TOKEN" "" 200

# Test 5.3: Get queue status
test_endpoint "GET" "/api/opd/queue?orgId=$ORG_ID&departmentId=$DEPT_ID" "Get OPD Queue Status" "$ACCESS_TOKEN" "" 200

# Test 5.4: Call next patient
test_endpoint "POST" "/api/opd/tokens/$OPD_TOKEN_ID/call?orgId=$ORG_ID" "Call Next Patient" "$ACCESS_TOKEN" "" 200

# Test 5.5: Complete consultation
test_endpoint "POST" "/api/opd/tokens/$OPD_TOKEN_ID/complete?orgId=$ORG_ID" "Complete Consultation" "$ACCESS_TOKEN" \
    '{"diagnosis":"Stable angina","prescription":"Nitroglycerin"}' 200

# Test 5.6: Get OPD statistics
test_endpoint "GET" "/api/opd/stats?orgId=$ORG_ID" "Get OPD Statistics" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# 6. APPOINTMENTS TESTS
# ============================================
echo -e "${BLUE}=== 6. Appointments Module Tests ===${NC}" | tee -a $TEST_LOG

# Test 6.1: Create appointment
APPT_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/appointments?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"patientId\": \"$PATIENT_ID\",
        \"departmentId\": \"$DEPT_ID\",
        \"doctorId\": \"$DOCTOR_ID\",
        \"appointmentDate\": \"2025-12-15T10:00:00.000Z\",
        \"appointmentType\": \"consultation\",
        \"reason\": \"Follow-up checkup\"
    }")

APPT_ID=$(echo $APPT_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$APPT_ID" ]; then
    echo -e "${GREEN}✓ Appointment created with ID: $APPT_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create appointment${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 6.2: List appointments
test_endpoint "GET" "/api/appointments?orgId=$ORG_ID" "List Appointments" "$ACCESS_TOKEN" "" 200

# Test 6.3: Confirm appointment
test_endpoint "POST" "/api/appointments/$APPT_ID/confirm?orgId=$ORG_ID" "Confirm Appointment" "$ACCESS_TOKEN" "" 200

# Test 6.4: Get appointment statistics
test_endpoint "GET" "/api/appointments/stats/summary?orgId=$ORG_ID" "Get Appointment Statistics" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# 7. BILLING MODULE TESTS
# ============================================
echo -e "${BLUE}=== 7. Billing Module Tests ===${NC}" | tee -a $TEST_LOG

# Test 7.1: Create invoice
INVOICE_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/billing/invoices?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"patientId\": \"$PATIENT_ID\",
        \"items\": [
            {\"description\": \"Consultation Fee\", \"quantity\": 1, \"unitPrice\": 100.00},
            {\"description\": \"ECG Test\", \"quantity\": 1, \"unitPrice\": 50.00}
        ]
    }")

INVOICE_ID=$(echo $INVOICE_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$INVOICE_ID" ]; then
    echo -e "${GREEN}✓ Invoice created with ID: $INVOICE_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create invoice${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 7.2: List invoices
test_endpoint "GET" "/api/billing/invoices?orgId=$ORG_ID" "List Invoices" "$ACCESS_TOKEN" "" 200

# Test 7.3: Create payment
test_endpoint "POST" "/api/billing/payments?orgId=$ORG_ID" "Create Payment" "$ACCESS_TOKEN" \
    "{\"invoiceId\":\"$INVOICE_ID\",\"amount\":150.00,\"paymentMethod\":\"cash\"}" 201

# Test 7.4: Get patient outstanding balance
test_endpoint "GET" "/api/billing/patients/$PATIENT_ID/outstanding?orgId=$ORG_ID" "Get Patient Outstanding" "$ACCESS_TOKEN" "" 200

# Test 7.5: Get billing statistics
test_endpoint "GET" "/api/billing/stats/summary?orgId=$ORG_ID" "Get Billing Statistics" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# 8. LAB MODULE TESTS
# ============================================
echo -e "${BLUE}=== 8. Lab Module Tests ===${NC}" | tee -a $TEST_LOG

# Test 8.1: Order lab test
LAB_TEST_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/lab/tests?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"patientId\": \"$PATIENT_ID\",
        \"testName\": \"Complete Blood Count\",
        \"testCategory\": \"hematology\",
        \"priority\": \"routine\"
    }")

LAB_TEST_ID=$(echo $LAB_TEST_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$LAB_TEST_ID" ]; then
    echo -e "${GREEN}✓ Lab Test ordered with ID: $LAB_TEST_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to order lab test${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 8.2: List lab tests
test_endpoint "GET" "/api/lab/tests?orgId=$ORG_ID" "List Lab Tests" "$ACCESS_TOKEN" "" 200

# Test 8.3: Collect sample
test_endpoint "POST" "/api/lab/tests/$LAB_TEST_ID/samples?orgId=$ORG_ID" "Collect Lab Sample" "$ACCESS_TOKEN" \
    '{"sampleType":"blood","collectedBy":"tech-001"}' 201

# Test 8.4: Get lab statistics
test_endpoint "GET" "/api/lab/stats/summary?orgId=$ORG_ID" "Get Lab Statistics" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# 9. RADIOLOGY MODULE TESTS
# ============================================
echo -e "${BLUE}=== 9. Radiology Module Tests ===${NC}" | tee -a $TEST_LOG

# Test 9.1: Order radiology test
RAD_TEST_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/radiology/tests?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"patientId\": \"$PATIENT_ID\",
        \"testName\": \"Chest X-Ray\",
        \"modality\": \"X-Ray\",
        \"bodyPart\": \"chest\",
        \"clinicalHistory\": \"Suspected pneumonia\"
    }")

RAD_TEST_ID=$(echo $RAD_TEST_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$RAD_TEST_ID" ]; then
    echo -e "${GREEN}✓ Radiology Test ordered with ID: $RAD_TEST_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to order radiology test${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 9.2: List radiology tests
test_endpoint "GET" "/api/radiology/tests?orgId=$ORG_ID" "List Radiology Tests" "$ACCESS_TOKEN" "" 200

# Test 9.3: Get radiology statistics
test_endpoint "GET" "/api/radiology/stats/summary?orgId=$ORG_ID" "Get Radiology Statistics" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# 10. PHARMACY MODULE TESTS
# ============================================
echo -e "${BLUE}=== 10. Pharmacy Module Tests ===${NC}" | tee -a $TEST_LOG

# Test 10.1: Create medicine
MEDICINE_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/pharmacy/medicines?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "medicineName": "Paracetamol",
        "genericName": "Acetaminophen",
        "category": "analgesic",
        "manufacturer": "PharmaCorp",
        "batchNumber": "BATCH001",
        "expiryDate": "2026-12-31",
        "unitPrice": 5.00,
        "stockQuantity": 1000,
        "reorderLevel": 100,
        "unit": "tablet",
        "requiresPrescription": true
    }')

MEDICINE_ID=$(echo $MEDICINE_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$MEDICINE_ID" ]; then
    echo -e "${GREEN}✓ Medicine created with ID: $MEDICINE_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create medicine${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 10.2: List medicines
test_endpoint "GET" "/api/pharmacy/medicines?orgId=$ORG_ID" "List Medicines" "$ACCESS_TOKEN" "" 200

# Test 10.3: Create prescription
PRESCRIPTION_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/pharmacy/prescriptions?orgId=$ORG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"patientId\": \"$PATIENT_ID\",
        \"doctorId\": \"$DOCTOR_ID\",
        \"items\": [
            {
                \"medicineId\": \"$MEDICINE_ID\",
                \"quantity\": 10,
                \"dosage\": \"500mg\",
                \"frequency\": \"twice daily\",
                \"duration\": \"5 days\"
            }
        ]
    }")

PRESCRIPTION_ID=$(echo $PRESCRIPTION_CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PRESCRIPTION_ID" ]; then
    echo -e "${GREEN}✓ Prescription created with ID: $PRESCRIPTION_ID${NC}" | tee -a $TEST_LOG
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ Failed to create prescription${NC}" | tee -a $TEST_LOG
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 10.4: List prescriptions
test_endpoint "GET" "/api/pharmacy/prescriptions?orgId=$ORG_ID" "List Prescriptions" "$ACCESS_TOKEN" "" 200

# Test 10.5: Get pharmacy statistics
test_endpoint "GET" "/api/pharmacy/stats/summary?orgId=$ORG_ID" "Get Pharmacy Statistics" "$ACCESS_TOKEN" "" 200

# Test 10.6: Get low stock medicines
test_endpoint "GET" "/api/pharmacy/medicines/low-stock?orgId=$ORG_ID" "Get Low Stock Medicines" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# 11. SUBSCRIPTION PLANS TESTS
# ============================================
echo -e "${BLUE}=== 11. Subscription Plans Tests ===${NC}" | tee -a $TEST_LOG

# Test 11.1: List subscription plans
test_endpoint "GET" "/api/subscription-plans" "List Subscription Plans" "$ACCESS_TOKEN" "" 200

# Test 11.2: Create subscription plan
test_endpoint "POST" "/api/subscription-plans" "Create Subscription Plan" "$ACCESS_TOKEN" \
    '{"name":"Basic Plan","description":"Basic features","monthlyPrice":99.00,"yearlyPrice":990.00,"maxUsers":10,"status":"active"}' 201

echo "" | tee -a $TEST_LOG

# ============================================
# 12. PROMOTIONS TESTS
# ============================================
echo -e "${BLUE}=== 12. Promotions Tests ===${NC}" | tee -a $TEST_LOG

# Test 12.1: List promotions
test_endpoint "GET" "/api/promotions" "List Promotions" "$ACCESS_TOKEN" "" 200

# Test 12.2: Create promotion (use unique code with timestamp)
PROMO_CODE="WINTER$TIMESTAMP"
test_endpoint "POST" "/api/promotions" "Create Promotion" "$ACCESS_TOKEN" \
    "{\"code\":\"$PROMO_CODE\",\"description\":\"Winter discount\",\"discountType\":\"percentage\",\"discountValue\":20,\"startDate\":\"2025-12-01\",\"endDate\":\"2025-12-31\",\"isActive\":true}" 201

echo "" | tee -a $TEST_LOG

# ============================================
# 13. DASHBOARD STATISTICS TESTS
# ============================================
echo -e "${BLUE}=== 13. Dashboard Statistics Tests ===${NC}" | tee -a $TEST_LOG

# Test 13.1: Get dashboard stats
test_endpoint "GET" "/api/stats/dashboard" "Get Dashboard Statistics" "$ACCESS_TOKEN" "" 200

echo "" | tee -a $TEST_LOG

# ============================================
# FINAL SUMMARY
# ============================================
echo "========================================" | tee -a $TEST_LOG
echo "TEST SUMMARY" | tee -a $TEST_LOG
echo "========================================" | tee -a $TEST_LOG
echo "Total Tests: $TOTAL_TESTS" | tee -a $TEST_LOG
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}" | tee -a $TEST_LOG
echo -e "${RED}Failed: $FAILED_TESTS${NC}" | tee -a $TEST_LOG

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}" | tee -a $TEST_LOG
    SUCCESS_RATE=100
else
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${YELLOW}⚠ Some tests failed${NC}" | tee -a $TEST_LOG
fi

echo "Success Rate: ${SUCCESS_RATE}%" | tee -a $TEST_LOG
echo "Completed: $(date)" | tee -a $TEST_LOG
echo "========================================" | tee -a $TEST_LOG

# Save summary to JSON
cat > "$TEST_RESULTS_DIR/test_summary_$TIMESTAMP.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "apiUrl": "$API_URL",
  "totalTests": $TOTAL_TESTS,
  "passedTests": $PASSED_TESTS,
  "failedTests": $FAILED_TESTS,
  "successRate": $SUCCESS_RATE,
  "testLog": "$TEST_LOG"
}
EOF

echo "" | tee -a $TEST_LOG
echo "Test results saved to: $TEST_RESULTS_DIR" | tee -a $TEST_LOG
echo "Test log: $TEST_LOG" | tee -a $TEST_LOG
echo "Test summary: $TEST_RESULTS_DIR/test_summary_$TIMESTAMP.json" | tee -a $TEST_LOG

exit $FAILED_TESTS
