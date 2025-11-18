#!/bin/bash
set -e

echo "Building backend Docker image with Jib..."
echo ""

# Check if proto files are copied
if [ ! -d "src/main/proto/account" ]; then
    echo "⚠️  Proto files not found. Running proto generation..."
    cd ../proto
    make java
    cd ../backend
    echo "✓ Proto files copied"
    echo ""
fi

# Build Docker image using Jib
echo "Building image with Jib (no Docker daemon required)..."
mvn compile jib:dockerBuild -DskipTests

# Clean up dangling images
echo ""
echo "Cleaning up dangling images..."
docker image prune -f

echo ""
echo "✓ Build complete!"
echo "  Image: conote-backend:latest"
echo ""
echo "To run:"
echo "  docker run -p 8080:8080 conote-backend:latest"
