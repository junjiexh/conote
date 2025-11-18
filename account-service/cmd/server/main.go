package main

import (
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"

	_ "github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/junjiexh/conote/account-service/internal/config"
	"github.com/junjiexh/conote/account-service/internal/jwt"
	"github.com/junjiexh/conote/account-service/internal/repository"
	"github.com/junjiexh/conote/account-service/internal/service"
	grpcpkg "github.com/junjiexh/conote/account-service/pkg/grpc"
	httppkg "github.com/junjiexh/conote/account-service/pkg/http"
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

	// Start gRPC server in a goroutine
	grpcAddress := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	listener, err := net.Listen("tcp", grpcAddress)
	if err != nil {
		log.Fatalf("Failed to listen on %s: %v", grpcAddress, err)
	}

	go func() {
		log.Printf("gRPC server starting on %s", grpcAddress)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("Failed to serve gRPC: %v", err)
		}
	}()

	// Start HTTP server
	httpHandler := httppkg.NewHandler(authService)
	router := httpHandler.SetupRoutes()

	httpAddress := fmt.Sprintf("%s:8080", cfg.Server.Host)
	log.Printf("HTTP server starting on %s", httpAddress)
	if err := http.ListenAndServe(httpAddress, router); err != nil {
		log.Fatalf("Failed to serve HTTP: %v", err)
	}
}
