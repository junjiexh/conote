package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/junjiexh/conote/account-service/internal/models"
)

type RefreshTokenRepository struct {
	db *sql.DB
}

func NewRefreshTokenRepository(db *sql.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

func (r *RefreshTokenRepository) Create(token *models.RefreshToken) error {
	query := `
		INSERT INTO refresh_tokens (token, user_id, expires_at, revoked)
		VALUES ($1, $2, $3, $4)
	`
	_, err := r.db.Exec(
		query,
		token.Token,
		token.UserID,
		token.ExpiresAt,
		false,
	)
	return err
}

func (r *RefreshTokenRepository) FindValid(token string) (*models.RefreshToken, error) {
	query := `
		SELECT token, user_id, expires_at, revoked, created_at, replaced_by_token
		FROM refresh_tokens
		WHERE token = $1
	`

	rt := &models.RefreshToken{}
	err := r.db.QueryRow(query, token).Scan(
		&rt.Token,
		&rt.UserID,
		&rt.ExpiresAt,
		&rt.Revoked,
		&rt.CreatedAt,
		&rt.ReplacedByToken,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("invalid refresh token")
	}
	if err != nil {
		return nil, err
	}

	if rt.Revoked || time.Now().After(rt.ExpiresAt) {
		return nil, fmt.Errorf("refresh token expired or revoked")
	}

	return rt, nil
}

func (r *RefreshTokenRepository) RevokeAllForUser(userID string) error {
	query := `
		UPDATE refresh_tokens
		SET revoked = true
		WHERE user_id = $1 AND revoked = false
	`
	_, err := r.db.Exec(query, userID)
	return err
}

func (r *RefreshTokenRepository) Rotate(oldToken, userID, newToken string, newExpiresAt time.Time) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE refresh_tokens
		SET revoked = true, replaced_by_token = $2
		WHERE token = $1
	`, oldToken, newToken)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		INSERT INTO refresh_tokens (token, user_id, expires_at, revoked)
		VALUES ($1, $2, $3, false)
	`, newToken, userID, newExpiresAt)
	if err != nil {
		return err
	}

	return tx.Commit()
}
