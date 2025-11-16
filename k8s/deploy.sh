#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        print_error "docker is not installed"
        exit 1
    fi

    print_info "Prerequisites check passed"
}

# Build backend image
build_backend() {
    print_info "Building backend Docker image..."
    cd ../backend
    docker build -t conote-backend:latest .
    cd ../k8s
    print_info "Backend image built successfully"
}

# Load image to cluster
load_image() {
    print_info "Loading image to Kubernetes cluster..."

    # Detect cluster type and load image accordingly
    if kubectl config current-context | grep -q "minikube"; then
        print_info "Detected Minikube cluster"
        minikube image load conote-backend:latest
    elif kubectl config current-context | grep -q "kind"; then
        print_info "Detected Kind cluster"
        kind load docker-image conote-backend:latest
    else
        print_warn "Unknown cluster type. You may need to push the image to a registry."
        print_warn "Run: docker tag conote-backend:latest <your-registry>/conote-backend:latest"
        print_warn "Then: docker push <your-registry>/conote-backend:latest"
    fi
}

# Deploy namespace
deploy_namespace() {
    print_info "Creating namespace..."
    kubectl apply -f base/namespace.yaml
}

# Deploy infrastructure
deploy_infrastructure() {
    print_info "Deploying infrastructure (PostgreSQL, Redis, Elasticsearch)..."
    kubectl apply -k base/

    print_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n conote --timeout=300s || true
    kubectl wait --for=condition=ready pod -l app=redis -n conote --timeout=300s || true
    kubectl wait --for=condition=ready pod -l app=elasticsearch -n conote --timeout=300s || true

    print_info "Infrastructure deployed successfully"
}

# Deploy backend
deploy_backend() {
    print_info "Deploying backend application..."
    kubectl apply -f base/backend.yaml

    print_info "Waiting for backend to be ready..."
    kubectl wait --for=condition=ready pod -l app=backend -n conote --timeout=300s || true

    print_info "Backend deployed successfully"
}

# Deploy Kong
deploy_kong() {
    print_info "Deploying Kong API Gateway..."
    kubectl apply -k kong/

    print_info "Waiting for Kong to be ready..."
    sleep 10
    kubectl wait --for=condition=ready pod -l app=kong -n conote --timeout=300s || true

    print_info "Configuring Kong..."
    kubectl apply -f kong/kong-configure.yaml
    kubectl wait --for=condition=complete job/kong-configure -n conote --timeout=120s || true

    print_info "Kong deployed and configured successfully"
}

# Display status
display_status() {
    print_info "Deployment Status:"
    echo ""
    kubectl get pods -n conote
    echo ""
    kubectl get svc -n conote
    echo ""

    print_info "To access the application:"
    echo ""

    if kubectl config current-context | grep -q "minikube"; then
        print_info "Minikube detected. Run: minikube service kong-proxy -n conote --url"
    else
        print_info "Run: kubectl port-forward -n conote svc/kong-proxy 8000:80"
        print_info "Then access: http://localhost:8000"
    fi

    echo ""
    print_info "Health check: curl http://localhost:8000/actuator/health"
    print_info "Register user: curl -X POST http://localhost:8000/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"password123\"}'"
}

# Main deployment flow
main() {
    print_info "Starting Conote Kubernetes Deployment"

    check_prerequisites

    # Ask for confirmation
    read -p "Do you want to build the backend image? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_backend
        load_image
    fi

    deploy_namespace
    deploy_infrastructure
    deploy_backend
    deploy_kong

    display_status

    print_info "Deployment completed successfully!"
}

# Run main function
main
