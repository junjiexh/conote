#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Main cleanup
main() {
    print_warn "This will delete all Conote resources from Kubernetes"
    read -p "Are you sure you want to continue? (y/n) " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cleanup cancelled"
        exit 0
    fi

    print_info "Cleaning up Conote deployment..."

    # Delete Kong configuration
    print_info "Deleting Kong configuration..."
    kubectl delete -k kong/ --ignore-not-found=true

    # Delete backend and infrastructure
    print_info "Deleting backend and infrastructure..."
    kubectl delete -k base/ --ignore-not-found=true

    # Delete namespace (this will delete everything)
    print_info "Deleting namespace..."
    kubectl delete namespace conote --ignore-not-found=true

    print_info "Cleanup completed successfully!"
}

main
