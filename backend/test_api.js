async function runTests() {
  console.log('--- Starting API Tests ---');
  let passed = 0;
  let failed = 0;

  try {
    const res = await fetch('http://localhost:5000/api/devices');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    console.log('✅ GET /api/devices returned successfully:', data.length, 'devices.');
    passed++;
  } catch (err) {
    console.error('❌ GET /api/devices failed:', err.message);
    failed++;
  }

  try {
    const res = await fetch('http://localhost:5000/api/customers');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    console.log('✅ GET /api/customers returned successfully:', data.length, 'customers.');
    passed++;
  } catch (err) {
    console.error('❌ GET /api/customers failed:', err.message);
    failed++;
  }

  try {
    const res = await fetch('http://localhost:5000/api/telemetry/recent?limit=5');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    console.log('✅ GET /api/telemetry/recent returned successfully:', data.length, 'logs.');
    passed++;
  } catch (err) {
    console.error('❌ GET /api/telemetry/recent failed:', err.message);
    failed++;
  }

  try {
    const res = await fetch('http://localhost:5000/api/telemetry/summary/all');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    console.log('✅ GET /api/telemetry/summary/all returned successfully:', data);
    passed++;
  } catch (err) {
    console.error('❌ GET /api/telemetry/summary/all failed:', err.message);
    failed++;
  }

  console.log(`\nTests Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
