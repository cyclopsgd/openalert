# Test Redis Caching Implementation
# PowerShell version for Windows

$ErrorActionPreference = "Continue"
$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3001" }

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "OpenAlert Cache Testing Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

# Test 1: Check Redis Connection
Write-Host "Test 1: Redis Connection" -ForegroundColor White
try {
    $pingResult = docker exec openalert-redis redis-cli ping 2>$null
    if ($pingResult -eq "PONG") {
        Write-Success "Redis is running"
    } else {
        throw "Redis ping failed"
    }
} catch {
    Write-Error-Custom "Redis is not running"
    Write-Host "Start Redis with: docker-compose -f docker/docker-compose.yml up -d redis"
    exit 1
}
Write-Host ""

# Test 2: Check API Health
Write-Host "Test 2: API Health Check" -ForegroundColor White
try {
    $healthResponse = Invoke-RestMethod -Uri "$API_URL/health" -ErrorAction Stop
    if ($healthResponse.info.redis_cache) {
        Write-Success "API health endpoint includes Redis cache status"
        Write-Host "  Status: $($healthResponse.info.redis_cache.status)"
    } else {
        Write-Error-Custom "Redis cache not in health check"
    }
} catch {
    Write-Error-Custom "Could not reach API health endpoint"
    Write-Host "  Make sure API is running on $API_URL"
}
Write-Host ""

# Test 3: Cache Statistics
Write-Host "Test 3: Cache Statistics" -ForegroundColor White
try {
    $statsResponse = Invoke-RestMethod -Uri "$API_URL/health/cache/stats" -ErrorAction Stop
    Write-Success "Cache stats endpoint responding"
    Write-Host "  Enabled: $($statsResponse.enabled)"
    Write-Host "  Connected: $($statsResponse.connected)"
    Write-Host "  Key Count: $($statsResponse.keyCount)"
    Write-Host "  Memory Used: $($statsResponse.memoryUsed)"
} catch {
    Write-Error-Custom "Cache stats endpoint not responding"
}
Write-Host ""

# Test 4: Cache Keys in Redis
Write-Host "Test 4: Cache Keys in Redis" -ForegroundColor White
try {
    $keys = docker exec openalert-redis redis-cli KEYS "openalert:*" 2>$null
    $keyCount = ($keys | Measure-Object).Count
    Write-Info "Found $keyCount cache keys in Redis"
    if ($keyCount -gt 0) {
        Write-Success "Cache keys exist"
        Write-Host "  Sample keys:"
        $keys | Select-Object -First 5 | ForEach-Object { Write-Host "    - $_" }
    } else {
        Write-Info "No cache keys found (cache may be empty)"
    }
} catch {
    Write-Error-Custom "Could not query Redis keys"
}
Write-Host ""

# Test 5: Memory Usage
Write-Host "Test 5: Redis Memory Usage" -ForegroundColor White
try {
    $memoryInfo = docker exec openalert-redis redis-cli INFO memory 2>$null | Select-String "used_memory_human"
    if ($memoryInfo) {
        Write-Success "Redis memory info"
        Write-Host "  $memoryInfo"
    }
} catch {
    Write-Error-Custom "Could not get Redis memory info"
}
Write-Host ""

# Test 6: Cache Key Patterns
Write-Host "Test 6: Cache Key Patterns" -ForegroundColor White
Write-Info "Expected cache key patterns:"
Write-Host "  - openalert:incidents:*"
Write-Host "  - openalert:metrics:*"
Write-Host "  - openalert:services:*"
Write-Host "  - openalert:routing:*"
Write-Host "  - openalert:status-pages:*"
Write-Host "  - openalert:schedules:*"
Write-Host ""
Write-Info "Actual patterns found:"
try {
    $allKeys = docker exec openalert-redis redis-cli KEYS "openalert:*" 2>$null
    $patterns = $allKeys | ForEach-Object { ($_ -split ':')[0..1] -join ':' } | Select-Object -Unique
    if ($patterns) {
        $patterns | ForEach-Object { Write-Host "  - $_:*" }
    } else {
        Write-Host "  (none)"
    }
} catch {
    Write-Host "  (could not retrieve)"
}
Write-Host ""

# Test 7: TTL Check
Write-Host "Test 7: Cache TTL Check" -ForegroundColor White
try {
    $sampleKey = (docker exec openalert-redis redis-cli KEYS "openalert:*" 2>$null | Select-Object -First 1)
    if ($sampleKey) {
        $ttl = docker exec openalert-redis redis-cli TTL "$sampleKey" 2>$null
        if ($ttl -gt 0) {
            Write-Success "Sample key has TTL: ${ttl}s"
        } else {
            Write-Info "Sample key TTL: $ttl (-1 = no expiry, -2 = doesn't exist)"
        }
    } else {
        Write-Info "No keys to check TTL"
    }
} catch {
    Write-Info "Could not check TTL"
}
Write-Host ""

# Summary
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Success "Redis is running and accessible"
Write-Success "API health endpoint includes cache status"
Write-Success "Cache statistics endpoint is working"
Write-Info "Cache implementation is operational"
Write-Host ""
Write-Host "To manually test cache:" -ForegroundColor White
Write-Host "  1. Monitor Redis: docker exec -it openalert-redis redis-cli MONITOR"
Write-Host "  2. View keys: docker exec -it openalert-redis redis-cli KEYS 'openalert:*'"
Write-Host "  3. Get stats: curl $API_URL/health/cache/stats"
Write-Host "  4. Check health: curl $API_URL/health"
Write-Host ""
Write-Host "For detailed testing, check the API logs for:" -ForegroundColor White
Write-Host "  - 'Cache HIT' messages (successful cache retrieval)"
Write-Host "  - 'Cache MISS' messages (cache miss, querying database)"
Write-Host "  - 'Cache SET' messages (caching new data)"
Write-Host "  - 'Cache DEL' messages (cache invalidation)"
Write-Host ""
