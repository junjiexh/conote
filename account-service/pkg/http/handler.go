package http

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/junjiexh/conote/account-service/internal/models"
	"github.com/junjiexh/conote/account-service/internal/service"
)

type Handler struct {
	authService *service.AuthService
}

func NewHandler(authService *service.AuthService) *Handler {
	return &Handler{
		authService: authService,
	}
}

// Request/Response DTOs
type AuthRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Success bool     `json:"success"`
	Message string   `json:"message"`
	Token   string   `json:"token,omitempty"`
	User    *UserDTO `json:"user,omitempty"`
}

type UserDTO struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Role          string `json:"role"`
	AccountLocked bool   `json:"accountLocked"`
	CreatedAt     string `json:"createdAt"`
	LastLoginAt   string `json:"lastLoginAt,omitempty"`
}

type PasswordResetRequest struct {
	Email string `json:"email"`
}

type PasswordResetConfirmRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

type MessageResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// Register handles user registration
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	user, token, err := h.authService.Register(req.Email, req.Password)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	response := AuthResponse{
		Success: true,
		Message: "User registered successfully",
		Token:   token,
		User:    toUserDTO(user),
	}

	respondWithJSON(w, http.StatusCreated, response)
}

// Login handles user login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	user, token, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, err.Error())
		return
	}

	response := AuthResponse{
		Success: true,
		Message: "Login successful",
		Token:   token,
		User:    toUserDTO(user),
	}

	respondWithJSON(w, http.StatusOK, response)
}

// RequestPasswordReset handles password reset requests
func (h *Handler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req PasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	err := h.authService.RequestPasswordReset(req.Email)
	if err != nil {
		// Return success even if user not found (security best practice)
		respondWithJSON(w, http.StatusOK, MessageResponse{
			Success: true,
			Message: "If the email exists, a password reset link has been sent",
		})
		return
	}

	respondWithJSON(w, http.StatusOK, MessageResponse{
		Success: true,
		Message: "Password reset email sent",
	})
}

// ConfirmPasswordReset handles password reset confirmation
func (h *Handler) ConfirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req PasswordResetConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	err := h.authService.ConfirmPasswordReset(req.Token, req.NewPassword)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, MessageResponse{
		Success: true,
		Message: "Password reset successful",
	})
}

// Helper functions
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, MessageResponse{Success: false, Message: message})
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

func toUserDTO(user *models.User) *UserDTO {
	if user == nil {
		return nil
	}

	dto := &UserDTO{
		ID:            user.ID,
		Email:         user.Email,
		Role:          user.Role,
		AccountLocked: user.AccountLocked,
		CreatedAt:     user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if user.LastLoginAt != nil {
		dto.LastLoginAt = user.LastLoginAt.Format("2006-01-02T15:04:05Z07:00")
	}

	return dto
}

// SetupRoutes configures HTTP routes
func (h *Handler) SetupRoutes() *mux.Router {
	router := mux.NewRouter()

	// Auth routes
	router.HandleFunc("/api/auth/register", h.Register).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/auth/login", h.Login).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/auth/password-reset/request", h.RequestPasswordReset).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/auth/password-reset/confirm", h.ConfirmPasswordReset).Methods("POST", "OPTIONS")

	// CORS middleware
	router.Use(corsMiddleware)

	return router
}

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "3600")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
