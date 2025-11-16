# Quick Start Guide

## One-Command Deployment

```bash
cd k8s
./deploy.sh
```

This script will:
1. Build the backend Docker image
2. Load it into your Kubernetes cluster
3. Deploy all infrastructure (PostgreSQL, Redis, Elasticsearch)
4. Deploy the backend application
5. Deploy and configure Kong API Gateway with JWT authentication

## Access the Application

### Local Development (Port Forward)

```bash
kubectl port-forward -n conote svc/kong-proxy 8000:80
```

Then access: http://localhost:8000

### Minikube

```bash
minikube service kong-proxy -n conote --url
```

## Test the API

### 1. Check Health

```bash
curl http://localhost:8000/actuator/health
```

Expected response:
```json
{"status":"UP"}
```

### 2. Register a User

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

Save the token from the response.

### 4. Access Protected Endpoint

```bash
# Replace <TOKEN> with your actual JWT token
curl http://localhost:8000/api/documents \
  -H "Authorization: Bearer <TOKEN>"
```

## JWT Authentication Flow

```
1. User registers/logs in → Backend issues JWT token
2. Client includes token in Authorization header
3. Kong validates JWT signature and expiration
4. If valid, Kong forwards request to backend
5. Backend validates and processes request
```

### Public Endpoints (No JWT)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/password-reset/*`
- `GET /actuator/health`

### Protected Endpoints (JWT Required)
- `GET/POST/PUT/DELETE /api/documents/*`
- `GET/POST/PUT/DELETE /api/sharing/*`
- `GET/POST/PUT/DELETE /api/folders/*`

## Monitoring

### View Logs

```bash
# Backend logs
kubectl logs -f deployment/backend -n conote

# Kong logs
kubectl logs -f deployment/kong -n conote

# All pods
kubectl logs -f -l app.kubernetes.io/name=conote -n conote
```

### Check Status

```bash
# Pod status
kubectl get pods -n conote

# Service status
kubectl get svc -n conote

# Autoscaler status
kubectl get hpa -n conote
```

### Kong Admin API

```bash
# Port forward Kong admin
kubectl port-forward -n conote svc/kong-admin 8001:8001

# Check services
curl http://localhost:8001/services

# Check routes
curl http://localhost:8001/routes

# Check plugins
curl http://localhost:8001/plugins

# Check JWT configuration
curl http://localhost:8001/consumers/conote-backend-issuer/jwt
```

## Cleanup

```bash
cd k8s
./cleanup.sh
```

Or manually:

```bash
kubectl delete namespace conote
```

## Troubleshooting

### Pods not starting?

```bash
kubectl describe pod <pod-name> -n conote
kubectl logs <pod-name> -n conote
```

### Can't access the API?

1. Check if Kong is running:
   ```bash
   kubectl get pods -n conote | grep kong
   ```

2. Check Kong service:
   ```bash
   kubectl get svc kong-proxy -n conote
   ```

3. Verify port-forward is active

### JWT not working?

1. Verify the JWT secret matches in both places:
   - `k8s/base/backend-config.yaml` (backend-secret → JWT_SECRET)
   - `k8s/kong/kong-configure.yaml` (configure.sh → secret parameter)

2. Check Kong JWT consumer:
   ```bash
   kubectl port-forward -n conote svc/kong-admin 8001:8001
   curl http://localhost:8001/consumers/conote-backend-issuer/jwt
   ```

3. Ensure the token includes a `kid` claim or remove key_claim_name requirement

## Configuration

### Update Backend Environment Variables

```bash
kubectl edit configmap backend-config -n conote
kubectl rollout restart deployment/backend -n conote
```

### Update Secrets

```bash
kubectl edit secret backend-secret -n conote
kubectl rollout restart deployment/backend -n conote
```

### Scale Backend

```bash
# Manual scaling
kubectl scale deployment backend -n conote --replicas=5

# Auto-scaling is already configured (2-10 replicas)
kubectl get hpa backend-hpa -n conote
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Configure TLS/SSL for production
- Set up monitoring with Prometheus/Grafana
- Configure proper backups for databases
- Review and update resource limits based on your workload
