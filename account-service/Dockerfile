# Build stage
FROM golang:1.25-alpine AS builder

# Install protobuf compiler and necessary tools
RUN apk add --no-cache git protobuf protobuf-dev make

# Install Go protobuf plugins
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy proto files from shared location
COPY ../proto /proto

# Copy the entire project
COPY . .

# Generate protobuf code
RUN protoc -I=/proto --go_out=. --go_opt=module=github.com/junjiexh/conote/account-service \
    --go-grpc_out=. --go-grpc_opt=module=github.com/junjiexh/conote/account-service \
    account/account.proto

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/bin/account-service ./cmd/server

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates netcat-openbsd

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/bin/account-service .

# Expose gRPC port
EXPOSE 50051

CMD ["./account-service"]
