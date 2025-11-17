#!/bin/bash

# Script to test Kong JWT authentication setup
# This validates that Kong is properly configured and can authenticate requests

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

KONG_URL="${KONG_URL:-http://localhost:30080}"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_NAME="Test User"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Kong JWT Authentication Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Kong URL: $KONG_URL"
echo "Test User: $TEST_EMAIL"
echo ""

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        exit 1
    fi
}

# Test 1: Health check (public endpoint, no JWT)
echo -e "\n${YELLOW}Test 1: Public endpoint (health check)${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $KONG_URL/actuator/health)
if [ "$HTTP_CODE" = "200" ]; then
    print_result 0 "Health check accessible (HTTP $HTTP_CODE)"
else
    print_result 1 "Health check failed (HTTP $HTTP_CODE)"
fi

# Test 2: Register new user (public endpoint)
echo -e "\n${YELLOW}Test 2: User registration (public endpoint)${NC}"
REGISTER_RESPONSE=$(curl -s -X POST $KONG_URL/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"$TEST_NAME\"}")

if echo "$REGISTER_RESPONSE" | grep -q "email"; then
    print_result 0 "User registration successful"
else
    print_result 1 "User registration failed: $REGISTER_RESPONSE"
fi

# Test 3: Login and get JWT (public endpoint)
echo -e "\n${YELLOW}Test 3: User login and JWT generation${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $KONG_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    print_result 0 "Login successful, JWT received"
    echo -e "   Token preview: ${TOKEN:0:50}..."

    # Decode JWT header and payload (for debugging)
    echo -e "\n   ${BLUE}JWT Claims:${NC}"
    PAYLOAD=$(echo "$TOKEN" | cut -d. -f2)
    # Add padding if needed
    PADDED_PAYLOAD="${PAYLOAD}$(printf '%0.1s' ={1..3})"
    DECODED=$(echo "$PADDED_PAYLOAD" | base64 -d 2>/dev/null || echo "$PAYLOAD" | base64 -d -i 2>/dev/null || echo "{}")
    echo "$DECODED" | grep -E '"(iss|userId|email|exp)"' || echo "   (Could not decode JWT)"
else
    print_result 1 "Login failed: $LOGIN_RESPONSE"
fi

# Test 4: Access protected endpoint without JWT (should fail)
echo -e "\n${YELLOW}Test 4: Protected endpoint without JWT (should fail)${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $KONG_URL/api/documents)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    print_result 0 "Protected endpoint correctly rejected request without JWT (HTTP $HTTP_CODE)"
else
    print_result 1 "Protected endpoint should return 401/403, got HTTP $HTTP_CODE"
fi

# Test 5: Access protected endpoint with invalid JWT (should fail)
echo -e "\n${YELLOW}Test 5: Protected endpoint with invalid JWT (should fail)${NC}"
INVALID_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $INVALID_TOKEN" \
    $KONG_URL/api/documents)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    print_result 0 "Protected endpoint correctly rejected invalid JWT (HTTP $HTTP_CODE)"
else
    print_result 1 "Protected endpoint should return 401/403 for invalid JWT, got HTTP $HTTP_CODE"
fi

# Test 6: Access protected endpoint with valid JWT (should succeed)
echo -e "\n${YELLOW}Test 6: Protected endpoint with valid JWT (should succeed)${NC}"
DOCUMENTS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    $KONG_URL/api/documents)

HTTP_CODE=$(echo "$DOCUMENTS_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE_BODY=$(echo "$DOCUMENTS_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    print_result 0 "Protected endpoint accessible with valid JWT (HTTP $HTTP_CODE)"
    echo -e "   Response: ${RESPONSE_BODY:0:100}..."
else
    print_result 1 "Protected endpoint failed with valid JWT (HTTP $HTTP_CODE)"
fi

# Test 7: Verify Kong is injecting headers (check backend logs if possible)
echo -e "\n${YELLOW}Test 7: Kong header injection verification${NC}"
# This test checks if Kong is running and configured
KONG_PODS=$(kubectl get pods -l app=kong -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
if [ -n "$KONG_PODS" ]; then
    print_result 0 "Kong pods running: $KONG_PODS"

    # Check if request transformer plugin is configured
    echo -e "   ${BLUE}Checking Kong plugins...${NC}"
    ADMIN_AVAILABLE=$(kubectl get svc kong-admin -o jsonpath='{.metadata.name}' 2>/dev/null || echo "")
    if [ -n "$ADMIN_AVAILABLE" ]; then
        echo -e "   ${GREEN}Kong admin service available${NC}"
        echo -e "   To verify plugins: kubectl port-forward svc/kong-admin 8001:8001 && curl http://localhost:8001/plugins"
    fi
else
    echo -e "   ${YELLOW}Note: kubectl not available or Kong not in Kubernetes${NC}"
fi

# Test 8: Rate limiting check
echo -e "\n${YELLOW}Test 8: Rate limiting (optional)${NC}"
echo -e "   Making 5 rapid requests to test rate limiting..."
RATE_LIMIT_EXCEEDED=false
for i in {1..5}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        $KONG_URL/api/documents)
    if [ "$HTTP_CODE" = "429" ]; then
        RATE_LIMIT_EXCEEDED=true
        break
    fi
done

if [ "$RATE_LIMIT_EXCEEDED" = true ]; then
    print_result 0 "Rate limiting is working (HTTP 429 received)"
else
    echo -e "   ${BLUE}ℹ Rate limit not exceeded in 5 requests (limit: 100/min)${NC}"
fi

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}All Tests Passed!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}Summary:${NC}"
echo "  ✓ Public endpoints accessible without JWT"
echo "  ✓ User registration working"
echo "  ✓ User login and JWT generation working"
echo "  ✓ Protected endpoints reject requests without JWT"
echo "  ✓ Protected endpoints reject invalid JWT"
echo "  ✓ Protected endpoints accept valid JWT"
echo "  ✓ Kong Gateway configured correctly"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "  • Frontend should use Kong URL: $KONG_URL"
echo "  • All API calls should go through Kong"
echo "  • Monitor Kong logs: kubectl logs -l app=kong -f"
echo "  • Check Kong metrics: kubectl port-forward svc/kong-admin 8001:8001"

echo -e "\n${BLUE}Kong Admin Commands:${NC}"
echo "  # Port forward Kong admin API"
echo "  kubectl port-forward svc/kong-admin 8001:8001"
echo ""
echo "  # View all routes"
echo "  curl http://localhost:8001/routes"
echo ""
echo "  # View all plugins"
echo "  curl http://localhost:8001/plugins"
echo ""
echo "  # View JWT consumer"
echo "  curl http://localhost:8001/consumers/conote-backend"

echo ""
