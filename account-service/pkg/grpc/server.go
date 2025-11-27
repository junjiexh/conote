package grpc

import (
	"context"

	"github.com/junjiexh/conote/account-service/internal/models"
	"github.com/junjiexh/conote/account-service/internal/service"
)

type AccountServer struct {
	UnimplementedAccountServiceServer
	authService *service.AuthService
}

func NewAccountServer(authService *service.AuthService) *AccountServer {
	return &AccountServer{
		authService: authService,
	}
}

func (s *AccountServer) Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	user, token, _, err := s.authService.Register(req.Email, req.Password)
	if err != nil {
		return &RegisterResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &RegisterResponse{
		Success: true,
		Message: "User registered successfully",
		Token:   token,
		User:    toUserInfo(user),
	}, nil
}

func (s *AccountServer) Login(ctx context.Context, req *LoginRequest) (*LoginResponse, error) {
	user, token, _, err := s.authService.Login(req.Email, req.Password)
	if err != nil {
		return &LoginResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &LoginResponse{
		Success: true,
		Message: "Login successful",
		Token:   token,
		User:    toUserInfo(user),
	}, nil
}

func (s *AccountServer) ValidateToken(ctx context.Context, req *ValidateTokenRequest) (*ValidateTokenResponse, error) {
	claims, err := s.authService.ValidateToken(req.Token)
	if err != nil {
		return &ValidateTokenResponse{
			Valid:   false,
			Message: err.Error(),
		}, nil
	}

	return &ValidateTokenResponse{
		Valid:   true,
		UserId:  claims.UserID,
		Email:   claims.Email,
		Role:    claims.Role,
		Message: "Token is valid",
	}, nil
}

func (s *AccountServer) RequestPasswordReset(ctx context.Context, req *PasswordResetRequest) (*PasswordResetResponse, error) {
	err := s.authService.RequestPasswordReset(req.Email)
	if err != nil {
		return &PasswordResetResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &PasswordResetResponse{
		Success: true,
		Message: "Password reset email sent",
	}, nil
}

func (s *AccountServer) ConfirmPasswordReset(ctx context.Context, req *PasswordResetConfirmRequest) (*PasswordResetConfirmResponse, error) {
	err := s.authService.ConfirmPasswordReset(req.Token, req.NewPassword)
	if err != nil {
		return &PasswordResetConfirmResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &PasswordResetConfirmResponse{
		Success: true,
		Message: "Password reset successful",
	}, nil
}

func (s *AccountServer) GetUser(ctx context.Context, req *GetUserRequest) (*GetUserResponse, error) {
	user, err := s.authService.GetUser(req.UserId)
	if err != nil {
		return &GetUserResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &GetUserResponse{
		Success: true,
		Message: "User found",
		User:    toUserInfo(user),
	}, nil
}

func (s *AccountServer) UpdateUser(ctx context.Context, req *UpdateUserRequest) (*UpdateUserResponse, error) {
	user, err := s.authService.UpdateUser(req.UserId, req.Email, req.Role)
	if err != nil {
		return &UpdateUserResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &UpdateUserResponse{
		Success: true,
		Message: "User updated successfully",
		User:    toUserInfo(user),
	}, nil
}

func toUserInfo(user *models.User) *UserInfo {
	if user == nil {
		return nil
	}

	userInfo := &UserInfo{
		Id:            user.ID,
		Email:         user.Email,
		Role:          user.Role,
		AccountLocked: user.AccountLocked,
		CreatedAt:     user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if user.LastLoginAt != nil {
		userInfo.LastLoginAt = user.LastLoginAt.Format("2006-01-02T15:04:05Z07:00")
	}

	return userInfo
}
