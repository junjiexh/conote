package com.conote.service;

import com.conote.dto.AuthRequest;
import com.conote.dto.AuthResponse;
import com.conote.dto.PasswordStrengthResult;
import com.conote.exception.BadRequestException;
import com.conote.exception.ConflictException;
import com.conote.exception.ResourceNotFoundException;
import com.conote.exception.UnauthorizedAccessException;
import com.conote.grpc.AccountServiceClient;
import com.conote.grpc.account.LoginResponse;
import com.conote.grpc.account.RegisterResponse;
import com.conote.grpc.account.PasswordResetResponse;
import com.conote.grpc.account.PasswordResetConfirmResponse;
import com.conote.model.AuditLog;
import com.conote.model.Role;
import com.conote.model.User;
import com.conote.repository.UserRepository;
import com.conote.security.JwtUtil;
import com.conote.util.PasswordValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final PasswordValidator passwordValidator;
    private final AuditLogService auditLogService;
    private final FolderService folderService;
    private final AccountServiceClient accountServiceClient;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCK_DURATION_MINUTES = 30;

    /**
     * Register a new user with password strength validation.
     *
     * @param request the registration request
     * @return authentication response with JWT token
     * @throws ConflictException if email already exists
     * @throws BadRequestException if password is weak
     */
    @Transactional
    public AuthResponse register(AuthRequest request) {
        // Call account service via gRPC
        RegisterResponse response = accountServiceClient.register(request.getEmail(), request.getPassword());

        if (!response.getSuccess()) {
            throw new BadRequestException(response.getMessage());
        }

        // Create default "personal" folder for the new user
        folderService.createDefaultPersonalFolder(UUID.fromString(response.getUser().getId()));

        // Audit log: successful registration
        auditLogService.logSuccess(
            UUID.fromString(response.getUser().getId()),
            response.getUser().getEmail(),
            AuditLog.AuditEventType.USER_REGISTRATION,
            "User registered successfully",
            null,
            null
        );

        return new AuthResponse(response.getToken());
    }

    /**
     * Login with account lockout protection.
     * Locks account after 5 failed attempts for 30 minutes.
     *
     * @param request the login request
     * @return authentication response with JWT token
     * @throws UnauthorizedAccessException if account is locked
     * @throws BadCredentialsException if credentials are invalid
     */
    @Transactional
    public AuthResponse login(AuthRequest request) {
        log.info("Try to login with request {}", request);

        // Call account service via gRPC
        LoginResponse response = accountServiceClient.login(request.getEmail(), request.getPassword());

        if (!response.getSuccess()) {
            // Audit log: failed login
            auditLogService.logFailure(
                null,
                request.getEmail(),
                AuditLog.AuditEventType.USER_LOGIN_FAILURE,
                "Failed login attempt",
                response.getMessage(),
                null,
                null
            );
            throw new BadCredentialsException(response.getMessage());
        }

        // Audit log: successful login
        auditLogService.logSuccess(
            UUID.fromString(response.getUser().getId()),
            response.getUser().getEmail(),
            AuditLog.AuditEventType.USER_LOGIN_SUCCESS,
            "User logged in successfully",
            null,
            null
        );

        log.info("generated token for user {}, token={}", response.getUser().getEmail(), response.getToken());
        return new AuthResponse(response.getToken());
    }

    /**
     * Request password reset for a user.
     * Generates a secure reset token valid for 1 hour.
     * In production, this should send an email with the reset link.
     *
     * @param email the user's email
     * @return success message
     * @throws BadRequestException if user not found
     */
    @Transactional
    public String requestPasswordReset(String email) {
        // Call account service via gRPC
        PasswordResetResponse response = accountServiceClient.requestPasswordReset(email);

        if (!response.getSuccess()) {
            throw new BadRequestException(response.getMessage());
        }

        return response.getMessage();
    }

    /**
     * Confirm password reset with token and new password.
     * Validates token and updates user password.
     *
     * @param token the reset token
     * @param newPassword the new password
     * @return success message
     * @throws BadRequestException if token is invalid or expired
     */
    @Transactional
    public String confirmPasswordReset(String token, String newPassword) {
        // Call account service via gRPC
        PasswordResetConfirmResponse response = accountServiceClient.confirmPasswordReset(token, newPassword);

        if (!response.getSuccess()) {
            throw new BadRequestException(response.getMessage());
        }

        return response.getMessage();
    }
}
