# Local Testing with Kong Gateway

This guide explains how to test Kong Gateway JWT authentication locally using Docker Compose.

## Overview

Your local development environment now includes Kong API Gateway, which handles JWT authentication before requests reach your backend services. This mirrors the production Kubernetes setup.

## Architecture

```
Browser → Kong Gateway (port 8000) → Backend (port 8080) → PostgreSQL
          ↓ validates JWT
          ↓ injects headers
```

## Quick Start

### 1. Start All Services

```bash
# Start all services including Kong
docker-compose up -d

# View logs
docker-compose logs -f kong
```

Services will start in this order:
1. PostgreSQL (app database)
2. Redis
3. Elasticsearch
4. Kong PostgreSQL (Kong's config database)
5. Kong Migrations (database setup)
6. Kong Gateway
7. Backend (waits for Kong to be healthy)
8. Frontend

### 2. Verify Kong is Running

```bash
# Check Kong health
curl http://localhost:8001/status

# View configured routes
curl http://localhost:8001/routes

# View plugins
curl http://localhost:8001/plugins
```

### 3. Test Authentication Flow

#### Register a User (Public Route)
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

#### Login and Get JWT (Public Route)
```bash
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq -r '.token')

echo "JWT Token: $TOKEN"
```

#### Access Protected Endpoint (Requires JWT)
```bash
# This should succeed with valid JWT
curl http://localhost:8000/api/documents \
  -H "Authorization: Bearer $TOKEN"

# This should fail with 401 (no JWT)
curl http://localhost:8000/api/documents
```

## Port Mappings

| Service | Port | Description |
|---------|------|-------------|
| **Kong Proxy** | 8000 | Main entry point for all API requests |
| **Kong Admin** | 8001 | Kong admin API (routes, plugins, etc.) |
| **Backend** | 8080 | Direct backend access (bypasses Kong) |
| **Frontend** | 3000 | React frontend |
| **PostgreSQL** | 5432 | Application database |
| **Kong PostgreSQL** | 5433 | Kong configuration database |
| **Redis** | 6379 | Cache |
| **Elasticsearch** | 9200 | Search |

## Configuration

### Environment Variables (.env)

Create a `.env` file in the project root:

```bash
# Application Database
POSTGRES_DB=conote
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# JWT Configuration (IMPORTANT: Must match in Kong config)
JWT_SECRET=your-secret-key-change-this-in-production-make-it-at-least-256-bits-long
JWT_EXPIRATION=86400000

# Authentication Mode
USE_KONG_AUTH=true  # Set to false to bypass Kong for testing

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:8000
```

### Kong Configuration

**File**: `kong/kong.yml`

This declarative configuration file defines:
- **Routes**: Public (`/api/auth/*`) and protected (`/api/documents/*`, `/api/sharing/*`, `/api/folders/*`)
- **Plugins**: JWT validation, request transformation, CORS, rate limiting
- **Consumers**: JWT secret for token validation

**Important**: The JWT secret in `kong/kong.yml` must match your `JWT_SECRET` environment variable:

```yaml
consumers:
- username: conote-backend
  jwt_secrets:
  - algorithm: HS256
    key: conote-issuer
    secret: your-secret-key-change-this-in-production-make-it-at-least-256-bits-long
```

### Update Kong JWT Secret

If you change your JWT secret, update `kong/kong.yml`:

```bash
# Edit kong/kong.yml and update the secret
vi kong/kong.yml

# Restart Kong to reload configuration
docker-compose restart kong
```

## Testing Modes

### Mode 1: With Kong Authentication (Default)

**Environment**: `USE_KONG_AUTH=true`

- All requests go through Kong (port 8000)
- Kong validates JWT
- Kong injects `X-User-Id` and `X-User-Email` headers
- Backend trusts Kong's headers

```bash
# Frontend should use Kong URL
VITE_API_URL=http://localhost:8000

# Test via Kong
curl http://localhost:8000/api/documents \
  -H "Authorization: Bearer $TOKEN"
```

### Mode 2: Without Kong (Direct Backend)

**Environment**: `USE_KONG_AUTH=false`

- Requests go directly to backend (port 8080)
- Backend validates JWT itself
- No Kong headers needed

```bash
# Set in .env or docker-compose.yml
USE_KONG_AUTH=false

# Rebuild backend
docker-compose up -d --build backend

# Frontend uses backend URL
VITE_API_URL=http://localhost:8080

# Test directly to backend
curl http://localhost:8080/api/documents \
  -H "Authorization: Bearer $TOKEN"
```

## Authentication Flow Details

### With Kong (USE_KONG_AUTH=true)

1. **Client Request**:
   ```
   GET http://localhost:8000/api/documents
   Authorization: Bearer eyJhbGc...
   ```

2. **Kong JWT Plugin**:
   - Extracts JWT from Authorization header
   - Verifies signature using shared secret
   - Checks expiration claim
   - Verifies issuer is "conote-issuer"

3. **Kong Request Transformer**:
   - Parses JWT claims
   - Extracts `userId` and `email`
   - Injects headers:
     ```
     X-User-Id: 123e4567-e89b-12d3-a456-426614174000
     X-User-Email: test@example.com
     ```

4. **Backend KongHeaderAuthenticationFilter**:
   - Reads `X-User-Id` and `X-User-Email` headers
   - Loads user from database
   - Sets Spring Security context

5. **Business Logic Executes**

### Without Kong (USE_KONG_AUTH=false)

1. **Client Request**:
   ```
   GET http://localhost:8080/api/documents
   Authorization: Bearer eyJhbGc...
   ```

2. **Backend JwtAuthenticationFilter**:
   - Extracts JWT from Authorization header
   - Verifies signature
   - Checks expiration
   - Loads user from database
   - Sets Spring Security context

3. **Business Logic Executes**

## Common Tasks

### View Kong Logs
```bash
docker-compose logs -f kong
```

### Restart Kong with New Configuration
```bash
docker-compose restart kong
```

### Access Kong Database
```bash
docker exec -it conote-kong-postgres psql -U kong -d kong
```

### View Kong Routes
```bash
curl http://localhost:8001/routes | jq
```

### View Kong Plugins
```bash
curl http://localhost:8001/plugins | jq
```

### View JWT Consumer
```bash
curl http://localhost:8001/consumers/conote-backend | jq
```

### Check Rate Limiting
```bash
# Make multiple requests quickly
for i in {1..10}; do
  curl -I http://localhost:8000/api/documents \
    -H "Authorization: Bearer $TOKEN"
done

# Should eventually see 429 Too Many Requests
```

### Test CORS
```bash
curl -I http://localhost:8000/api/documents \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS
```

## Troubleshooting

### Issue: 401 Unauthorized on all protected routes

**Possible Causes**:
1. JWT secret mismatch between backend and Kong
2. JWT doesn't include `iss: conote-issuer` claim
3. JWT expired

**Solutions**:
```bash
# 1. Check JWT secret matches
grep "secret:" kong/kong.yml
grep "JWT_SECRET" .env

# 2. Decode JWT to check claims
echo "$TOKEN" | cut -d. -f2 | base64 -d | jq

# 3. Login again to get fresh token
```

### Issue: Kong not starting

**Check logs**:
```bash
docker-compose logs kong
docker-compose logs kong-postgres
docker-compose logs kong-migrations
```

**Common fixes**:
```bash
# Restart migrations
docker-compose up -d kong-migrations

# Clean restart
docker-compose down -v
docker-compose up -d
```

### Issue: Backend not receiving Kong headers

**Check**:
1. Requests are going through Kong (port 8000, not 8080)
2. `USE_KONG_AUTH=true` in backend environment
3. Kong is injecting headers (check Kong logs)

**Verify**:
```bash
# Check backend environment
docker exec conote-backend env | grep USE_KONG_AUTH

# Should show: USE_KONG_AUTH=true
```

### Issue: Rate limiting not working

**Check plugin**:
```bash
curl http://localhost:8001/plugins | jq '.data[] | select(.name=="rate-limiting")'
```

**Test**:
```bash
# Make 101 requests (limit is 100/min)
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:8000/api/documents \
    -H "Authorization: Bearer $TOKEN"
done
```

### Issue: Frontend getting CORS errors

**Check CORS plugin**:
```bash
curl http://localhost:8001/plugins | jq '.data[] | select(.name=="cors")'
```

**Verify**:
```bash
# Test CORS preflight
curl -I -X OPTIONS http://localhost:8000/api/documents \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"
```

## Development Workflow

### 1. Make Backend Changes
```bash
# Rebuild backend
docker-compose up -d --build backend

# View logs
docker-compose logs -f backend
```

### 2. Make Kong Configuration Changes
```bash
# Edit kong/kong.yml
vi kong/kong.yml

# Restart Kong
docker-compose restart kong

# Verify changes
curl http://localhost:8001/routes
```

### 3. Make Frontend Changes
```bash
# Frontend has hot-reload, just edit files
# If needed, rebuild:
docker-compose up -d --build frontend
```

## Testing Checklist

- [ ] Kong starts successfully
- [ ] Kong migrations complete
- [ ] Backend connects to Kong
- [ ] Health check accessible: `curl http://localhost:8000/actuator/health`
- [ ] User registration works
- [ ] User login returns JWT with correct claims
- [ ] Protected endpoints require JWT
- [ ] Invalid JWT returns 401
- [ ] Expired JWT returns 401
- [ ] Valid JWT accesses protected endpoints
- [ ] Rate limiting kicks in after 100 requests
- [ ] CORS headers present on responses
- [ ] Backend receives `X-User-Id` and `X-User-Email` headers

## Clean Up

```bash
# Stop all services
docker-compose down

# Remove all data (including databases)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Next Steps

1. Update frontend `VITE_API_URL` to use Kong: `http://localhost:8000`
2. Test complete authentication flow in browser
3. Monitor Kong logs for issues
4. Adjust rate limits in `kong/kong.yml` as needed
5. Add more routes/plugins as your app grows

## References

- [Kong Documentation](https://docs.konghq.com/)
- [Kong JWT Plugin](https://docs.konghq.com/hub/kong-inc/jwt/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- Main README: [../README.md](../README.md)
- Kong Architecture: [KONG_ARCHITECTURE.md](KONG_ARCHITECTURE.md)
