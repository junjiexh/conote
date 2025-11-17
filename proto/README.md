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
make clean  # Remove all generated code
make help   # Show all available commands
```

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
