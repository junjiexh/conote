.PHONY: all go java clean help

# Default target: generate all
all: go java

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
	@cd ../backend && mvn generate-sources -q
	@echo "✓ Java code generated in backend/target/generated-sources/protobuf/"

# Clean all generated code
clean:
	@echo "Cleaning generated code..."
	@rm -f ../account-service/pkg/grpc/*.pb.go
	@rm -rf ../backend/target/generated-sources/protobuf
	@echo "✓ Cleaned all generated protobuf code"

# Show help
help:
	@echo "Proto Code Generation Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make          Generate code for all languages (Go + Java)"
	@echo "  make all      Same as 'make'"
	@echo "  make go       Generate Go code only"
	@echo "  make java     Generate Java code only"
	@echo "  make clean    Remove all generated code"
	@echo "  make help     Show this help message"
	@echo ""
	@echo "Proto files location: proto/"
	@echo "  - account/account.proto"
