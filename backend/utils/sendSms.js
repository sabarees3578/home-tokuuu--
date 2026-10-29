const twilio = require('twilio');

async function sendSms(toPhone, message) {
  // If Twilio is configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    try {
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toPhone.startsWith('+') ? toPhone : `+91${toPhone}` // Default to India code if none provided
      });
      console.log(`[SMS] Twilio sent to ${toPhone}`);
      return { success: true, provider: 'twilio' };
    } catch (err) {
      console.error('[SMS] Twilio error:', err);
      return { success: false, error: err.message };
    }
  }
  
  // If Fast2SMS is configured
  if (process.env.FAST2SMS_API_KEY) {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'v3',
          sender_id: 'TXTIND',
          message: message,
          language: 'english',
          flash: 0,
          numbers: toPhone.replace('+', '')
        })
      });
      const data = await response.json();
      if (data.return) {
        console.log(`[SMS] Fast2SMS sent to ${toPhone}`);
        return { success: true, provider: 'fast2sms' };
      } else {
        console.error('[SMS] Fast2SMS error:', data);
        return { success: false, error: data.message };
      }
    } catch (err) {
      console.error('[SMS] Fast2SMS request error:', err);
      return { success: false, error: err.message };
    }
  }

  // Free Open Source / Public API Fallback (Textbelt - 1 free text per day)
  try {
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: toPhone,
        message: message,
        key: 'textbelt', // Free tier key
      }),
    });
    const data = await response.json();
    if (data.success) {
      console.log(`[SMS] Free Textbelt sent to ${toPhone}`);
      return { success: true, provider: 'textbelt-free' };
    } else {
      console.error('[SMS] Free Textbelt error:', data);
      return { success: false, error: data.error || 'Textbelt free quota exceeded' };
    }
  } catch (err) {
    console.error('[SMS] Textbelt request error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = sendSms;
