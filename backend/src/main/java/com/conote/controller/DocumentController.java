package com.conote.controller;

import com.conote.dto.*;
import com.conote.model.Document;
import com.conote.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@Tag(name = "Documents", description = "Document management API for hierarchical document operations")
@SecurityRequirement(name = "bearerAuth")
public class DocumentController {

    @Autowired
    private DocumentService documentService;

    @GetMapping
    @Operation(
            summary = "Get all documents as a tree structure",
            description = "Returns all documents for the authenticated user organized in a hierarchical tree structure"
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Successfully retrieved document tree",
                    content = @Content(schema = @Schema(implementation = DocumentTreeNode.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Unauthorized - Invalid or missing JWT token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<List<DocumentTreeNode>> getAllDocuments() {
        List<DocumentTreeNode> tree = documentService.getDocumentTree();
        return ResponseEntity.ok(tree);
    }

    @GetMapping("/{id}")
    @Operation(
            summary = "Get document by ID",
            description = "Returns a single document with full content by its ID. User can only access their own documents."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Document found and returned",
                    content = @Content(schema = @Schema(implementation = Document.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document not found or user doesn't have access",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<Document> getDocument(
            @Parameter(description = "Document UUID", required = true)
            @PathVariable UUID id) {
        Document document = documentService.getDocument(id);
        return ResponseEntity.ok(document);
    }

    @PostMapping
    @Operation(
            summary = "Create a new document",
            description = "Creates a new document. Can be created as a root document (parentId = null) or as a child of an existing document."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "201",
                    description = "Document created successfully",
                    content = @Content(schema = @Schema(implementation = Document.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Invalid request - validation failed or parent not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<Document> createDocument(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "Document creation request with title and optional parent ID",
                    required = true
            )
            @Valid @RequestBody CreateDocumentRequest request) {
        Document document = documentService.createDocument(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(document);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Update document",
            description = "Updates the title and/or content of an existing document. Only provided fields will be updated."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Document updated successfully",
                    content = @Content(schema = @Schema(implementation = Document.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<Document> updateDocument(
            @Parameter(description = "Document UUID", required = true)
            @PathVariable UUID id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "Update request with optional title and content",
                    required = true
            )
            @Valid @RequestBody UpdateDocumentRequest request) {
        Document document = documentService.updateDocument(id, request);
        return ResponseEntity.ok(document);
    }

    @PatchMapping("/{id}/move")
    @Operation(
            summary = "Move document in hierarchy",
            description = "Moves a document to a new parent or to root level. Prevents circular references."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Document moved successfully"
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Invalid request - circular reference detected or parent not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<Void> moveDocument(
            @Parameter(description = "Document UUID to move", required = true)
            @PathVariable UUID id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "Move request with new parent ID (null for root level)",
                    required = true
            )
            @Valid @RequestBody MoveDocumentRequest request) {
        documentService.moveDocument(id, request);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete document",
            description = "Permanently deletes a document. Child documents will have their parent_id set to null (moved to root)."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "204",
                    description = "Document deleted successfully"
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<Void> deleteDocument(
            @Parameter(description = "Document UUID to delete", required = true)
            @PathVariable UUID id) {
        documentService.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/search")
    @Operation(
            summary = "Search documents with full-text search",
            description = "Performs PostgreSQL full-text search across document titles and content with relevance ranking. Supports AND (&) and OR (|) operators."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Search completed successfully with ranked results",
                    content = @Content(schema = @Schema(implementation = SearchResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Invalid search query",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<SearchResponse> searchDocuments(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "Search request with query and pagination parameters",
                    required = true
            )
            @Valid @RequestBody SearchRequest request) {
        SearchResponse response = documentService.searchDocuments(request);
        return ResponseEntity.ok(response);
    }
}
