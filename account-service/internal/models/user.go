package models

import (
	"time"
)

type User struct {
	ID                      string
	Email                   string
	PasswordHash            string
	Role                    string
	FailedLoginAttempts     int
	AccountLocked           bool
	LockedUntil             *time.Time
	PasswordResetToken      *string
	PasswordResetTokenExpiry *time.Time
	CreatedAt               time.Time
	LastLoginAt             *time.Time
}

const (
	RoleUser  = "USER"
	RoleAdmin = "ADMIN"
)
