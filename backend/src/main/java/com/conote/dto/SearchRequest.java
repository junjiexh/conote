package com.conote.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request DTO for searching documents with full-text search.
 */
@Data
@Schema(description = "Search request with query parameters")
public class SearchRequest {

    @NotBlank(message = "Search query is required")
    @Size(min = 1, max = 500, message = "Search query must be between 1 and 500 characters")
    @Schema(description = "Search query using PostgreSQL full-text search syntax", example = "meeting & notes")
    private String query;

    @Schema(description = "Page number (0-indexed)", example = "0")
    private Integer page = 0;

    @Schema(description = "Page size", example = "20")
    private Integer size = 20;
}
