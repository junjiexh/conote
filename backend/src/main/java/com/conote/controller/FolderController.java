package com.conote.controller;

import com.conote.dto.ErrorResponse;
import com.conote.dto.FolderRequest;
import com.conote.model.Document;
import com.conote.model.Folder;
import com.conote.security.JwtUtil;
import com.conote.service.FolderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/folders")
@Tag(name = "Folders", description = "Folder categorization API for organizing documents")
@SecurityRequirement(name = "bearerAuth")
@RequiredArgsConstructor
public class FolderController {

    private final FolderService folderService;
    private final JwtUtil jwtUtil;

    @GetMapping
    @Operation(
        summary = "Get all folders",
        description = "Returns all folders for the authenticated user"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully retrieved folders",
            content = @Content(schema = @Schema(implementation = Folder.class))
        ),
        @ApiResponse(
            responseCode = "401",
            description = "Unauthorized - Invalid or missing JWT token",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    })
    public ResponseEntity<List<Folder>> getAllFolders(@RequestHeader("Authorization") String authHeader) {
        UUID userId = getUserIdFromToken(authHeader);
        List<Folder> folders = folderService.getUserFolders(userId);
        return ResponseEntity.ok(folders);
    }

    @GetMapping("/{id}")
    @Operation(
        summary = "Get folder by ID",
        description = "Returns a single folder by its ID"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Folder found and returned",
            content = @Content(schema = @Schema(implementation = Folder.class))
        ),
        @ApiResponse(
            responseCode = "404",
            description = "Folder not found or user doesn't have access",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    })
    public ResponseEntity<Folder> getFolder(
        @Parameter(description = "Folder UUID", required = true)
        @PathVariable UUID id,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = getUserIdFromToken(authHeader);
        Folder folder = folderService.getFolderById(id, userId);
        return ResponseEntity.ok(folder);
    }

    @PostMapping
    @Operation(
        summary = "Create a new folder",
        description = "Creates a new folder for the authenticated user"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "201",
            description = "Folder created successfully",
            content = @Content(schema = @Schema(implementation = Folder.class))
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid folder name",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        ),
        @ApiResponse(
            responseCode = "409",
            description = "Folder name already exists",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    })
    public ResponseEntity<Folder> createFolder(
        @Valid @RequestBody FolderRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = getUserIdFromToken(authHeader);
        Folder folder = folderService.createFolder(userId, request.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(folder);
    }

    @PutMapping("/{id}")
    @Operation(
        summary = "Update folder name",
        description = "Updates the name of an existing folder"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Folder updated successfully",
            content = @Content(schema = @Schema(implementation = Folder.class))
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid folder name or cannot rename personal folder",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        ),
        @ApiResponse(
            responseCode = "404",
            description = "Folder not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        ),
        @ApiResponse(
            responseCode = "409",
            description = "Folder name already exists",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    })
    public ResponseEntity<Folder> updateFolder(
        @Parameter(description = "Folder UUID", required = true)
        @PathVariable UUID id,
        @Valid @RequestBody FolderRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = getUserIdFromToken(authHeader);
        Folder folder = folderService.updateFolder(id, userId, request.getName());
        return ResponseEntity.ok(folder);
    }

    @DeleteMapping("/{id}")
    @Operation(
        summary = "Delete a folder",
        description = "Deletes a folder. Documents in the folder will have their folder_id set to null."
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "204",
            description = "Folder deleted successfully"
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Cannot delete personal folder",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        ),
        @ApiResponse(
            responseCode = "404",
            description = "Folder not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    })
    public ResponseEntity<Void> deleteFolder(
        @Parameter(description = "Folder UUID", required = true)
        @PathVariable UUID id,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = getUserIdFromToken(authHeader);
        folderService.deleteFolder(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/documents")
    @Operation(
        summary = "Get documents in folder",
        description = "Returns all documents in a specific folder"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully retrieved documents",
            content = @Content(schema = @Schema(implementation = Document.class))
        ),
        @ApiResponse(
            responseCode = "404",
            description = "Folder not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    })
    public ResponseEntity<List<Document>> getDocumentsInFolder(
        @Parameter(description = "Folder UUID", required = true)
        @PathVariable UUID id,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = getUserIdFromToken(authHeader);
        List<Document> documents = folderService.getDocumentsInFolder(id, userId);
        return ResponseEntity.ok(documents);
    }

    /**
     * Extract user ID from JWT token in Authorization header.
     */
    private UUID getUserIdFromToken(String authHeader) {
        String token = authHeader.substring(7); // Remove "Bearer " prefix
        return jwtUtil.getUserIdFromToken(token);
    }
}
