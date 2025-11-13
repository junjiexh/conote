package com.conote.dto;

import com.conote.model.Document;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for search results with pagination metadata.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Search results with pagination information")
public class SearchResponse {

    @Schema(description = "List of matching documents ranked by relevance")
    private List<Document> results;

    @Schema(description = "Total number of matching documents")
    private long totalResults;

    @Schema(description = "Current page number (0-indexed)")
    private int currentPage;

    @Schema(description = "Page size")
    private int pageSize;

    @Schema(description = "Total number of pages")
    private int totalPages;

    @Schema(description = "Whether there are more results")
    private boolean hasMore;
}
