package com.conote.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request to confirm password reset with token and new password.
 */
@Data
public class PasswordResetConfirmRequest {
    @NotBlank(message = "Reset token is required")
    private String token;

    @NotBlank(message = "New password is required")
    private String newPassword;
}
