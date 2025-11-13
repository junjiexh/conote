package com.conote.controller;

import com.conote.dto.AuthRequest;
import com.conote.dto.AuthResponse;
import com.conote.dto.PasswordResetConfirmRequest;
import com.conote.dto.PasswordResetRequest;
import com.conote.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "User authentication and password management")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.register(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            log.error("Register user failed with error {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @PostMapping("/password-reset/request")
    @Operation(summary = "Request password reset", description = "Generates reset token and sends email (in production)")
    public ResponseEntity<String> requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        try {
            String message = authService.requestPasswordReset(request.getEmail());
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            log.error("Password reset request failed: {}", e.getMessage());
            // Return success even if user not found (security best practice)
            return ResponseEntity.ok("If the email exists, a password reset link has been sent");
        }
    }

    @PostMapping("/password-reset/confirm")
    @Operation(summary = "Confirm password reset", description = "Reset password using token from email")
    public ResponseEntity<String> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        try {
            String message = authService.confirmPasswordReset(request.getToken(), request.getNewPassword());
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            log.error("Password reset confirmation failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }
}
