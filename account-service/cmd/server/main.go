package main

import (
	"database/sql"
	"fmt"
	"log"
	"net"

	_ "github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/junjiexh/conote/account-service/internal/config"
	"github.com/junjiexh/conote/account-service/internal/jwt"
	"github.com/junjiexh/conote/account-service/internal/repository"
	"github.com/junjiexh/conote/account-service/internal/service"
	grpcpkg "github.com/junjiexh/conote/account-service/pkg/grpc"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := sql.Open("postgres", cfg.Database.DSN())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Successfully connected to database")

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)

	// Initialize JWT manager
	jwtManager := jwt.NewJWTManager(cfg.JWT.Secret, cfg.JWT.Expiration)

	// Initialize services
	authService := service.NewAuthService(userRepo, jwtManager, cfg)

	// Create gRPC server
	grpcServer := grpc.NewServer()
	accountServer := grpcpkg.NewAccountServer(authService)
	grpcpkg.RegisterAccountServiceServer(grpcServer, accountServer)

	// Register reflection service for grpcurl
	reflection.Register(grpcServer)

	// Start listening
	address := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("Failed to listen on %s: %v", address, err)
	}

	log.Printf("Account service starting on %s", address)
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
