#!/bin/bash
# =============================================================================
# Test script for rollback functionality
# This script helps test the rollback mechanism locally
# =============================================================================

set -e

echo "🧪 ROLLBACK TEST SCRIPT"
echo "======================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# Option 1: Test with failing healthcheck
# =============================================================================
test_healthcheck_failure() {
    echo -e "${YELLOW}[TEST 1] Healthcheck Failure Rollback${NC}"
    echo "This test will:"
    echo "1. Deploy a working version (first)"
    echo "2. Deploy a new version that doesn't respond to /health"
    echo "3. Verify rollback happens"
    echo ""
    
    # Create a broken Dockerfile that starts but doesn't serve HTTP
    cat > /tmp/broken-app-Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
RUN echo "#!/bin/bash" > /app/run.sh && \
    echo "echo 'App started but no HTTP server'" && \
    echo "sleep 999999" >> /app/run.sh && \
    chmod +x /app/run.sh
CMD ["/app/run.sh"]
EOF
    
    echo -e "${GREEN}✓ Broken Dockerfile created at /tmp/broken-app-Dockerfile${NC}"
    echo "  You can manually build this and test healthcheck failure"
    echo ""
    echo "  docker build -t broken-app:test -f /tmp/broken-app-Dockerfile ."
    echo ""
}

# =============================================================================
# Option 2: Test with Docker container state
# =============================================================================
test_docker_state() {
    echo -e "${YELLOW}[TEST 2] Docker State Management${NC}"
    echo "Check if containers are properly tracked:"
    echo ""
    
    # List current containers
    echo "Current running containers:"
    docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Status}}"
    echo ""
    
    # Check if test images exist
    echo "Test images available:"
    docker images | grep -E "test|rollback" || echo "No test images found yet"
    echo ""
}

# =============================================================================
# Option 3: Run pytest unit tests
# =============================================================================
test_unit_tests() {
    echo -e "${YELLOW}[TEST 3] Running Unit Tests${NC}"
    echo "Running rollback unit tests..."
    echo ""
    
    cd "$(dirname "$0")" || exit 1
    
    if command -v pytest &> /dev/null; then
        pytest tests/test_rollback.py -v --tb=short
    else
        echo -e "${RED}✗ pytest not found. Install with: pip install pytest${NC}"
        return 1
    fi
}

# =============================================================================
# Option 4: Full integration test with real pipeline
# =============================================================================
test_full_integration() {
    echo -e "${YELLOW}[TEST 4] Full Integration Test${NC}"
    echo "This requires a running backend and test repository."
    echo ""
    echo "Steps:"
    echo "1. Start backend: python -m uvicorn app.main:app --reload --port 8000"
    echo "2. Create a pipeline via API:"
    echo "   curl -X POST http://localhost:8000/api/pipelines \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"name\": \"rollback-test\", \"repo_url\": \"<your-test-repo>\", \"branch\": \"main\"}'"
    echo ""
    echo "3. Run the pipeline:"
    echo "   curl -X POST http://localhost:8000/api/pipelines/1/run"
    echo ""
    echo "4. Monitor logs:"
    echo "   tail -f ~/.cicd/workspaces/rollback-test/logs/rollback-test.log"
    echo ""
    echo "5. Watch SSE events in browser:"
    echo "   curl http://localhost:8000/api/runs/1/stream"
    echo ""
}

# =============================================================================
# Manual test: Create and break a container
# =============================================================================
test_manual_docker() {
    echo -e "${YELLOW}[TEST 5] Manual Docker Rollback Test${NC}"
    echo "You can manually test rollback with these commands:"
    echo ""
    
    cat << 'EOF'
# 1. Create a "working" version
docker run -d --name test-app -p 8080:8080 \
  --health-cmd='curl -f http://localhost:8080/health || exit 1' \
  --health-interval=2s \
  python:3.11 sleep 999999
echo "Container created: test-app"

# 2. Check it's running
docker ps --filter "name=test-app"

# 3. Save container state (simulating _save_previous_state)
CONTAINER_ID=$(docker ps -q --filter "name=^test-app$")
IMAGE=$(docker inspect --format='{{.Image}}' "$CONTAINER_ID")
echo "Saved state: Container=$CONTAINER_ID, Image=$IMAGE"

# 4. Stop and replace with broken version
docker stop test-app
docker rm test-app
docker run -d --name test-app \
  python:3.11 sh -c "exit 1"  # Will fail immediately

# 5. Trigger rollback (restart old container)
# In the real code, this is done by _rollback_to_previous()
docker start "$CONTAINER_ID"

# 6. Verify rollback worked
docker ps --filter "name=test-app"
EOF
    echo ""
}

# =============================================================================
# Show logs function
# =============================================================================
show_logs() {
    echo -e "${YELLOW}View Pipeline Logs${NC}"
    LOG_PATH="$HOME/.cicd/workspaces"
    
    if [ -d "$LOG_PATH" ]; then
        echo "Available logs:"
        find "$LOG_PATH" -name "*.log" -type f 2>/dev/null | while read -r logfile; do
            echo "  → $logfile"
        done
        echo ""
        
        # Show latest log if exists
        latest_log=$(find "$LOG_PATH" -name "*.log" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
        if [ -n "$latest_log" ]; then
            echo "Latest log content:"
            echo "─────────────────"
            tail -50 "$latest_log"
        fi
    else
        echo "No logs found yet. Run a pipeline first."
    fi
    echo ""
}

# =============================================================================
# Main menu
# =============================================================================
if [ $# -eq 0 ]; then
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  1   - Test healthcheck failure scenario"
    echo "  2   - Show Docker state and containers"
    echo "  3   - Run unit tests (pytest)"
    echo "  4   - Show full integration test steps"
    echo "  5   - Show manual Docker rollback test"
    echo "  logs - View pipeline logs"
    echo "  all  - Run all tests"
    echo ""
    exit 0
fi

case "$1" in
    1)
        test_healthcheck_failure
        ;;
    2)
        test_docker_state
        ;;
    3)
        test_unit_tests
        ;;
    4)
        test_full_integration
        ;;
    5)
        test_manual_docker
        ;;
    logs)
        show_logs
        ;;
    all)
        test_healthcheck_failure
        echo ""
        test_docker_state
        echo ""
        test_unit_tests
        echo ""
        test_full_integration
        echo ""
        test_manual_docker
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✓ Test completed${NC}"
