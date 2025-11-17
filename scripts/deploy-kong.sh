#!/bin/bash

# Script to deploy Kong API Gateway with JWT authentication
# This script deploys Kong Gateway to handle JWT authentication for Conote

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Kong API Gateway Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 1: Deploying Kong PostgreSQL...${NC}"
kubectl apply -f k8s/kong/kong-postgres.yaml

echo -e "\n${YELLOW}Step 2: Waiting for PostgreSQL to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=kong-postgres --timeout=300s || {
    echo -e "${RED}Error: Kong PostgreSQL failed to start${NC}"
    echo "Check logs with: kubectl logs -l app=kong-postgres"
    exit 1
}
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

echo -e "\n${YELLOW}Step 3: Applying Kong declarative configuration...${NC}"
kubectl apply -f k8s/kong/kong-declarative-config.yaml

echo -e "\n${YELLOW}Step 4: Deploying Kong Gateway...${NC}"
kubectl apply -f k8s/kong/kong.yaml

echo -e "\n${YELLOW}Step 5: Waiting for Kong migrations to complete...${NC}"
kubectl wait --for=condition=complete job/kong-migrations --timeout=300s || {
    echo -e "${RED}Error: Kong migrations failed${NC}"
    echo "Check logs with: kubectl logs job/kong-migrations"
    exit 1
}
echo -e "${GREEN}✓ Kong migrations completed${NC}"

echo -e "\n${YELLOW}Step 6: Waiting for Kong Gateway to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=kong --timeout=300s || {
    echo -e "${RED}Error: Kong Gateway failed to start${NC}"
    echo "Check logs with: kubectl logs -l app=kong"
    exit 1
}
echo -e "${GREEN}✓ Kong Gateway is ready${NC}"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Kong API Gateway Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\nDeployment Status:"
kubectl get pods -l app=kong -o wide
kubectl get pods -l app=kong-postgres -o wide
kubectl get svc kong-proxy kong-admin

echo -e "\n${YELLOW}Access Information:${NC}"
echo "  • Kong Proxy (HTTP): http://localhost:30080"
echo "  • Kong Proxy (HTTPS): https://localhost:30443"
echo "  • Kong Admin API: kubectl port-forward svc/kong-admin 8001:8001"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "  1. Update JWT secret in k8s/kong/kong-declarative-config.yaml to match backend JWT_SECRET"
echo "  2. Update frontend to point to Kong proxy (http://localhost:30080)"
echo "  3. Test authentication with: curl http://localhost:30080/actuator/health"

echo -e "\n${YELLOW}Useful Commands:${NC}"
echo "  • View Kong logs: kubectl logs -l app=kong --tail=100 -f"
echo "  • View Kong routes: curl http://localhost:8001/routes (after port-forward)"
echo "  • Restart Kong: kubectl rollout restart deployment/kong"
echo "  • Delete Kong: kubectl delete -k k8s/kong/"

echo -e "\n${GREEN}Documentation: k8s/kong/README.md${NC}"
