#!/bin/bash
set -e

echo "Setting up Kind cluster with proxy..."

# Proxy configuration - use host.docker.internal to access host from containers
PROXY_HOST="host.docker.internal:7890"
HTTP_PROXY="http://${PROXY_HOST}"
HTTPS_PROXY="http://${PROXY_HOST}"
NO_PROXY="localhost,127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

# Delete existing cluster if it exists
echo "Deleting existing cluster..."
kind delete cluster 2>/dev/null || true

# Create new cluster
echo "Creating Kind cluster..."
kind create cluster --config kind-config.yaml

# Configure containerd proxy in each node
echo "Configuring proxy in Kind nodes..."
for node in $(kind get nodes); do
  echo "  Configuring node: $node"

  docker exec "$node" sh -c "mkdir -p /etc/systemd/system/containerd.service.d"

  docker exec "$node" sh -c "cat > /etc/systemd/system/containerd.service.d/http-proxy.conf << 'EOL'
[Service]
Environment=\"HTTP_PROXY=${HTTP_PROXY}\"
Environment=\"HTTPS_PROXY=${HTTPS_PROXY}\"
Environment=\"NO_PROXY=${NO_PROXY}\"
EOL"

  docker exec "$node" systemctl daemon-reload
  docker exec "$node" systemctl restart containerd
done

echo ""
echo "✅ Kind cluster created and configured with proxy!"
echo "Proxy: ${HTTP_PROXY}"
echo ""
echo "Next steps:"
echo "  1. Build and load your images:"
echo "     docker build -t backend:latest ./backend && kind load docker-image backend:latest"
echo "     docker build -t frontend:latest ./frontend && kind load docker-image frontend:latest"
echo "  2. Deploy applications:"
echo "     kubectl apply -f k8s/"
echo "  3. Check status:"
echo "     kubectl get pods"
