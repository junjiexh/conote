# Shared Protocol Buffer Definitions

This directory contains all Protocol Buffer (protobuf) definitions used across the Conote microservices.

## Structure

```
proto/
└── account/
    └── account.proto    # Account service API definition
```

## Usage

### Go (account-service)

```bash
cd account-service
make proto
```

Generates to: `account-service/pkg/grpc/`

### Java (backend)

```bash
cd backend
mvn generate-sources
```

Generates to: `backend/target/generated-sources/protobuf/`

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
