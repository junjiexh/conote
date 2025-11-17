package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	Security SecurityConfig
}

type ServerConfig struct {
	Port int
	Host string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type JWTConfig struct {
	Secret     string
	Expiration time.Duration
}

type SecurityConfig struct {
	MaxFailedAttempts int
	LockoutDuration   time.Duration
	PasswordMinLength int
}

func Load() (*Config, error) {
	port, err := strconv.Atoi(getEnv("SERVER_PORT", "50051"))
	if err != nil {
		return nil, fmt.Errorf("invalid SERVER_PORT: %w", err)
	}

	dbPort, err := strconv.Atoi(getEnv("DB_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("invalid DB_PORT: %w", err)
	}

	jwtExpiration, err := strconv.Atoi(getEnv("JWT_EXPIRATION_HOURS", "24"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_EXPIRATION_HOURS: %w", err)
	}

	maxFailedAttempts, err := strconv.Atoi(getEnv("MAX_FAILED_ATTEMPTS", "5"))
	if err != nil {
		return nil, fmt.Errorf("invalid MAX_FAILED_ATTEMPTS: %w", err)
	}

	lockoutMinutes, err := strconv.Atoi(getEnv("LOCKOUT_DURATION_MINUTES", "30"))
	if err != nil {
		return nil, fmt.Errorf("invalid LOCKOUT_DURATION_MINUTES: %w", err)
	}

	passwordMinLength, err := strconv.Atoi(getEnv("PASSWORD_MIN_LENGTH", "8"))
	if err != nil {
		return nil, fmt.Errorf("invalid PASSWORD_MIN_LENGTH: %w", err)
	}

	return &Config{
		Server: ServerConfig{
			Port: port,
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     dbPort,
			User:     getEnv("DB_USER", "conote"),
			Password: getEnv("DB_PASSWORD", "conote123"),
			DBName:   getEnv("DB_NAME", "conote_db"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
			Expiration: time.Duration(jwtExpiration) * time.Hour,
		},
		Security: SecurityConfig{
			MaxFailedAttempts: maxFailedAttempts,
			LockoutDuration:   time.Duration(lockoutMinutes) * time.Minute,
			PasswordMinLength: passwordMinLength,
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (c *DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode)
}
