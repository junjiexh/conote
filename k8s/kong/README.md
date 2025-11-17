# Kong API Gateway with JWT Authentication

This directory contains Kubernetes manifests for deploying Kong API Gateway to handle JWT authentication for the Conote application.

## Architecture

Kong Gateway acts as a reverse proxy and handles:
- **JWT Authentication**: Validates JWT tokens before requests reach backend services
- **Header Injection**: Extracts user information from JWT and injects as headers (`X-User-Id`, `X-User-Email`)
- **Rate Limiting**: Protects backend from excessive requests (100/min, 1000/hour)
- **CORS**: Handles cross-origin requests
- **Request Size Limiting**: Limits payload size to 10MB

## Components

### 1. Kong PostgreSQL Database (`kong-postgres.yaml`)
- PostgreSQL 15 database for Kong's configuration
- Persistent storage (2Gi)
- Health checks configured

### 2. Kong Gateway (`kong.yaml`)
- Kong 3.4 API Gateway (2 replicas)
- Migration job to bootstrap database
- Admin API exposed on port 8001
- Proxy exposed via NodePort 30080/30443

### 3. Declarative Configuration (`kong-declarative-config.yaml`)
- Routes configuration:
  - **Public routes**: `/api/auth/*`, `/actuator/health`, `/actuator/prometheus`
  - **Protected routes**: `/api/documents/*`, `/api/sharing/*`, `/api/folders/*`
- JWT plugin configuration
- Request transformer to inject user headers
- CORS, rate limiting, and request size limiting plugins

## JWT Configuration

Kong is configured to validate JWT tokens with the following settings:

- **Algorithm**: HS256 (HMAC-SHA256)
- **Issuer**: `conote-issuer`
- **Secret**: Must match backend's `JWT_SECRET` environment variable
- **Claims Validated**: `exp` (expiration)
- **Claims Extracted**: `userId`, `email`

## Deployment

### Prerequisites
- Kubernetes cluster running (e.g., Kind, Minikube, or production cluster)
- kubectl configured

### Deploy Kong

```bash
# Deploy Kong and its dependencies
kubectl apply -k k8s/kong/

# Wait for Kong PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=kong-postgres --timeout=300s

# Wait for Kong migrations job to complete
kubectl wait --for=condition=complete job/kong-migrations --timeout=300s

# Wait for Kong gateway to be ready
kubectl wait --for=condition=ready pod -l app=kong --timeout=300s

# Verify deployment
kubectl get pods -l app=kong
kubectl get svc kong-proxy kong-admin
```

### Access Kong

- **Proxy (NodePort)**: http://localhost:30080
- **Admin API**: http://kong-admin:8001 (cluster internal)

### Update JWT Secret

The JWT secret in `kong-declarative-config.yaml` must match the backend's `JWT_SECRET`:

1. Update the secret in `kong-declarative-config.yaml`:
```yaml
consumers:
- username: conote-backend
  jwt_secrets:
  - algorithm: HS256
    key: conote-issuer
    secret: YOUR_JWT_SECRET_HERE  # Must match backend JWT_SECRET
```

2. Apply the updated configuration:
```bash
kubectl apply -f k8s/kong/kong-declarative-config.yaml
kubectl rollout restart deployment/kong
```

## Backend Integration

The backend is configured to trust Kong's authentication headers:

1. **KongHeaderAuthenticationFilter**: Extracts `X-User-Id` and `X-User-Email` headers
2. **JwtUtil**: Generates tokens with `iss: conote-issuer` for Kong validation
3. **SecurityConfig**: Uses Kong header filter instead of JWT validation filter

### Authentication Flow

1. User logs in via `/api/auth/login` → Backend generates JWT with `iss: conote-issuer`
2. Frontend stores JWT and includes it in `Authorization: Bearer <token>` header
3. Kong validates JWT signature and expiration
4. Kong extracts `userId` and `email` claims from JWT
5. Kong injects `X-User-Id` and `X-User-Email` headers
6. Backend receives request with headers and trusts Kong's validation
7. Backend loads user from database and sets up Spring Security context

## Testing

### Test Public Endpoints (No JWT)
```bash
# Health check
curl http://localhost:30080/actuator/health

# Register
curl -X POST http://localhost:30080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:30080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Protected Endpoints (JWT Required)
```bash
# Get JWT token from login response
TOKEN="<your-jwt-token>"

# Access documents (requires JWT)
curl http://localhost:30080/api/documents \
  -H "Authorization: Bearer $TOKEN"

# Should return 401 without valid JWT
curl http://localhost:30080/api/documents
```

### Verify Kong Headers
```bash
# Check Kong admin API
kubectl port-forward svc/kong-admin 8001:8001

# View routes
curl http://localhost:8001/routes

# View plugins
curl http://localhost:8001/plugins

# View consumers
curl http://localhost:8001/consumers
```

## Troubleshooting

### Kong pods not starting
```bash
# Check logs
kubectl logs -l app=kong --tail=100

# Check PostgreSQL connection
kubectl exec -it deploy/kong-postgres -- psql -U kong -d kong -c "\dt"
```

### JWT validation failing
1. Verify JWT secret matches between Kong and backend
2. Check JWT token includes `iss: conote-issuer` claim
3. Verify token hasn't expired
4. Check Kong logs: `kubectl logs -l app=kong --tail=50`

### Backend not receiving headers
1. Verify Kong is injecting headers (check Kong logs with `-H "X-User-Id"`)
2. Ensure request went through Kong proxy (not directly to backend)
3. Check backend logs for header reception

## Security Considerations

1. **Change Default Secrets**: Update `kong-postgres-secret` password in production
2. **JWT Secret**: Use strong, random secret (min 256 bits for HS256)
3. **HTTPS**: Enable SSL/TLS for production (update kong-proxy service)
4. **Admin API**: Restrict access to Kong Admin API in production
5. **Rate Limiting**: Adjust limits based on your traffic patterns
6. **Network Policies**: Add Kubernetes network policies to restrict traffic

## Production Recommendations

1. **High Availability**:
   - Increase Kong replicas (current: 2)
   - Use managed PostgreSQL (RDS, Cloud SQL, etc.)
   - Configure pod anti-affinity

2. **Observability**:
   - Enable Prometheus plugin for metrics
   - Configure logging aggregation
   - Set up alerts for rate limit violations

3. **Performance**:
   - Adjust resource limits based on load
   - Enable Kong's cache plugins
   - Use Kong's load balancing features

4. **Security**:
   - Use cert-manager for TLS certificates
   - Enable mTLS between Kong and backend
   - Implement IP allowlisting if needed
   - Regular security updates

## References

- [Kong Documentation](https://docs.konghq.com/)
- [Kong JWT Plugin](https://docs.konghq.com/hub/kong-inc/jwt/)
- [Kong Request Transformer](https://docs.konghq.com/hub/kong-inc/request-transformer/)
