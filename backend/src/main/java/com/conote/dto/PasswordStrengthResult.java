package com.conote.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Result of password strength validation with detailed feedback.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PasswordStrengthResult {
    private boolean valid;
    private int score; // 0-5 (weak to strong)
    private List<String> errors = new ArrayList<>();
    private List<String> suggestions = new ArrayList<>();

    public PasswordStrengthResult(boolean valid) {
        this.valid = valid;
        this.errors = new ArrayList<>();
        this.suggestions = new ArrayList<>();
    }

    public void addError(String error) {
        this.errors.add(error);
    }

    public void addSuggestion(String suggestion) {
        this.suggestions.add(suggestion);
    }
}
