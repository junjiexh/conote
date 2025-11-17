package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"

	"github.com/junjiexh/conote/account-service/internal/models"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *models.User) error {
	query := `
		INSERT INTO users (
			id, email, password_hash, role, failed_login_attempts,
			account_locked, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	user.ID = uuid.New().String()
	user.CreatedAt = time.Now()

	_, err := r.db.Exec(
		query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.Role,
		0,
		false,
		user.CreatedAt,
	)

	return err
}

func (r *UserRepository) FindByEmail(email string) (*models.User, error) {
	query := `
		SELECT
			id, email, password_hash, role, failed_login_attempts,
			account_locked, locked_until, password_reset_token,
			password_reset_token_expiry, created_at, last_login_at
		FROM users
		WHERE email = $1
	`

	user := &models.User{}
	err := r.db.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.FailedLoginAttempts,
		&user.AccountLocked,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetTokenExpiry,
		&user.CreatedAt,
		&user.LastLoginAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}

	return user, err
}

func (r *UserRepository) FindByID(id string) (*models.User, error) {
	query := `
		SELECT
			id, email, password_hash, role, failed_login_attempts,
			account_locked, locked_until, password_reset_token,
			password_reset_token_expiry, created_at, last_login_at
		FROM users
		WHERE id = $1
	`

	user := &models.User{}
	err := r.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.FailedLoginAttempts,
		&user.AccountLocked,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetTokenExpiry,
		&user.CreatedAt,
		&user.LastLoginAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}

	return user, err
}

func (r *UserRepository) Update(user *models.User) error {
	query := `
		UPDATE users SET
			email = $1,
			password_hash = $2,
			role = $3,
			failed_login_attempts = $4,
			account_locked = $5,
			locked_until = $6,
			password_reset_token = $7,
			password_reset_token_expiry = $8,
			last_login_at = $9
		WHERE id = $10
	`

	_, err := r.db.Exec(
		query,
		user.Email,
		user.PasswordHash,
		user.Role,
		user.FailedLoginAttempts,
		user.AccountLocked,
		user.LockedUntil,
		user.PasswordResetToken,
		user.PasswordResetTokenExpiry,
		user.LastLoginAt,
		user.ID,
	)

	return err
}

func (r *UserRepository) UpdateLastLogin(userID string) error {
	query := `
		UPDATE users SET
			last_login_at = $1,
			failed_login_attempts = 0,
			account_locked = false,
			locked_until = NULL
		WHERE id = $2
	`

	now := time.Now()
	_, err := r.db.Exec(query, now, userID)
	return err
}

func (r *UserRepository) IncrementFailedAttempts(userID string) error {
	query := `
		UPDATE users SET
			failed_login_attempts = failed_login_attempts + 1
		WHERE id = $1
	`

	_, err := r.db.Exec(query, userID)
	return err
}

func (r *UserRepository) LockAccount(userID string, until time.Time) error {
	query := `
		UPDATE users SET
			account_locked = true,
			locked_until = $1
		WHERE id = $2
	`

	_, err := r.db.Exec(query, until, userID)
	return err
}

func (r *UserRepository) SetPasswordResetToken(userID, token string, expiry time.Time) error {
	query := `
		UPDATE users SET
			password_reset_token = $1,
			password_reset_token_expiry = $2
		WHERE id = $3
	`

	_, err := r.db.Exec(query, token, expiry, userID)
	return err
}

func (r *UserRepository) FindByPasswordResetToken(token string) (*models.User, error) {
	query := `
		SELECT
			id, email, password_hash, role, failed_login_attempts,
			account_locked, locked_until, password_reset_token,
			password_reset_token_expiry, created_at, last_login_at
		FROM users
		WHERE password_reset_token = $1
			AND password_reset_token_expiry > $2
	`

	user := &models.User{}
	err := r.db.QueryRow(query, token, time.Now()).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.FailedLoginAttempts,
		&user.AccountLocked,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetTokenExpiry,
		&user.CreatedAt,
		&user.LastLoginAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("invalid or expired reset token")
	}

	return user, err
}

func (r *UserRepository) ClearPasswordResetToken(userID string) error {
	query := `
		UPDATE users SET
			password_reset_token = NULL,
			password_reset_token_expiry = NULL
		WHERE id = $1
	`

	_, err := r.db.Exec(query, userID)
	return err
}

func (r *UserRepository) EmailExists(email string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`
	var exists bool
	err := r.db.QueryRow(query, email).Scan(&exists)
	return exists, err
}
