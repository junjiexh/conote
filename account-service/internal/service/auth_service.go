package service

import (
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/junjiexh/conote/account-service/internal/config"
	"github.com/junjiexh/conote/account-service/internal/jwt"
	"github.com/junjiexh/conote/account-service/internal/models"
	"github.com/junjiexh/conote/account-service/internal/repository"
)

type AuthService struct {
	userRepo    *repository.UserRepository
	refreshRepo *repository.RefreshTokenRepository
	jwtManager  *jwt.JWTManager
	config      *config.Config
}

func NewAuthService(userRepo *repository.UserRepository, refreshRepo *repository.RefreshTokenRepository, jwtManager *jwt.JWTManager, cfg *config.Config) *AuthService {
	return &AuthService{
		userRepo:    userRepo,
		refreshRepo: refreshRepo,
		jwtManager:  jwtManager,
		config:      cfg,
	}
}

func (s *AuthService) Register(email, password string) (*models.User, string, string, error) {
	// Validate email format
	if !isValidEmail(email) {
		return nil, "", "", fmt.Errorf("invalid email format")
	}

	// Validate password strength
	if err := s.validatePassword(password); err != nil {
		return nil, "", "", err
	}

	// Check if user already exists
	exists, err := s.userRepo.EmailExists(email)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to check email existence: %w", err)
	}
	if exists {
		return nil, "", "", fmt.Errorf("email already registered")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Email:        email,
		PasswordHash: string(hashedPassword),
		Role:         models.RoleUser,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, "", "", fmt.Errorf("failed to create user: %w", err)
	}

	return s.issueTokens(user)
}

func (s *AuthService) Login(email, password string) (*models.User, string, string, error) {
	// Find user by email
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil, "", "", fmt.Errorf("invalid credentials")
	}

	// Check if account is locked
	if user.AccountLocked {
		if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
			return nil, "", "", fmt.Errorf("account is locked until %s", user.LockedUntil.Format(time.RFC3339))
		}
		// Unlock account if lockout period has passed
		user.AccountLocked = false
		user.LockedUntil = nil
		user.FailedLoginAttempts = 0
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		// Increment failed attempts
		s.userRepo.IncrementFailedAttempts(user.ID)
		user.FailedLoginAttempts++

		// Lock account if max attempts reached
		if user.FailedLoginAttempts >= s.config.Security.MaxFailedAttempts {
			lockUntil := time.Now().Add(s.config.Security.LockoutDuration)
			s.userRepo.LockAccount(user.ID, lockUntil)
			return nil, "", "", fmt.Errorf("account locked due to too many failed login attempts")
		}

		return nil, "", "", fmt.Errorf("invalid credentials")
	}

	// Update last login and reset failed attempts
	if err := s.userRepo.UpdateLastLogin(user.ID); err != nil {
		return nil, "", "", fmt.Errorf("failed to update login time: %w", err)
	}

	// Refresh user data
	user, err = s.userRepo.FindByID(user.ID)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to refresh user data: %w", err)
	}

	return s.issueTokens(user)
}

func (s *AuthService) ValidateToken(tokenString string) (*jwt.Claims, error) {
	claims, err := s.jwtManager.Validate(tokenString)
	if err != nil {
		return nil, err
	}

	// Verify user still exists
	_, err = s.userRepo.FindByID(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	return claims, nil
}

func (s *AuthService) RequestPasswordReset(email string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		// Don't reveal if email exists
		return nil
	}

	// Generate reset token
	resetToken := uuid.New().String()
	expiry := time.Now().Add(1 * time.Hour)

	if err := s.userRepo.SetPasswordResetToken(user.ID, resetToken, expiry); err != nil {
		return fmt.Errorf("failed to set reset token: %w", err)
	}

	// In a real application, send email with reset token here
	// For now, just log it (in production, use proper email service)
	fmt.Printf("Password reset token for %s: %s\n", email, resetToken)

	return nil
}

func (s *AuthService) ConfirmPasswordReset(token, newPassword string) error {
	// Validate password strength
	if err := s.validatePassword(newPassword); err != nil {
		return err
	}

	// Find user by reset token
	user, err := s.userRepo.FindByPasswordResetToken(token)
	if err != nil {
		return err
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.PasswordHash = string(hashedPassword)

	// Update password and clear reset token
	if err := s.userRepo.Update(user); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	if err := s.userRepo.ClearPasswordResetToken(user.ID); err != nil {
		return fmt.Errorf("failed to clear reset token: %w", err)
	}

	return nil
}

func (s *AuthService) GetUser(userID string) (*models.User, error) {
	return s.userRepo.FindByID(userID)
}

func (s *AuthService) UpdateUser(userID, email, role string) (*models.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}

	if email != "" && email != user.Email {
		// Check if new email is valid
		if !isValidEmail(email) {
			return nil, fmt.Errorf("invalid email format")
		}

		// Check if email is already taken
		exists, err := s.userRepo.EmailExists(email)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, fmt.Errorf("email already in use")
		}

		user.Email = email
	}

	if role != "" && (role == models.RoleUser || role == models.RoleAdmin) {
		user.Role = role
	}

	if err := s.userRepo.Update(user); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return user, nil
}

func (s *AuthService) validatePassword(password string) error {
	if len(password) < s.config.Security.PasswordMinLength {
		return fmt.Errorf("password must be at least %d characters long", s.config.Security.PasswordMinLength)
	}

	// Check for at least one uppercase letter
	if matched, _ := regexp.MatchString(`[A-Z]`, password); !matched {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}

	// Check for at least one lowercase letter
	if matched, _ := regexp.MatchString(`[a-z]`, password); !matched {
		return fmt.Errorf("password must contain at least one lowercase letter")
	}

	// Check for at least one digit
	if matched, _ := regexp.MatchString(`[0-9]`, password); !matched {
		return fmt.Errorf("password must contain at least one digit")
	}

	return nil
}

func isValidEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

func (s *AuthService) RefreshTokens(refreshToken string) (string, string, error) {
	if refreshToken == "" {
		return "", "", fmt.Errorf("refresh token is required")
	}

	existing, err := s.refreshRepo.FindValid(refreshToken)
	if err != nil {
		return "", "", err
	}

	user, err := s.userRepo.FindByID(existing.UserID)
	if err != nil {
		return "", "", fmt.Errorf("user not found")
	}

	accessToken, err := s.jwtManager.Generate(user)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate token: %w", err)
	}

	newRefreshToken := uuid.New().String()
	expiresAt := time.Now().Add(s.config.JWT.RefreshExpiration)
	if err := s.refreshRepo.Rotate(refreshToken, user.ID, newRefreshToken, expiresAt); err != nil {
		return "", "", fmt.Errorf("failed to rotate refresh token: %w", err)
	}

	return accessToken, newRefreshToken, nil
}

func (s *AuthService) issueTokens(user *models.User) (*models.User, string, string, error) {
	if err := s.refreshRepo.RevokeAllForUser(user.ID); err != nil {
		return nil, "", "", fmt.Errorf("failed to revoke existing refresh tokens: %w", err)
	}

	accessToken, err := s.jwtManager.Generate(user)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate token: %w", err)
	}

	refreshToken := uuid.New().String()
	expiresAt := time.Now().Add(s.config.JWT.RefreshExpiration)
	token := &models.RefreshToken{
		Token:     refreshToken,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	}
	if err := s.refreshRepo.Create(token); err != nil {
		return nil, "", "", fmt.Errorf("failed to save refresh token: %w", err)
	}

	return user, accessToken, refreshToken, nil
}
