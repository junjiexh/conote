# Kubernetes Deployment Guide for Conote

This guide explains how to deploy the Conote application to Kubernetes with Kong API Gateway and JWT authentication.

## Architecture Overview

The deployment consists of:

### Backend Services
- **Spring Boot Backend** (2+ replicas with HPA)
- **PostgreSQL 15** - Main database with persistent storage
- **Redis 7** - Caching layer with persistent storage
- **Elasticsearch 8.11** - Search functionality with persistent storage

### API Gateway
- **Kong Gateway** (2 replicas) - API Gateway with JWT authentication
- **Kong PostgreSQL** - Kong configuration database
- **JWT Authentication** - Enabled on protected routes

### Features
- JWT authentication on API endpoints (except /api/auth and health checks)
- CORS enabled
- Rate limiting (100/min, 1000/hour)
- Request size limiting (10MB)
- Horizontal Pod Autoscaling for backend
- Persistent storage for all stateful services
- Health checks and readiness probes

## Prerequisites

1. **Kubernetes Cluster** (v1.24+)
   - Minikube, Kind, K3s, GKE, EKS, or AKS
   - kubectl configured to communicate with your cluster

2. **Docker** - To build the backend image

3. **Storage Class** - A default or named storage class for PersistentVolumeClaims

## Quick Start

### 1. Build Backend Docker Image

```bash
# Navigate to the backend directory
cd ../backend

# Build the Docker image
docker build -t conote-backend:latest .

# If using Minikube, load the image into Minikube
minikube image load conote-backend:latest

# If using Kind
kind load docker-image conote-backend:latest

# If using remote cluster, push to your registry
docker tag conote-backend:latest your-registry/conote-backend:latest
docker push your-registry/conote-backend:latest
```

### 2. Update Configuration (Optional)

Before deploying, you should update the secrets:

```bash
# Generate a secure JWT secret
openssl rand -base64 64

# Edit the secrets file
vim k8s/base/backend-config.yaml
# Update JWT_SECRET in backend-secret

# Edit Kong JWT secret
vim k8s/kong/kong-configure.yaml
# Update the JWT secret in the configure.sh script to match
```

### 3. Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f base/namespace.yaml

# Deploy backend infrastructure (PostgreSQL, Redis, Elasticsearch)
kubectl apply -k base/

# Wait for databases to be ready (this may take 2-3 minutes)
kubectl wait --for=condition=ready pod -l app=postgres -n conote --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n conote --timeout=300s
kubectl wait --for=condition=ready pod -l app=elasticsearch -n conote --timeout=300s

# Deploy backend application
kubectl apply -f base/backend.yaml

# Wait for backend to be ready
kubectl wait --for=condition=ready pod -l app=backend -n conote --timeout=300s

# Deploy Kong Gateway
kubectl apply -k kong/

# Wait for Kong to be ready
kubectl wait --for=condition=ready pod -l app=kong -n conote --timeout=300s

# Configure Kong (routes, JWT, plugins)
kubectl apply -f kong/kong-configure.yaml

# Wait for configuration job to complete
kubectl wait --for=condition=complete job/kong-configure -n conote --timeout=120s
```

### 4. Access the Application

#### Using LoadBalancer (Cloud providers)

```bash
# Get the external IP
kubectl get svc kong-proxy -n conote

# Access the API
curl http://<EXTERNAL-IP>/actuator/health
```

#### Using Port Forward (Local development)

```bash
# Forward Kong proxy port
kubectl port-forward -n conote svc/kong-proxy 8000:80

# Access the API
curl http://localhost:8000/actuator/health

# Test authentication endpoint
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

#### Using Minikube

```bash
# Get the Minikube service URL
minikube service kong-proxy -n conote --url

# Use the provided URL to access the application
```

## API Endpoints

### Public Endpoints (No JWT Required)

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT token)
- `POST /api/auth/password-reset/request` - Request password reset
- `POST /api/auth/password-reset/confirm` - Confirm password reset
- `GET /actuator/health` - Health check
- `GET /actuator/prometheus` - Prometheus metrics

### Protected Endpoints (JWT Required)

All other endpoints require a valid JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

Protected routes:
- `/api/documents/*` - Document management
- `/api/sharing/*` - Document sharing
- `/api/folders/*` - Folder management

## Testing JWT Authentication

### 1. Register a User

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### 2. Login to Get JWT Token

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

Response will include a JWT token:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### 3. Access Protected Endpoint

```bash
# Without token (will fail with 401)
curl http://localhost:8000/api/documents

# With token (will succeed)
curl http://localhost:8000/api/documents \
  -H "Authorization: Bearer <your-jwt-token>"
```

## Monitoring and Debugging

### Check Pod Status

```bash
# List all pods
kubectl get pods -n conote

# Get detailed pod information
kubectl describe pod <pod-name> -n conote

# View pod logs
kubectl logs <pod-name> -n conote

# Follow logs
kubectl logs -f <pod-name> -n conote
```

### Check Backend Logs

```bash
kubectl logs -f deployment/backend -n conote
```

### Check Kong Logs

```bash
kubectl logs -f deployment/kong -n conote
```

### Access Kong Admin API

```bash
# Port forward Kong admin
kubectl port-forward -n conote svc/kong-admin 8001:8001

# Check Kong status
curl http://localhost:8001/status

# List services
curl http://localhost:8001/services

# List routes
curl http://localhost:8001/routes

# List plugins
curl http://localhost:8001/plugins

# List consumers
curl http://localhost:8001/consumers
```

### Database Access

```bash
# PostgreSQL (Application DB)
kubectl exec -it deployment/postgres -n conote -- psql -U postgres -d conote

# PostgreSQL (Kong DB)
kubectl exec -it deployment/kong-postgres -n conote -- psql -U kong -d kong

# Redis
kubectl exec -it deployment/redis -n conote -- redis-cli
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment backend -n conote --replicas=5

# Scale Kong
kubectl scale deployment kong -n conote --replicas=3
```

### Auto-scaling

Backend has HorizontalPodAutoscaler (HPA) configured:
- Min replicas: 2
- Max replicas: 10
- Target CPU: 70%
- Target Memory: 80%

```bash
# Check HPA status
kubectl get hpa -n conote

# Describe HPA
kubectl describe hpa backend-hpa -n conote
```

## Updating Configuration

### Update Backend Configuration

```bash
# Edit ConfigMap
kubectl edit configmap backend-config -n conote

# Or edit Secret
kubectl edit secret backend-secret -n conote

# Restart backend pods to pick up changes
kubectl rollout restart deployment/backend -n conote
```

### Update Kong Configuration

```bash
# Re-run the configuration job
kubectl delete job kong-configure -n conote
kubectl apply -f kong/kong-configure.yaml
```

## Troubleshooting

### Backend Not Starting

1. Check if databases are ready:
   ```bash
   kubectl get pods -n conote | grep -E 'postgres|redis|elasticsearch'
   ```

2. Check backend logs:
   ```bash
   kubectl logs deployment/backend -n conote
   ```

3. Check database connectivity:
   ```bash
   kubectl exec -it deployment/backend -n conote -- nc -zv postgres 5432
   ```

### JWT Authentication Not Working

1. Verify Kong configuration:
   ```bash
   kubectl port-forward -n conote svc/kong-admin 8001:8001
   curl http://localhost:8001/plugins | jq
   ```

2. Check JWT consumer:
   ```bash
   curl http://localhost:8001/consumers/conote-backend-issuer/jwt | jq
   ```

3. Verify JWT secret matches between backend and Kong:
   - Backend: `k8s/base/backend-config.yaml` (backend-secret)
   - Kong: `k8s/kong/kong-configure.yaml` (configure.sh script)

### Storage Issues

1. Check PVCs:
   ```bash
   kubectl get pvc -n conote
   ```

2. Describe PVC to see events:
   ```bash
   kubectl describe pvc <pvc-name> -n conote
   ```

3. Check if StorageClass exists:
   ```bash
   kubectl get storageclass
   ```

## Cleanup

To remove the entire deployment:

```bash
# Delete Kong configuration
kubectl delete -k kong/

# Delete backend and infrastructure
kubectl delete -k base/

# Delete namespace (this will delete everything)
kubectl delete namespace conote
```

## Production Recommendations

1. **Security**:
   - Change all default passwords and secrets
   - Use Kubernetes Secrets with encryption at rest
   - Enable TLS/SSL for all services
   - Use network policies to restrict pod-to-pod communication
   - Regularly update container images

2. **High Availability**:
   - Deploy PostgreSQL as a StatefulSet with replication
   - Use Redis Cluster or Sentinel for HA
   - Use Elasticsearch cluster (3+ nodes)
   - Deploy Kong with 3+ replicas across availability zones

3. **Storage**:
   - Use storage classes with appropriate performance characteristics
   - Enable volume snapshots for backups
   - Set up automated backup jobs for databases

4. **Monitoring**:
   - Deploy Prometheus and Grafana for metrics
   - Set up log aggregation (ELK, Loki, etc.)
   - Configure alerts for critical metrics
   - Use Kong's built-in metrics

5. **Performance**:
   - Configure resource limits appropriately based on load testing
   - Enable HPA for all stateless services
   - Use Redis for session caching
   - Optimize database connections and queries

6. **Networking**:
   - Use Ingress controller for production
   - Configure proper DNS
   - Enable rate limiting and DDoS protection
   - Use CDN for static assets

## Additional Resources

- [Kong Documentation](https://docs.konghq.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Spring Boot Kubernetes Guide](https://spring.io/guides/gs/spring-boot-kubernetes/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
