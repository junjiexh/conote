.PHONY: all go java node clean docker-build jib-backend docker-clean help

# Default target: generate all
all: go java node

# Prepare for Docker builds (generate all code)
docker-build: all
	@echo "✓ All proto code generated - ready for Docker builds"

# Build backend image with Jib (fast!)
jib-backend: java
	@echo "Building backend Docker image with Jib..."
	@cd ../backend && mvn compile jib:dockerBuild -DskipTests -q
	@echo "Cleaning up dangling images..."
	@docker image prune -f > /dev/null 2>&1 || true
	@echo "✓ Backend image built: conote-backend:latest"

# Generate Go code for account-service
go:
	@echo "Generating Go code for account-service..."
	protoc -I=. \
		--go_out=../account-service \
		--go_opt=module=github.com/junjiexh/conote/account-service \
		--go-grpc_out=../account-service \
		--go-grpc_opt=module=github.com/junjiexh/conote/account-service \
		account/account.proto
	@echo "✓ Go code generated in account-service/pkg/grpc/"

# Generate Java code for backend
java:
	@echo "Generating Java code for backend..."
	@echo "Copying proto files to backend/src/main/proto/..."
	@mkdir -p ../backend/src/main/proto
	@rm -rf ../backend/src/main/proto/account ../backend/src/main/proto/collab
	@cp -r account ../backend/src/main/proto/
	@cp -r collab ../backend/src/main/proto/
	@cd ../backend && mvn generate-sources -q
	@echo "✓ Java code generated in backend/target/generated-sources/protobuf/"

# Prepare proto files for the collaboration server (Node)
node:
	@echo "Copying proto files for collaboration server..."
	@mkdir -p ../collab-server/proto
	@rm -rf ../collab-server/proto/collab
	@cp -r collab ../collab-server/proto/
	@echo "✓ Collaboration proto available under collab-server/proto/"

# Clean all generated code
clean:
	@echo "Cleaning generated code..."
	@rm -f ../account-service/pkg/grpc/*.pb.go
	@rm -rf ../backend/target/generated-sources/protobuf
	@rm -rf ../backend/src/main/proto/account ../backend/src/main/proto/collab
	@rm -rf ../collab-server/proto/collab
	@echo "✓ Cleaned all generated protobuf code"

# Clean dangling Docker images
docker-clean:
	@echo "Cleaning dangling Docker images..."
	@docker image prune -f
	@echo "✓ Cleaned dangling images"

# Show help
help:
	@echo "Proto Code Generation Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make              Generate code for all languages (Go + Java)"
	@echo "  make all          Same as 'make'"
	@echo "  make go           Generate Go code only"
	@echo "  make java         Generate Java code only"
	@echo "  make node         Copy collaboration proto for collab-server"
	@echo "  make jib-backend  Build backend Docker image with Jib (fast, ~20s)"
	@echo "  make docker-build Generate all code (prerequisite for docker-compose build)"
	@echo "  make clean        Remove all generated code"
	@echo "  make docker-clean Clean dangling Docker images (frees disk space)"
	@echo "  make help         Show this help message"
	@echo ""
	@echo "Proto files location: proto/"
	@echo "  - account/account.proto"
	@echo ""
	@echo "Quick start:"
	@echo "  cd proto && make jib-backend  # Build backend image (proto gen + Jib build)"
