# Shared Protocol Buffer Definitions

This directory contains all Protocol Buffer (protobuf) definitions used across the Conote microservices.

## Structure

```
proto/
└── account/
    └── account.proto    # Account service API definition
```

## Usage

### Quick Start (All Languages)

```bash
cd proto
make        # Generate code for all languages (Go + Java)
```

### Individual Languages

**Go (account-service):**
```bash
cd proto
make go
```
Generates to: `account-service/pkg/grpc/`

**Java (backend):**
```bash
cd proto
make java
```
Generates to: `backend/target/generated-sources/protobuf/`

### Other Commands

```bash
make clean        # Remove all generated code
make docker-build # Prepare for Docker builds
make help         # Show all available commands
```

### Docker Build Workflow

#### Option 1: Jib (Recommended - Fast!)

Use Jib Maven plugin for the backend (no Docker daemon required during build):

```bash
cd proto
make jib-backend    # Generates proto + builds image (~20s)
```

Then build other services normally:
```bash
cd ..
docker-compose build account-service frontend
```

#### Option 2: Traditional Docker Build

```bash
# 1. Generate proto code
cd proto
make docker-build

# 2. Build Docker images
cd ..
docker-compose build
```

**Note:** Backend now uses Jib by default. The Makefile `jib-backend` target:
1. Copies proto files to `backend/src/main/proto/account/`
2. Generates Java code in `backend/target/generated-sources/protobuf/`
3. Builds Docker image with Jib (much faster than traditional Docker build)

## Adding New Proto Files

1. Create new `.proto` file in appropriate subdirectory
2. Set package options for each target language:
   ```protobuf
   option go_package = "github.com/junjiexh/conote/<service>/pkg/grpc";
   option java_package = "com.conote.grpc.<service>";
   ```
3. Update build configurations in consuming services
4. Regenerate code in all services

## Best Practices

- **Never modify generated code** - Always edit `.proto` files
- **Version your APIs** - Use semantic versioning for breaking changes
- **Document your services** - Add comments to proto definitions
- **Backward compatibility** - Don't change field numbers or remove fields
