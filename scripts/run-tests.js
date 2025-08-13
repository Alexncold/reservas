const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configuration
const CONFIG = {
  // Base URL to test against
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  
  // Test scenarios to run
  SCENARIOS: ['smoke', 'load', 'stress'],
  
  // Output directory for test results
  OUTPUT_DIR: path.join(__dirname, '../test-results'),
  
  // k6 options
  K6_OPTIONS: {
    vus: 10, // Default number of VUs
    duration: '1m', // Default test duration
    // Add any additional k6 options here
  },
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
  fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
}

/**
 * Run a k6 test with the given scenario
 */
function runTest(scenario) {
  console.log(`🚀 Starting ${scenario} test...`);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(CONFIG.OUTPUT_DIR, `${scenario}-${timestamp}.json`);
  
  try {
    const cmd = `k6 run \
      --out json=${outputFile} \
      --env BASE_URL=${CONFIG.BASE_URL} \
      ${path.join(__dirname, '../k6/smoke-test.js')} \
      --tag testid=${uuidv4()} \
      --tag scenario=${scenario} \
      --tag env=${new URL(CONFIG.BASE_URL).hostname} \
      --tag timestamp=${timestamp}`;
    
    console.log(`📝 Running: ${cmd}\n`);
    
    // Execute the k6 command
    const output = execSync(cmd, { stdio: 'inherit' });
    
    console.log(`\n✅ ${scenario} test completed successfully`);
    console.log(`📊 Results saved to: ${outputFile}\n`);
    
    return { success: true, outputFile };
  } catch (error) {
    console.error(`❌ ${scenario} test failed:`, error.message);
    return { success: false, error };
  }
}

/**
 * Generate a summary report from test results
 */
function generateReport(results) {
  const reportPath = path.join(CONFIG.OUTPUT_DIR, 'performance-report.md');
  const timestamp = new Date().toISOString();
  
  let report = `# Performance Test Report\n`;
  report += `Generated: ${timestamp}\n\n`;
  report += `## Test Configuration\n\`\`\`json\n${JSON.stringify(CONFIG, null, 2)}\n\`\`\`\n\n`;
  
  report += `## Test Results\n\n`;
  report += `| Scenario | Status | Details |\n`;
  report += `|----------|--------|---------|\n`;
  
  results.forEach(({ scenario, success, outputFile, error }) => {
    const status = success ? '✅ PASS' : '❌ FAIL';
    const details = success 
      ? `[View Results](${outputFile})` 
      : `Error: ${error.message}`;
    
    report += `| ${scenario} | ${status} | ${details} |\n`;
  });
  
  // Add recommendations based on test results
  report += `\n## Recommendations\n\n`;
  
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    report += `### Issues Found\n\n`;
    failedTests.forEach(({ scenario, error }) => {
      report += `- **${scenario}**: ${error.message}\n`;
    });
    report += `\n`;
  } else {
    report += `✅ All tests passed successfully!\n\n`;
  }
  
  // Add general recommendations
  report += `### General Recommendations\n\n`;
  report += `1. **Monitor Production**: Set up real-user monitoring (RUM) to track performance in production.\n`;
  report += `2. **Optimize Assets**: Ensure all static assets are properly compressed and cached.\n`;
  report += `3. **Database Indexing**: Review query performance and add indexes as needed.\n`;
  report += `4. **CDN**: Use a CDN for static assets to reduce server load.\n`;
  report += `5. **Caching**: Implement caching strategies for frequently accessed data.\n`;
  
  // Save the report
  fs.writeFileSync(reportPath, report);
  
  console.log(`\n📊 Performance report generated: ${reportPath}`);
  return reportPath;
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('🚀 Starting performance tests\n');
  
  const results = [];
  
  // Run each test scenario
  for (const scenario of CONFIG.SCENARIOS) {
    console.log(`\n=== ${scenario.toUpperCase()} TEST ===\n`);
    
    const startTime = Date.now();
    const result = await runTest(scenario);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    results.push({
      scenario,
      duration: `${duration}s`,
      ...result,
    });
    
    // Add a small delay between tests
    if (scenario !== CONFIG.SCENARIOS[CONFIG.SCENARIOS.length - 1]) {
      console.log('\n⏳ Waiting 10 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  // Generate and display the report
  const reportPath = generateReport(results);
  
  console.log('\n🎉 All tests completed!');
  console.log(`📊 View the full report at: ${reportPath}`);
  
  // Exit with appropriate status code
  const allPassed = results.every(r => r.success);
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
