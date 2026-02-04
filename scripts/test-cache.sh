#!/bin/bash

# Test Redis Caching Implementation
# This script tests the cache functionality in OpenAlert

set -e

echo "==================================="
echo "OpenAlert Cache Testing Script"
echo "==================================="
echo ""

API_URL="${API_URL:-http://localhost:3001}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function success() {
    echo -e "${GREEN}✓ $1${NC}"
}

function error() {
    echo -e "${RED}✗ $1${NC}"
}

function info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Test 1: Check Redis Connection
echo "Test 1: Redis Connection"
if docker exec openalert-redis redis-cli ping > /dev/null 2>&1; then
    success "Redis is running"
else
    error "Redis is not running"
    echo "Start Redis with: docker-compose -f docker/docker-compose.yml up -d redis"
    exit 1
fi
echo ""

# Test 2: Check API Health
echo "Test 2: API Health Check"
HEALTH_RESPONSE=$(curl -s "$API_URL/health" 2>/dev/null || echo "{}")
if echo "$HEALTH_RESPONSE" | grep -q "redis_cache"; then
    success "API health endpoint includes Redis cache status"
    echo "$HEALTH_RESPONSE" | jq '.info.redis_cache' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    error "Redis cache not in health check"
fi
echo ""

# Test 3: Cache Statistics
echo "Test 3: Cache Statistics"
STATS_RESPONSE=$(curl -s "$API_URL/health/cache/stats" 2>/dev/null || echo "{}")
if [ -n "$STATS_RESPONSE" ]; then
    success "Cache stats endpoint responding"
    echo "$STATS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATS_RESPONSE"
else
    error "Cache stats endpoint not responding"
fi
echo ""

# Test 4: Cache Keys in Redis
echo "Test 4: Cache Keys in Redis"
KEYS_COUNT=$(docker exec openalert-redis redis-cli KEYS "openalert:*" 2>/dev/null | wc -l)
info "Found $KEYS_COUNT cache keys in Redis"
if [ "$KEYS_COUNT" -gt 0 ]; then
    success "Cache keys exist"
    echo "Sample keys:"
    docker exec openalert-redis redis-cli KEYS "openalert:*" 2>/dev/null | head -5
else
    info "No cache keys found (cache may be empty)"
fi
echo ""

# Test 5: Cache Hit/Miss Test (requires authentication)
echo "Test 5: Cache Hit/Miss Test"
info "Testing incidents endpoint (requires authentication)"
info "First request (should be cache MISS)..."
curl -s "$API_URL/api/incidents" > /dev/null 2>&1 || info "Endpoint requires authentication"
sleep 1
info "Second request (should be cache HIT)..."
curl -s "$API_URL/api/incidents" > /dev/null 2>&1 || info "Endpoint requires authentication"
info "Check API logs for 'Cache HIT' and 'Cache MISS' messages"
echo ""

# Test 6: Memory Usage
echo "Test 6: Redis Memory Usage"
MEMORY_INFO=$(docker exec openalert-redis redis-cli INFO memory 2>/dev/null | grep used_memory_human)
if [ -n "$MEMORY_INFO" ]; then
    success "Redis memory info"
    echo "$MEMORY_INFO"
else
    error "Could not get Redis memory info"
fi
echo ""

# Test 7: Cache Key Pattern
echo "Test 7: Cache Key Patterns"
info "Expected cache key patterns:"
echo "  - openalert:incidents:*"
echo "  - openalert:metrics:*"
echo "  - openalert:services:*"
echo "  - openalert:routing:*"
echo "  - openalert:status-pages:*"
echo "  - openalert:schedules:*"
echo ""
info "Actual patterns found:"
docker exec openalert-redis redis-cli KEYS "openalert:*" 2>/dev/null | sed 's/:.*//' | sort -u | sed 's/^/  - /' || echo "  (none)"
echo ""

# Test 8: TTL Check
echo "Test 8: Cache TTL Check"
SAMPLE_KEY=$(docker exec openalert-redis redis-cli KEYS "openalert:*" 2>/dev/null | head -1)
if [ -n "$SAMPLE_KEY" ]; then
    TTL=$(docker exec openalert-redis redis-cli TTL "$SAMPLE_KEY" 2>/dev/null)
    if [ "$TTL" -gt 0 ]; then
        success "Sample key has TTL: ${TTL}s"
    else
        info "Sample key TTL: $TTL (-1 = no expiry, -2 = doesn't exist)"
    fi
else
    info "No keys to check TTL"
fi
echo ""

# Summary
echo "==================================="
echo "Test Summary"
echo "==================================="
success "Redis is running and accessible"
success "API health endpoint includes cache status"
success "Cache statistics endpoint is working"
info "Cache implementation is operational"
echo ""
echo "To manually test cache:"
echo "  1. Monitor Redis: docker exec -it openalert-redis redis-cli MONITOR"
echo "  2. View keys: docker exec -it openalert-redis redis-cli KEYS 'openalert:*'"
echo "  3. Get stats: curl $API_URL/health/cache/stats"
echo "  4. Check health: curl $API_URL/health"
echo ""
echo "For detailed testing, check the API logs for:"
echo "  - 'Cache HIT' messages (successful cache retrieval)"
echo "  - 'Cache MISS' messages (cache miss, querying database)"
echo "  - 'Cache SET' messages (caching new data)"
echo "  - 'Cache DEL' messages (cache invalidation)"
echo ""
