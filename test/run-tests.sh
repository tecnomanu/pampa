#!/bin/bash

echo "🧪 Running PAMPA test suite..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Determine the correct test directory
if [ -f "test/pampa-diagnostics.js" ]; then
    TEST_DIR="test"
elif [ -f "pampa-diagnostics.js" ]; then
    TEST_DIR="."
else
    echo -e "${RED}❌ Error: Cannot find test files${NC}"
    exit 1
fi

echo "🔍 Test directory: $TEST_DIR"

# Function to run a test
run_test() {
    local test_file=$1
    local test_name=$2
    
    echo -e "${YELLOW}Running${NC} $test_name..."
    
    if node "$TEST_DIR/$test_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC} $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} $test_name"
        echo "   Error details:"
        node "$TEST_DIR/$test_file" 2>&1 | head -5 | sed 's/^/   /'
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Run diagnostics first
echo -e "${YELLOW}🔍 Running diagnostics...${NC}"
node "$TEST_DIR/pampa-diagnostics.js"
echo ""

# Run MCP server test
run_test "test-mcp.js" "MCP Server Basic Test"

# Run search code test
run_test "test-search-code.js" "Search Code Validation Test"

# Run database error handling test  
run_test "test-database-errors.js" "Database Error Handling Test"

echo -e "${YELLOW}Running Scoped Search Filters Test...${NC}"
if TEST_OUTPUT=$(node --test "$TEST_DIR/search_scoped.test.js" 2>&1); then
    echo -e "${GREEN}✅ PASS${NC} Scoped Search Filters Test"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} Scoped Search Filters Test"
    echo "   Error details:"
    echo "$TEST_OUTPUT" | head -5 | sed 's/^/   /'
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${YELLOW}Running Hybrid Search Fusion Test...${NC}"
if TEST_OUTPUT=$(node --test "$TEST_DIR/search_hybrid.test.js" 2>&1); then
    echo -e "${GREEN}✅ PASS${NC} Hybrid Search Fusion Test"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} Hybrid Search Fusion Test"
    echo "   Error details:"
    echo "$TEST_OUTPUT" | head -5 | sed 's/^/   /'
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${YELLOW}Running Cross-Encoder Reranker Test...${NC}"
if TEST_OUTPUT=$(node --test "$TEST_DIR/reranker.test.js" 2>&1); then
    echo -e "${GREEN}✅ PASS${NC} Cross-Encoder Reranker Test"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} Cross-Encoder Reranker Test"
    echo "   Error details:"
    echo "$TEST_OUTPUT" | head -5 | sed 's/^/   /'
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${YELLOW}Running Symbol Boost Ranking Test...${NC}"
if TEST_OUTPUT=$(node --test "$TEST_DIR/symbol_boost.test.js" 2>&1); then
    echo -e "${GREEN}✅ PASS${NC} Symbol Boost Ranking Test"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} Symbol Boost Ranking Test"
    echo "   Error details:"
    echo "$TEST_OUTPUT" | head -5 | sed 's/^/   /'
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${YELLOW}Running Watcher & Merkle Incremental Test...${NC}"
if TEST_OUTPUT=$(node --test "$TEST_DIR/watch_merkle.test.js" 2>&1); then
    echo -e "${GREEN}✅ PASS${NC} Watcher & Merkle Incremental Test"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} Watcher & Merkle Incremental Test"
    echo "   Error details:"
    echo "$TEST_OUTPUT" | head -5 | sed 's/^/   /'
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${YELLOW}Running Context Packs Test...${NC}"
if TEST_OUTPUT=$(node --test "$TEST_DIR/context_packs.test.js" 2>&1); then
    echo -e "${GREEN}✅ PASS${NC} Context Packs Test"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} Context Packs Test"
    echo "   Error details:"
    echo "$TEST_OUTPUT" | head -5 | sed 's/^/   /'
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${YELLOW}Running Codemap Extension Test...${NC}"
if TEST_OUTPUT=$(node --test "$TEST_DIR/codemap_extension.test.js" 2>&1); then
    echo -e "${GREEN}✅ PASS${NC} Codemap Extension Test"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} Codemap Extension Test"
    echo "   Error details:"
    echo "$TEST_OUTPUT" | head -5 | sed 's/^/   /'
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${YELLOW}Running Chunk Encryption Test...${NC}"
if TEST_OUTPUT=$(node --test "$TEST_DIR/encryption.test.js" 2>&1); then
    echo -e "${GREEN}✅ PASS${NC} Chunk Encryption Test"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} Chunk Encryption Test"
    echo "   Error details:"
    echo "$TEST_OUTPUT" | head -5 | sed 's/^/   /'
    ((TESTS_FAILED++))
fi
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}Tests passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Some tests failed!${NC}"
    exit 1
fi 