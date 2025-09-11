#!/usr/bin/env node

/**
 * Test para verificar el manejo correcto del error "database not found"
 * Este test verifica que cuando no existe la base de datos SQLite,
 * las funciones devuelvan errores claros en lugar de fallar con SQLITE_CANTOPEN
 */

import fs from 'fs';

console.log('🧪 Testing database error handling...\n');

let testsPassedCount = 0;
let testsFailedCount = 0;

function testPassed(name) {
    console.log(`✅ PASS: ${name}`);
    testsPassedCount++;
}

function testFailed(name, details) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Details: ${details}`);
    testsFailedCount++;
}

function testSkipped(name, reason) {
    console.log(`⏭️  SKIP: ${name}`);
    console.log(`   Reason: ${reason}`);
}

// Try to import service functions, handle native dependency errors gracefully
let getOverview, searchCode;
try {
    const serviceModule = await import('../src/service.js');
    getOverview = serviceModule.getOverview;
    searchCode = serviceModule.searchCode;
} catch (error) {
    if (error.message.includes('bindings') || error.message.includes('sqlite3')) {
        console.log('⚠️  Native dependencies (sqlite3) not available in this environment');
        console.log('   This is expected in some CI/CD environments');
        console.log('   Skipping database error handling tests...\n');

        testSkipped('getOverview handles missing database correctly', 'sqlite3 bindings not available');
        testSkipped('searchCode handles missing database correctly', 'sqlite3 bindings not available');
        testSkipped('searchCode with empty query handles missing database correctly', 'sqlite3 bindings not available');

        console.log('\n📊 Test Summary:');
        console.log(`✅ Tests passed: ${testsPassedCount}`);
        console.log(`❌ Tests failed: ${testsFailedCount}`);
        console.log(`⏭️  Tests skipped: 3 (due to environment limitations)`);
        console.log('\n🎉 All available tests completed successfully!');
        process.exit(0);
    } else {
        console.error('❌ Unexpected error importing service module:', error.message);
        process.exit(1);
    }
}

// Create temporary directory for tests
const testDir = '/tmp/pampa-test-no-db';
if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

// Test 1: getOverview sin base de datos
console.log('📊 Test 1: getOverview should handle missing database gracefully');
try {
    const result = await getOverview(10, testDir);

    if (!result.success && result.error === 'database_not_found') {
        testPassed('getOverview handles missing database correctly');
        console.log(`   Message: ${result.message}`);
        console.log(`   Suggestion: ${result.suggestion}`);
    } else {
        testFailed('getOverview error handling', `Expected database_not_found error, got: ${JSON.stringify(result)}`);
    }
} catch (error) {
    testFailed('getOverview exception handling', `Unexpected exception: ${error.message}`);
}

console.log('');

// Test 2: searchCode sin base de datos
console.log('🔍 Test 2: searchCode should handle missing database gracefully');
try {
    const result = await searchCode('test query', 10, 'auto', testDir);

    if (!result.success && result.error === 'database_not_found') {
        testPassed('searchCode handles missing database correctly');
        console.log(`   Message: ${result.message}`);
        console.log(`   Suggestion: ${result.suggestion}`);
    } else {
        testFailed('searchCode error handling', `Expected database_not_found error, got: ${JSON.stringify(result)}`);
    }
} catch (error) {
    testFailed('searchCode exception handling', `Unexpected exception: ${error.message}`);
}

console.log('');

// Test 3: searchCode con query vacía sin base de datos (debería usar getOverview)
console.log('🔍 Test 3: searchCode with empty query should handle missing database gracefully');
try {
    const result = await searchCode('', 10, 'auto', testDir);

    if (!result.success && result.error === 'database_not_found') {
        testPassed('searchCode with empty query handles missing database correctly');
        console.log(`   Message: ${result.message}`);
    } else {
        testFailed('searchCode empty query error handling', `Expected database_not_found error, got: ${JSON.stringify(result)}`);
    }
} catch (error) {
    testFailed('searchCode empty query exception handling', `Unexpected exception: ${error.message}`);
}

// Cleanup
console.log('\n🧹 Cleaning up test directory...');
if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
}

// Summary
console.log('\n📊 Test Summary:');
console.log(`✅ Tests passed: ${testsPassedCount}`);
console.log(`❌ Tests failed: ${testsFailedCount}`);

if (testsFailedCount > 0) {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
} else {
    console.log('\n🎉 All database error handling tests passed!');
    process.exit(0);
} 