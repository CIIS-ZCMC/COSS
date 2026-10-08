# COSS (Centralized Object Storage Service) — Developer Integration Guide
**Zamboanga City Medical Center (ZCMC)**  
*Document Version: 1.2.0 • API Version: v1 • Protocol: HTTPS REST*

---

## 1. Overview & Authentication

COSS is a secure, Zero-Trust object storage, antivirus scanning, and restricted-link distribution service designed for hospital departmental systems (EHR, PACS, Billing, Laboratory, Hemodialysis, HR, etc.).

### 1.1 Authentication Headers
Every request to `/api/v1/*` must include your client application's assigned credentials in the HTTP request headers:

| Header Name | Type | Description |
| :--- | :--- | :--- |
| `COSS-API-Key` | `string` | Unique client application identifier |
| `COSS-API-Secret` | `string` | Plaintext API secret corresponding to the hashed database entry |

*(Note: `X-API-Key` / `X-API-Secret` and `Authorization: Bearer {API_KEY}:{API_SECRET}` are also supported as backward-compatible fallbacks).*

### 1.2 Base URLs
- **Production (Intranet)**: `https://coss.zcmc.gov.ph/api/v1`
- **Local Dev / Staging**: `http://localhost:8000/api/v1`

---

## 2. API Endpoints Quick Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/files/upload` | Direct multipart upload (< 50MB) |
| `POST` | `/api/v1/files/chunks/initiate` | Start large file chunked upload session |
| `POST` | `/api/v1/files/chunks/{uploadId}` | Upload individual binary chunk slice |
| `POST` | `/api/v1/files/chunks/{uploadId}/complete` | Assemble and trigger scan for chunked upload |
| `GET` | `/api/v1/files/{uuid}` | Poll file metadata, ClamAV scan status & checksum |
| `POST` | `/api/v1/files/{uuid}/signed-url` | Generate restricted/permanent signed download link |
| `GET` | `/api/v1/files/download/{uuid}` | Public binary file download (signed URL) |
| `DELETE` | `/api/v1/files/{uuid}` | Soft-delete file with retention expiration policy |
| `GET` | `/api/v1/audit-logs` | Retrieve client access & activity audit trail |

---

## 3. Endpoints in Detail & Code Samples

### 3.1 Direct File Upload (< 50MB)
Upload files directly using multipart form-data. Uploaded files are immediately staged and queued for ClamAV antivirus inspection.

- **Endpoint**: `POST /api/v1/files/upload`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file` (*file*, required): Binary file payload (max 50MB).
  - `retention_days` (*int*, optional): Auto-delete retention duration in days (e.g. `90`, `365`). Defaults to indefinite if omitted.

#### cURL Example:
```bash
curl -X POST https://coss.zcmc.gov.ph/api/v1/files/upload \
  -H "COSS-API-Key: YOUR_API_KEY" \
  -H "COSS-API-Secret: YOUR_API_SECRET" \
  -F "file=@/path/to/patient_record.pdf" \
  -F "retention_days=90"
```

#### JSON Response (201 Created):
```json
{
  "success": true,
  "message": "File uploaded successfully and queued for malware scan.",
  "data": {
    "file_uuid": "9f826071-702b-4fc6-bb7c-ffb55921867c",
    "original_filename": "patient_record.pdf",
    "size_bytes": 421054,
    "mime_type": "application/pdf",
    "scan_status": "pending",
    "retention_days": 90
  }
}
```

---

### 3.2 Poll File Status & Malware Scan
Check whether the file passed antivirus scanning before allowing doctors or users to open it.

- **Endpoint**: `GET /api/v1/files/{uuid}`

```bash
curl -X GET https://coss.zcmc.gov.ph/api/v1/files/9f826071-702b-4fc6-bb7c-ffb55921867c \
  -H "COSS-API-Key: YOUR_API_KEY" \
  -H "COSS-API-Secret: YOUR_API_SECRET"
```

#### JSON Response (200 OK):
```json
{
  "uuid": "9f826071-702b-4fc6-bb7c-ffb55921867c",
  "original_filename": "patient_record.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 421054,
  "scan_status": "clean",
  "threat_name": null,
  "is_quarantined": false,
  "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
  "retention_days": 90,
  "expires_at": "2027-01-06T08:14:00Z"
}
```
*Note: Possible `scan_status` values: `pending`, `scanning`, `clean`, `infected`, `quarantined`.*

---

### 3.3 Generate Signed Download URL (Zero-Trust Restrictions & Permanent Links)
Generates an expiring or permanent signed download link with security restrictions.

- **Endpoint**: `POST /api/v1/files/{uuid}/signed-url`
- **Content-Type**: `application/json`
- **JSON Body Parameters**:
  - `expires_in_minutes` (*int*, optional): Duration in minutes (1 to 10,080). Set to `0` or omit for **Permanent / No-Expiration**.
  - `max_downloads` (*int*, optional): Maximum allowed downloads before auto-revocation (e.g. `1` for single-use).
  - `allowed_ips` (*array of strings*, optional): Restrict download to specific IPv4/IPv6 addresses (e.g. `["192.168.1.50"]`).
  - `password` (*string*, optional): Require passcode entry before decrypting/streaming file.

#### cURL (Permanent Link with Password & Max Downloads):
```bash
curl -X POST https://coss.zcmc.gov.ph/api/v1/files/9f826071-702b-4fc6-bb7c-ffb55921867c/signed-url \
  -H "COSS-API-Key: YOUR_API_KEY" \
  -H "COSS-API-Secret: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "expires_in_minutes": 0,
    "max_downloads": 5,
    "allowed_ips": ["192.168.1.100"],
    "password": "ZCMC-Secure-Pass"
  }'
```

#### JSON Response (200 OK):
```json
{
  "download_url": "https://coss.zcmc.gov.ph/api/v1/files/download/9f826071-702b-4fc6-bb7c-ffb55921867c?signature=9f4a...&link=coss_lnk_7a8b9c",
  "portal_url": "https://coss.zcmc.gov.ph/download/coss_lnk_7a8b9c",
  "token": "coss_lnk_7a8b9c",
  "expires_at": null,
  "is_permanent": true,
  "max_downloads": 5,
  "has_password": true,
  "allowed_ips": ["192.168.1.100"]
}
```

---

### 3.4 Downloading & Streaming / Previewing the File
Files can be downloaded directly through the `download_url`, streamed inline (e.g. for browser preview, audio/video playback, or PDF rendering) using `&view=1`, or accessed via the interactive web portal at `portal_url`.

#### Direct Download via cURL:
```bash
# Direct binary attachment download:
curl -O "https://coss.zcmc.gov.ph/api/v1/files/download/9f826071-702b-4fc6-bb7c-ffb55921867c?signature=9f4a...&link=coss_lnk_7a8b9c"

# If password protected, provide header or query param:
curl -H "X-Download-Password: ZCMC-Secure-Pass" \
  -O "https://coss.zcmc.gov.ph/api/v1/files/download/9f826071-702b-4fc6-bb7c-ffb55921867c?signature=9f4a...&link=coss_lnk_7a8b9c"
```

#### Stream / Inline File View (`Content-Disposition: inline`):
Append `&view=1` to the signed download URL. COSS will return the file stream with `Content-Disposition: inline; filename=...` and `Accept-Ranges: bytes` allowing web browsers and native clients to view PDFs, images, DICOMs, and audio/video without prompting a file save dialogue.
```bash
# Stream inline directly:
curl "https://coss.zcmc.gov.ph/api/v1/files/download/9f826071-702b-4fc6-bb7c-ffb55921867c?signature=9f4a...&link=coss_lnk_7a8b9c&view=1"

# Stream inline with password:
curl -H "X-Download-Password: ZCMC-Secure-Pass" \
  "https://coss.zcmc.gov.ph/api/v1/files/download/9f826071-702b-4fc6-bb7c-ffb55921867c?signature=9f4a...&link=coss_lnk_7a8b9c&view=1"
```

---

### 3.5 Large File Chunked / Resumable Upload Workflow (> 50MB)
For large DICOM CT scans, MRI volumes, or large database dumps:

#### Step 1: Initiate Chunked Session
```bash
curl -X POST https://coss.zcmc.gov.ph/api/v1/files/chunks/initiate \
  -H "COSS-API-Key: YOUR_API_KEY" \
  -H "COSS-API-Secret: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "ct_scan_volume.dcm",
    "total_size_bytes": 104857600,
    "total_chunks": 10,
    "retention_days": 180
  }'
```
*Returns `upload_id` (e.g. `chk_9a8b7c6d5e4f3a2b1c`).*

#### Step 2: Stream Individual Slices
```bash
curl -X POST https://coss.zcmc.gov.ph/api/v1/files/chunks/chk_9a8b7c6d5e4f3a2b1c \
  -H "COSS-API-Key: YOUR_API_KEY" \
  -H "COSS-API-Secret: YOUR_API_SECRET" \
  -F "chunk_number=1" \
  -F "chunk=@slice_1.part"
```

#### Step 3: Complete & Assemble
```bash
curl -X POST https://coss.zcmc.gov.ph/api/v1/files/chunks/chk_9a8b7c6d5e4f3a2b1c/complete \
  -H "COSS-API-Key: YOUR_API_KEY" \
  -H "COSS-API-Secret: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "ct_scan_volume.dcm",
    "total_chunks": 10
  }'
```

---

## 4. Multi-Language SDK Snippets

### PHP (Guzzle / Laravel Http Client)
```php
use Illuminate\Support\Facades\Http;

// 1. Upload File to COSS
$response = Http::withHeaders([
    'COSS-API-Key'    => env('COSS_API_KEY'),
    'COSS-API-Secret' => env('COSS_API_SECRET'),
])->attach(
    'file', file_get_contents($filePath), 'lab_result.pdf'
)->post('https://coss.zcmc.gov.ph/api/v1/files/upload', [
    'retention_days' => 90,
]);

$fileUuid = $response->json('file.uuid') ?? $response->json('data.file_uuid');

// 2. On-Demand One-Time Signed URL Generation (Store in DB to reuse)
if (!$record->download_url) {
    $signedResponse = Http::withHeaders([
        'COSS-API-Key'    => env('COSS_API_KEY'),
        'COSS-API-Secret' => env('COSS_API_SECRET'),
    ])->post("https://coss.zcmc.gov.ph/api/v1/files/{$fileUuid}/signed-url", [
        'expires_in_minutes' => 0, // 0 for Permanent URL
    ]);

    $record->update([
        'download_url' => $signedResponse->json('download_url'),
        'link_token'   => $signedResponse->json('link_token'),
    ]);
}

// 3. Stream or View using stored URL (with optional password forwarding & UI portal redirect)
$targetUrl = $record->download_url . ($isInlineView ? '&view=1' : ''); 
$stream = Http::withHeaders([
    'X-Download-Password' => request()->header('X-Download-Password') ?? request('password'),
])->withOptions(['stream' => true])->get($targetUrl);

// If COSS returned a security restriction (401 PasswordRequired, 403 LinkRevoked/IpBlocked, 410 Expired)
if (in_array($stream->status(), [401, 403, 410])) {
    // If accessed via a browser, redirect directly to the interactive COSS download portal UI
    // The portal cleanly displays the corresponding reason (e.g., 'Link Revoked', 'Link Expired', or passcode prompt)
    if (str_contains(request()->header('Accept', ''), 'text/html') || !request()->expectsJson()) {
        return redirect()->away($record->download_url);
    }

    return response($stream->body(), $stream->status(), [
        'Content-Type' => 'application/json',
    ]);
}
```

### JavaScript / Node.js (Axios)
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function uploadFile() {
  const form = new FormData();
  form.append('file', fs.createReadStream('./patient_chart.pdf'));
  form.append('retention_days', 90);

  const response = await axios.post('https://coss.zcmc.gov.ph/api/v1/files/upload', form, {
    headers: {
      ...form.getHeaders(),
      'COSS-API-Key': process.env.COSS_API_KEY,
      'COSS-API-Secret': process.env.COSS_API_SECRET,
    }
  });

  console.log('Uploaded File UUID:', response.data.data.file_uuid);
}
```

### Python (Requests)
```python
import requests

url = "https://coss.zcmc.gov.ph/api/v1/files/upload"
headers = {
    "COSS-API-Key": "YOUR_API_KEY",
    "COSS-API-Secret": "YOUR_API_SECRET"
}

with open("specimen_report.pdf", "rb") as f:
    files = {"file": f}
    data = {"retention_days": 90}
    response = requests.post(url, headers=headers, files=files, data=data)
    print(response.json())
```

### C# (.NET HttpClient)
```csharp
using System.Net.Http;
using System.IO;

var client = new HttpClient();
client.DefaultRequestHeaders.Add("COSS-API-Key", "YOUR_API_KEY");
client.DefaultRequestHeaders.Add("COSS-API-Secret", "YOUR_API_SECRET");

using var form = new MultipartFormDataContent();
using var fileStream = File.OpenRead("xray.png");
form.Add(new StreamContent(fileStream), "file", "xray.png");
form.Add(new StringContent("90"), "retention_days");

var response = await client.PostAsync("https://coss.zcmc.gov.ph/api/v1/files/upload", form);
string result = await response.Content.ReadAsStringAsync();
```

---

## 5. Webhook Notifications
If your client application configured a `--webhook-url`, COSS will send an asynchronous `POST` notification when file scanning completes:

```json
{
  "event": "file.scanned",
  "file_uuid": "9f826071-702b-4fc6-bb7c-ffb55921867c",
  "status": "clean",
  "scanned_at": "2026-10-08T09:12:00Z",
  "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
}
```

---

## 6. Support & Contact
For system onboarding, rate-limit adjustments, or IP whitelist requests:
- **ZCMC Health Information Management / IT Division**
- **Support Email**: `it-support@zcmc.gov.ph`
- **Internal Extension**: 1102 / 1105
