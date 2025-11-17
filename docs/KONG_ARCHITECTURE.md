# Kong Gateway Authentication Architecture

## Overview

This document explains how Kong Gateway is integrated into Conote to handle JWT authentication, allowing backend services to focus on business logic rather than authentication concerns.

## Architecture Diagram

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP Request with JWT
       │ Authorization: Bearer <token>
       │
       ▼
┌─────────────────────────────────────────┐
│         Kong API Gateway                │
│  ┌────────────────────────────────┐    │
│  │     JWT Plugin                  │    │
│  │  - Validates JWT signature      │    │
│  │  - Checks expiration           │    │
│  │  - Verifies issuer             │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Request Transformer Plugin     │    │
│  │  - Extracts userId from JWT     │    │
│  │  - Extracts email from JWT      │    │
│  │  - Injects X-User-Id header     │    │
│  │  - Injects X-User-Email header  │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Other Plugins                  │    │
│  │  - Rate Limiting                │    │
│  │  - CORS                         │    │
│  │  - Request Size Limiting        │    │
│  └────────────────────────────────┘    │
└──────────────┬──────────────────────────┘
               │
               │ HTTP Request with headers:
               │ X-User-Id: <uuid>
               │ X-User-Email: <email>
               │
               ▼
┌─────────────────────────────────────────┐
│       Spring Boot Backend               │
│  ┌────────────────────────────────┐    │
│  │ KongHeaderAuthenticationFilter  │    │
│  │  - Reads X-User-Id header       │    │
│  │  - Reads X-User-Email header    │    │
│  │  - Loads user from database     │    │
│  │  - Sets Spring Security context │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │   Business Logic Controllers    │    │
│  │  - DocumentController           │    │
│  │  - SharingController            │    │
│  │  - FolderController             │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Components

### 1. Kong API Gateway

**Purpose**: Acts as a reverse proxy and handles all authentication before requests reach the backend.

**Configuration**:
- **Location**: `k8s/kong/`
- **Database**: PostgreSQL for configuration storage
- **Deployment**: 2 replicas for high availability
- **Ports**:
  - 8000: HTTP proxy
  - 8443: HTTPS proxy
  - 8001: Admin API

### 2. Kong PostgreSQL

**Purpose**: Stores Kong's configuration, routes, plugins, and consumers.

**Configuration**:
- **Image**: postgres:15-alpine
- **Storage**: 2Gi PersistentVolumeClaim
- **Database**: kong
- **User**: kong

### 3. Kong Declarative Configuration

**Purpose**: Defines routes, services, plugins, and JWT consumers.

**Key Configuration** (`k8s/kong/kong-declarative-config.yaml`):

#### Services
- **backend-service**: Points to `http://backend:8080`

#### Routes

**Public Routes** (no JWT required):
1. `/api/auth/*` - Authentication endpoints
   - Plugins: CORS, Request Size Limiting

2. `/actuator/health`, `/actuator/prometheus` - Health checks
   - Plugins: CORS

**Protected Routes** (JWT required):
1. `/api/documents/*` - Document management
   - Plugins: JWT, Request Transformer, CORS, Rate Limiting, Request Size Limiting

2. `/api/sharing/*` - Document sharing
   - Plugins: JWT, Request Transformer, CORS, Rate Limiting, Request Size Limiting

3. `/api/folders/*` - Folder management
   - Plugins: JWT, Request Transformer, CORS, Rate Limiting, Request Size Limiting

#### Plugins Configuration

**JWT Plugin**:
```yaml
- name: jwt
  config:
    header_names:
    - Authorization
    claims_to_verify:
    - exp
    key_claim_name: iss
    secret_is_base64: false
```

**Request Transformer Plugin**:
```yaml
- name: request-transformer
  config:
    add:
      headers:
      - X-User-Id:$(jwt_claims.userId)
      - X-User-Email:$(jwt_claims.email)
```

**Rate Limiting Plugin**:
```yaml
- name: rate-limiting
  config:
    minute: 100
    hour: 1000
    policy: local
```

**CORS Plugin**:
```yaml
- name: cors
  config:
    origins:
    - "*"
    methods:
    - GET
    - POST
    - PUT
    - DELETE
    - PATCH
    - OPTIONS
    headers:
    - Accept
    - Authorization
    - Content-Type
    - X-User-Id
    - X-User-Email
    credentials: true
    max_age: 3600
```

#### JWT Consumer
```yaml
consumers:
- username: conote-backend
  custom_id: conote-backend
  jwt_secrets:
  - algorithm: HS256
    key: conote-issuer
    secret: <JWT_SECRET>  # Must match backend JWT_SECRET
```

## Backend Changes

### 1. JwtUtil Updates

**File**: `backend/src/main/java/com/conote/security/JwtUtil.java`

**Changes**:
- Added `issuer: "conote-issuer"` to JWT tokens
- Added `email` claim for Kong to extract

```java
private String createToken(Map<String, Object> claims, String subject) {
    claims.put("email", subject);

    return Jwts.builder()
            .claims(claims)
            .subject(subject)
            .issuer("conote-issuer")  // Required for Kong
            .issuedAt(new Date(System.currentTimeMillis()))
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getSigningKey(), Jwts.SIG.HS256)
            .compact();
}
```

### 2. KongHeaderAuthenticationFilter (NEW)

**File**: `backend/src/main/java/com/conote/security/KongHeaderAuthenticationFilter.java`

**Purpose**: Trusts Kong's authentication and extracts user information from headers.

**Logic**:
1. Extracts `X-User-Id` and `X-User-Email` headers
2. Loads user from database using email
3. Creates Spring Security authentication token
4. Sets authentication in SecurityContext

```java
final String userId = request.getHeader(HEADER_USER_ID);
final String email = request.getHeader(HEADER_USER_EMAIL);

if (email != null && !email.isEmpty()) {
    UserDetails userDetails = userDetailsService.loadUserByUsername(email);
    UsernamePasswordAuthenticationToken authenticationToken =
            new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
    SecurityContextHolder.getContext().setAuthentication(authenticationToken);
}
```

### 3. SecurityConfig Updates

**File**: `backend/src/main/java/com/conote/security/SecurityConfig.java`

**Changes**:
- Replaced `JwtAuthenticationFilter` with `KongHeaderAuthenticationFilter`
- Backend now trusts Kong's validation instead of validating JWT itself

```java
@Autowired
private KongHeaderAuthenticationFilter kongHeaderAuthenticationFilter;

@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        // ... other config ...
        .addFilterBefore(kongHeaderAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class);
    return http.build();
}
```

## Authentication Flow

### Login Flow

1. **User Login Request**:
   ```
   POST http://kong-proxy/api/auth/login
   Content-Type: application/json

   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

2. **Kong Routes to Backend** (public route, no JWT needed):
   ```
   POST http://backend:8080/api/auth/login
   ```

3. **Backend Validates Credentials**:
   - Loads user from database
   - Verifies password with BCrypt
   - Generates JWT token with:
     - `userId`: User's UUID
     - `email`: User's email
     - `iss`: "conote-issuer"
     - `exp`: Expiration timestamp

4. **Backend Returns JWT**:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "email": "user@example.com"
   }
   ```

5. **Frontend Stores JWT** in localStorage

### Protected Request Flow

1. **Client Request with JWT**:
   ```
   GET http://kong-proxy/api/documents
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Kong JWT Plugin Validates**:
   - Extracts JWT from Authorization header
   - Verifies signature using shared secret
   - Checks expiration claim
   - Verifies issuer is "conote-issuer"
   - If invalid: Returns 401 Unauthorized

3. **Kong Request Transformer Extracts Claims**:
   - Parses JWT claims
   - Extracts `userId` and `email`
   - Injects headers: `X-User-Id`, `X-User-Email`

4. **Kong Forwards to Backend**:
   ```
   GET http://backend:8080/api/documents
   X-User-Id: 123e4567-e89b-12d3-a456-426614174000
   X-User-Email: user@example.com
   ```

5. **Backend Processes Request**:
   - `KongHeaderAuthenticationFilter` reads headers
   - Loads user from database
   - Sets Spring Security context
   - Controller executes business logic
   - Returns response

6. **Kong Returns Response to Client**

## Security Considerations

### 1. Header Trust

**Risk**: If backend is accessible directly (bypassing Kong), malicious users could inject fake headers.

**Mitigation**:
- Use Kubernetes Network Policies to ensure backend is only accessible via Kong
- In production, backend service should be ClusterIP (not NodePort/LoadBalancer)
- Add network layer security (service mesh, mTLS)

### 2. JWT Secret Synchronization

**Requirement**: Kong and backend must share the same JWT secret.

**Configuration**:
- Backend: `application.properties` → `jwt.secret`
- Kong: `kong-declarative-config.yaml` → `consumers[].jwt_secrets[].secret`

**Best Practices**:
- Use Kubernetes Secrets instead of plain text
- Rotate secrets periodically
- Use strong, random secrets (min 256 bits for HS256)

### 3. Token Expiration

**Current**: 24 hours (86400000 ms)

**Recommendations**:
- Shorter expiration for sensitive operations
- Implement refresh tokens for better UX
- Consider token revocation strategy

## Benefits of Kong-Based Authentication

### 1. Separation of Concerns
- ✅ Authentication logic centralized at API Gateway
- ✅ Backend focuses on business logic
- ✅ Easy to add new services without reimplementing auth

### 2. Performance
- ✅ Kong handles JWT validation (fast C-based processing)
- ✅ Backend doesn't need to parse/verify JWT
- ✅ Reduced CPU usage on backend services

### 3. Security
- ✅ Single point of authentication enforcement
- ✅ Rate limiting prevents abuse
- ✅ Request size limiting prevents large payloads
- ✅ CORS handled at gateway level

### 4. Flexibility
- ✅ Easy to add new routes and plugins
- ✅ Can add OAuth2, API keys, or other auth methods
- ✅ Centralized logging and monitoring
- ✅ A/B testing and canary deployments

### 5. Operational
- ✅ Configuration as code (declarative YAML)
- ✅ No backend code changes for auth policy updates
- ✅ Versioned configuration in Git
- ✅ Easy rollback

## Monitoring and Debugging

### View Kong Logs
```bash
kubectl logs -l app=kong --tail=100 -f
```

### Check Kong Configuration
```bash
# Port forward admin API
kubectl port-forward svc/kong-admin 8001:8001

# View routes
curl http://localhost:8001/routes

# View plugins
curl http://localhost:8001/plugins

# View consumers
curl http://localhost:8001/consumers/conote-backend
```

### Test JWT Validation
```bash
# Login and get token
TOKEN=$(curl -X POST http://localhost:30080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token')

# Use token to access protected endpoint
curl http://localhost:30080/api/documents \
  -H "Authorization: Bearer $TOKEN"
```

### Debug Backend Headers
Add logging in `KongHeaderAuthenticationFilter`:
```java
logger.info("X-User-Id: {}", request.getHeader("X-User-Id"));
logger.info("X-User-Email: {}", request.getHeader("X-User-Email"));
```

## Troubleshooting

### Issue: 401 Unauthorized on protected routes

**Possible Causes**:
1. JWT token expired
2. Invalid JWT signature (secret mismatch)
3. Missing issuer claim
4. Kong not running

**Solutions**:
1. Check token expiration: Decode JWT at jwt.io
2. Verify secrets match: `kubectl get configmap kong-declarative-config -o yaml`
3. Check backend JwtUtil includes issuer
4. Verify Kong pods: `kubectl get pods -l app=kong`

### Issue: Backend not receiving headers

**Possible Causes**:
1. Request not going through Kong
2. Request Transformer plugin not configured
3. JWT validation failing before transformation

**Solutions**:
1. Ensure using Kong proxy URL (port 30080)
2. Check plugin config: `curl http://localhost:8001/plugins`
3. Check Kong logs for JWT validation errors

### Issue: JWT secret mismatch

**Symptoms**: 401 on all protected routes, Kong logs show signature verification failed

**Solution**:
```bash
# Update Kong secret to match backend
./scripts/update-kong-jwt-secret.sh "your-jwt-secret-here"
```

## Future Enhancements

1. **OAuth2 Integration**: Add OAuth2 plugin for third-party login
2. **API Key Authentication**: For service-to-service communication
3. **mTLS**: Mutual TLS between Kong and backend
4. **Advanced Rate Limiting**: Per-user rate limiting using Redis
5. **Request/Response Logging**: Centralized logging with ELK stack
6. **Metrics**: Prometheus integration for monitoring
7. **JWT Revocation**: Implement token blacklist
8. **Refresh Tokens**: Better UX with automatic token refresh

## References

- [Kong Documentation](https://docs.konghq.com/)
- [Kong JWT Plugin](https://docs.konghq.com/hub/kong-inc/jwt/)
- [Kong Request Transformer](https://docs.konghq.com/hub/kong-inc/request-transformer/)
- [Spring Security Architecture](https://spring.io/guides/topicals/spring-security-architecture)
