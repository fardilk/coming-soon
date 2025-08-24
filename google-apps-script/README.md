Google Apps Script (doPost) for Coming Soon email capture

Steps to deploy

1. Open Google Sheets and create or open the target sheet. Copy the sheet ID from the URL.
   Example sheet URL:
   https://docs.google.com/spreadsheets/d/1RH4mU9eN4zuPXX8XzftjXsNTjSmDP1i6pY1WRo-FQXI/edit?usp=sharing
   The ID is: 1RH4mU9eN4zuPXX8XzftjXsNTjSmDP1i6pY1WRo-FQXI

2. In the sheet, choose Extensions → Apps Script.

3. Replace the default code in the script editor with the contents of `Code.gs` (below).

4. Save, then Deploy → New deployment → Select "Web app".
   - Execute as: Me
   - Who has access: Anyone (or Anyone, even anonymous)

5. Copy the Web app URL and paste it into `src/components/ComingSoon.tsx` as `WEB_APP_URL`.

6. Test by submitting the email from your local dev server.

Notes on CORS and payload
- The frontend uses `URLSearchParams` (application/x-www-form-urlencoded) which avoids a CORS preflight in browsers.
- The Apps Script reads `e.parameter.email` for that payload format.

reCAPTCHA recommendation (optional)
-------------------------------
To reduce spam you can integrate Google reCAPTCHA (v2 or v3).

Frontend:
- Add the reCAPTCHA script and widget to your page (v2) or load v3 and request a token.
- Send the token along with the email in the POST payload (e.g., `body = new URLSearchParams({ email, token })`).

Apps Script (server-side verification):
- In `doPost`, call `UrlFetchApp.fetch` to verify the token with Google using your secret key. Only append to the sheet when verification succeeds.

Example verification snippet (Apps Script):
```js
function verifyToken(token) {
  var secret = PropertiesService.getScriptProperties().getProperty('RECAPTCHA_SECRET')
  var resp = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token }
  })
  var json = JSON.parse(resp.getContentText())
  return json.success === true
}
```

Store your reCAPTCHA secret in Script Properties (Apps Script → Project Settings → Script Properties) and do not hard-code it in the script.

If you'd like, I can add the token field to the frontend submission code and show the exact snippet to insert into `doPost`.

---

Code.gs (paste into Apps Script)

```js
function doPost(e) {
  try {
    // For simple form POST (application/x-www-form-urlencoded), email will be in e.parameter.email
    var email = (e.parameter && e.parameter.email) || '';
    email = String(email).trim();
    if (!email) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'missing email' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var SHEET_ID = '1RH4mU9eN4zuPXX8XzftjXsNTjSmDP1i6pY1WRo-FQXI'; // <-- replace if different
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
    sheet.appendRow([new Date().toISOString(), email]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```
