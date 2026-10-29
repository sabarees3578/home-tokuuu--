const fetch = require('node-fetch'); // wait, fetch is global in node 18+
async function testSms() {
  try {
    const res = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+919578527411',
        message: 'hii from home security portal test',
        key: 'textbelt',
      }),
    });
    const data = await res.json();
    console.log(data);
  } catch (e) { console.error(e); }
}
testSms();
