package com.conote.util;

import com.conote.dto.PasswordStrengthResult;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Utility class for validating password strength with detailed feedback.
 *
 * Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 * - Not a common weak password
 */
@Component
public class PasswordValidator {

    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 128;

    // Regex patterns for validation
    private static final Pattern UPPERCASE_PATTERN = Pattern.compile("[A-Z]");
    private static final Pattern LOWERCASE_PATTERN = Pattern.compile("[a-z]");
    private static final Pattern DIGIT_PATTERN = Pattern.compile("[0-9]");
    private static final Pattern SPECIAL_CHAR_PATTERN = Pattern.compile("[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]");

    // Common weak passwords to reject
    private static final Set<String> COMMON_PASSWORDS = new HashSet<>(Arrays.asList(
        "password", "password123", "12345678", "qwerty", "abc123",
        "monkey", "1234567890", "letmein", "trustno1", "dragon",
        "baseball", "iloveyou", "master", "sunshine", "ashley",
        "bailey", "passw0rd", "shadow", "123123", "654321",
        "superman", "qazwsx", "michael", "football", "welcome"
    ));

    /**
     * Validates password strength with detailed feedback.
     *
     * @param password the password to validate
     * @return PasswordStrengthResult with validation details
     */
    public PasswordStrengthResult validate(String password) {
        PasswordStrengthResult result = new PasswordStrengthResult();
        result.setValid(true);
        int score = 0;

        // Check for null or empty
        if (password == null || password.isEmpty()) {
            result.setValid(false);
            result.addError("Password cannot be empty");
            result.setScore(0);
            return result;
        }

        // Check minimum length
        if (password.length() < MIN_LENGTH) {
            result.setValid(false);
            result.addError("Password must be at least " + MIN_LENGTH + " characters long");
            result.addSuggestion("Use a longer password for better security");
        } else {
            score++;
        }

        // Check maximum length
        if (password.length() > MAX_LENGTH) {
            result.setValid(false);
            result.addError("Password must not exceed " + MAX_LENGTH + " characters");
            result.setScore(0);
            return result;
        }

        // Check for uppercase letter
        if (!UPPERCASE_PATTERN.matcher(password).find()) {
            result.setValid(false);
            result.addError("Password must contain at least one uppercase letter (A-Z)");
            result.addSuggestion("Add uppercase letters to strengthen your password");
        } else {
            score++;
        }

        // Check for lowercase letter
        if (!LOWERCASE_PATTERN.matcher(password).find()) {
            result.setValid(false);
            result.addError("Password must contain at least one lowercase letter (a-z)");
            result.addSuggestion("Add lowercase letters to strengthen your password");
        } else {
            score++;
        }

        // Check for digit
        if (!DIGIT_PATTERN.matcher(password).find()) {
            result.setValid(false);
            result.addError("Password must contain at least one digit (0-9)");
            result.addSuggestion("Add numbers to strengthen your password");
        } else {
            score++;
        }

        // Check for special character
        if (!SPECIAL_CHAR_PATTERN.matcher(password).find()) {
            result.setValid(false);
            result.addError("Password must contain at least one special character (!@#$%^&*...)");
            result.addSuggestion("Add special characters like !@#$%^&* for better security");
        } else {
            score++;
        }

        // Check against common passwords
        if (COMMON_PASSWORDS.contains(password.toLowerCase())) {
            result.setValid(false);
            result.addError("Password is too common and easily guessable");
            result.addSuggestion("Choose a unique password that's not commonly used");
            score = 0;
        }

        // Bonus point for length > 12
        if (password.length() >= 12) {
            score++;
        }

        result.setScore(Math.min(score, 5));

        // Add general suggestions if valid
        if (result.isValid()) {
            if (score < 5) {
                result.addSuggestion("Consider making your password longer for increased security");
            }
            if (score == 5) {
                result.addSuggestion("Strong password! Your password meets all security requirements");
            }
        }

        return result;
    }

    /**
     * Simple validation that returns only boolean result.
     *
     * @param password the password to validate
     * @return true if password is valid, false otherwise
     */
    public boolean isValid(String password) {
        return validate(password).isValid();
    }

    /**
     * Gets a descriptive strength level based on score.
     *
     * @param score the password score (0-5)
     * @return strength description
     */
    public static String getStrengthDescription(int score) {
        return switch (score) {
            case 0, 1 -> "Very Weak";
            case 2 -> "Weak";
            case 3 -> "Moderate";
            case 4 -> "Strong";
            case 5 -> "Very Strong";
            default -> "Unknown";
        };
    }
}
