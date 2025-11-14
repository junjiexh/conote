package com.conote.service;

import com.conote.dto.AuthRequest;
import com.conote.dto.AuthResponse;
import com.conote.dto.PasswordStrengthResult;
import com.conote.exception.BadRequestException;
import com.conote.exception.ConflictException;
import com.conote.exception.ResourceNotFoundException;
import com.conote.exception.UnauthorizedAccessException;
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
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email already exists: " + request.getEmail());
        }

        // Validate password strength
        PasswordStrengthResult passwordCheck = passwordValidator.validate(request.getPassword());
        if (!passwordCheck.isValid()) {
            String errorMessage = String.join("; ", passwordCheck.getErrors());
            throw new BadRequestException("Password validation failed: " + errorMessage);
        }

        // Create new user with default USER role
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.USER);
        user.setFailedLoginAttempts(0);
        user.setAccountLocked(false);
        user.setLastLoginAt(LocalDateTime.now());

        userRepository.save(user);

        // Create default "personal" folder for the new user
        folderService.createDefaultPersonalFolder(user.getId());

        // Audit log: successful registration
        auditLogService.logSuccess(
            user.getId(),
            user.getEmail(),
            AuditLog.AuditEventType.USER_REGISTRATION,
            "User registered successfully",
            null,
            null
        );

        String token = jwtUtil.generateToken(user);
        return new AuthResponse(token);
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
        // Find user by email
        User user = userRepository.findByEmail(request.getEmail()).orElseThrow(
                () -> new ResourceNotFoundException("user", "email", request.getEmail())
        );
        log.info("Get user by email={}, user={}", request.getEmail(), user);

        // Check if account exists and is locked
        if (user != null) {
            // Check if lock has expired
            if (user.getAccountLocked() != null && user.getAccountLocked()) {
                if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(LocalDateTime.now())) {
                    long minutesRemaining = java.time.Duration.between(LocalDateTime.now(), user.getLockedUntil()).toMinutes();
                    throw new UnauthorizedAccessException(
                        "Account is locked due to too many failed login attempts. Try again in "
                        + minutesRemaining + " minutes."
                    );
                } else {
                    // Lock has expired, unlock account
                    unlockAccount(user);
                }
            }
        }

        // Attempt authentication
        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );

            // Successful login - reset failed attempts and update last login
            if (user != null) {
                resetFailedAttempts(user);
                user.setLastLoginAt(LocalDateTime.now());
                userRepository.save(user);

                // Audit log: successful login
                auditLogService.logSuccess(
                    user.getId(),
                    user.getEmail(),
                    AuditLog.AuditEventType.USER_LOGIN_SUCCESS,
                    "User logged in successfully",
                    null,
                    null
                );
            }

            assert user != null;
            String token = jwtUtil.generateToken(user);
            log.info("generated token for user {}, token={}", user.getEmail(), token);
            return new AuthResponse(token);

        } catch (BadCredentialsException e) {
            // Failed login - increment failed attempts
            if (user != null) {
                incrementFailedAttempts(user);

                // Audit log: failed login
                auditLogService.logFailure(
                    user.getId(),
                    user.getEmail(),
                    AuditLog.AuditEventType.USER_LOGIN_FAILURE,
                    "Failed login attempt",
                    "Invalid password",
                    null,
                    null
                );
            } else {
                // User not found - still log the attempt
                auditLogService.logFailure(
                    null,
                    request.getEmail(),
                    AuditLog.AuditEventType.USER_LOGIN_FAILURE,
                    "Failed login attempt",
                    "User not found",
                    null,
                    null
                );
            }
            throw new BadCredentialsException("Invalid email or password");
        }
    }

    /**
     * Increment failed login attempts and lock account if threshold exceeded.
     */
    private void incrementFailedAttempts(User user) {
        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            lockAccount(user);
        }

        userRepository.save(user);
    }

    /**
     * Lock user account for specified duration.
     */
    private void lockAccount(User user) {
        user.setAccountLocked(true);
        user.setLockedUntil(LocalDateTime.now().plusMinutes(LOCK_DURATION_MINUTES));
        userRepository.save(user);

        // Audit log: account locked
        auditLogService.logSuccess(
            user.getId(),
            user.getEmail(),
            AuditLog.AuditEventType.ACCOUNT_LOCKED,
            "Account locked due to too many failed login attempts",
            null,
            null
        );
    }

    /**
     * Unlock user account and reset failed attempts.
     */
    private void unlockAccount(User user) {
        user.setAccountLocked(false);
        user.setLockedUntil(null);
        user.setFailedLoginAttempts(0);
        userRepository.save(user);
    }

    /**
     * Reset failed login attempts counter.
     */
    private void resetFailedAttempts(User user) {
        user.setFailedLoginAttempts(0);
        userRepository.save(user);
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
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new BadRequestException("User not found with email: " + email));

        // Generate secure reset token (UUID)
        String resetToken = java.util.UUID.randomUUID().toString();

        // Set token and expiry (1 hour from now)
        user.setPasswordResetToken(resetToken);
        user.setPasswordResetTokenExpiry(LocalDateTime.now().plusHours(1));

        userRepository.save(user);

        // Audit log: password reset requested
        auditLogService.logSuccess(
            user.getId(),
            user.getEmail(),
            AuditLog.AuditEventType.PASSWORD_RESET_REQUESTED,
            "Password reset requested",
            null,
            null
        );

        // In production, send email here with reset link:
        // emailService.sendPasswordResetEmail(email, resetToken);

        return "Password reset link has been sent to your email";
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
        // Validate new password strength
        PasswordStrengthResult passwordCheck = passwordValidator.validate(newPassword);
        if (!passwordCheck.isValid()) {
            String errorMessage = String.join("; ", passwordCheck.getErrors());
            throw new BadRequestException("Password validation failed: " + errorMessage);
        }

        // Find user by reset token
        User user = userRepository.findByPasswordResetToken(token)
            .orElseThrow(() -> new BadRequestException("Invalid or expired password reset token"));

        // Check if token has expired
        if (user.getPasswordResetTokenExpiry() == null ||
            user.getPasswordResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Password reset token has expired");
        }

        // Update password and clear reset token
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordResetToken(null);
        user.setPasswordResetTokenExpiry(null);

        // Reset failed login attempts if account was locked
        if (user.getAccountLocked() != null && user.getAccountLocked()) {
            unlockAccount(user);
        }

        userRepository.save(user);

        // Audit log: password reset completed
        auditLogService.logSuccess(
            user.getId(),
            user.getEmail(),
            AuditLog.AuditEventType.PASSWORD_RESET_COMPLETED,
            "Password reset completed successfully",
            null,
            null
        );

        return "Password has been reset successfully";
    }
}
