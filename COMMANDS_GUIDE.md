# COSS - Centralized File Management Service
## Operations & Command Guide

This guide covers all Artisan CLI commands, background queue workers, scheduled jobs, environment flags, and API curl examples for operating the COSS File Management Service.

---

## 1. Application & Development Commands

### Start All Services (Recommended)
Runs the web server, queue worker, and Vite asset compiler simultaneously:
```bash
composer run dev
```

### Start Services Individually
```bash
# 1. Start Laravel local development server
php artisan serve

# 2. Start Vite asset bundler
npm run dev

# 3. Start background Queue Worker (Crucial for Antivirus scanning & Webhooks)
php artisan queue:work --queue=default,scans
```

---

## 2. Client Application Management

Every external client system (e.g., EHR, Billing, Laboratory, PACS) must be registered to obtain credentials.

### Register a New Client Application
```bash
php artisan coss:client:create "System Name" [options]
```

#### Options:
- `--webhook-url="https://..."`: Destination URL to notify when file scans complete.
- `--allowed-ips="192.168.1.50,10.0.0.12"`: Restrict caller IPs (Zero-Trust network policy).
- `--rate-limit=120`: Max requests per minute (default: 120).

#### Example:
```bash
php artisan coss:client:create "Hospital EHR System" \
  --webhook-url="https://ehr.hospital.local/api/coss/webhook" \
  --allowed-ips="192.168.1.100,192.168.1.101" \
  --rate-limit=300
```

> **Note**: The command generates an `API Key` and a plaintext `API Secret`. The secret is hashed with Bcrypt in the database and is only shown once upon creation.

---

## 3. Maintenance & Retention Commands

### Purge Expired Soft-Deleted Files
Permanently removes soft-deleted files past their retention window (`retention_days`) from physical storage and marks them in the audit log:
```bash
php artisan coss:purge-expired-files
```

To automate this, add it to your server crontab or task scheduler via Laravel Schedule:
```bash
php artisan schedule:run
```

---

## 4. Database & Cache Commands

```bash
# Run pending database migrations
php artisan migrate

# Refresh database and run seeders (development reset)
php artisan migrate:fresh

# Clear application cache and routes
php artisan optimize:clear
```

---

## 5. Antivirus Scanner Environment Flags

Configure the scanner engine in `.env`:

```env
# Mock driver for testing/local development (detects test markers and EICAR)
SCANNER_DRIVER=mock

# Production driver (connects to ClamAV daemon via TCP socket)
# SCANNER_DRIVER=clamav
# CLAMAV_HOST=127.0.0.1
# CLAMAV_PORT=3310
# CLAMAV_TIMEOUT=30

# NAS mount storage path
NAS_STORAGE_PATH=/mnt/nas/coss_storage
```

---

## 6. Client API Request Examples (Curl)

### A. Direct Multipart Upload (< 50MB)
```bash
curl -X POST http://localhost:8000/api/v1/files/upload \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET" \
  -F "file=@/path/to/document.pdf" \
  -F "retention_days=90"
```

### B. Check File Metadata & Scan Status
```bash
curl -X GET http://localhost:8000/api/v1/files/{FILE_UUID} \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET"
```

### C. Request Temporary Signed Download URL (With Restrictions)
```bash
curl -X POST http://localhost:8000/api/v1/files/{FILE_UUID}/signed-url \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "expires_in_minutes": 60,
    "max_downloads": 3,
    "allowed_ips": ["192.168.1.50"],
    "password": "ConfidentialPasscode123"
  }'
```

Supported restriction parameters:
- `expires_in_minutes`: Lifetime of the download link (1 to 10,080 minutes / 7 days).
- `max_downloads`: Maximum allowed downloads before link automatically invalidates (e.g. 1 for one-time links).
- `allowed_ips`: Array of authorized IPv4/IPv6 client IP addresses.
- `password`: Optional password requirement.

### D. Download File via Signed URL
```bash
# Standard download:
curl -O "http://localhost:8000/api/v1/files/download/{FILE_UUID}?expires=...&signature=...&link=..."

# Download with Password Protection (Header or Query parameter):
curl -H "X-Download-Password: ConfidentialPasscode123" \
  -O "http://localhost:8000/api/v1/files/download/{FILE_UUID}?expires=...&signature=...&link=..."
```


### E. Chunked Upload (for Large Files)
```bash
# Step 1: Initiate session
curl -X POST http://localhost:8000/api/v1/files/chunks/initiate \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"filename": "scan.dcm", "total_size_bytes": 104857600, "total_chunks": 10}'

# Step 2: Upload chunk slice
curl -X POST http://localhost:8000/api/v1/files/chunks/{UPLOAD_ID} \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET" \
  -F "chunk_number=1" \
  -F "chunk=@slice_1.part"

# Step 3: Complete & trigger assembly and scan
curl -X POST http://localhost:8000/api/v1/files/chunks/{UPLOAD_ID}/complete \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"filename": "scan.dcm", "total_chunks": 10}'
```

### F. Query Client Audit Logs
```bash
curl -X GET "http://localhost:8000/api/v1/audit-logs?per_page=20" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET"
```
