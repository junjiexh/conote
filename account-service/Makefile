.PHONY: proto build run clean

proto:
	protoc --go_out=. --go_opt=paths=source_relative \
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \
		proto/account.proto

build:
	go build -o bin/account-service ./cmd/server

run:
	go run ./cmd/server/main.go

clean:
	rm -rf bin/
	rm -rf pkg/grpc/*.pb.go

test:
	go test -v ./...

deps:
	go mod download
	go mod tidy
