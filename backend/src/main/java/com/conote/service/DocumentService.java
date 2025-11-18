package com.conote.service;

import com.conote.dto.*;
import com.conote.exception.BadRequestException;
import com.conote.exception.ForbiddenException;
import com.conote.exception.ResourceNotFoundException;
import com.conote.model.Document;
import com.conote.model.DocumentContent;
import com.conote.model.DocumentPermission;
import com.conote.model.DocumentSearchIndex;
import com.conote.model.PermissionLevel;
import com.conote.model.User;
import com.conote.repository.DocumentContentRepository;
import com.conote.repository.DocumentRepository;
import com.conote.repository.DocumentSearchRepository;
import com.conote.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service layer for document operations with Redis caching and performance optimizations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentContentRepository documentContentRepository;
    private final DocumentSearchRepository documentSearchRepository;
    private final UserRepository userRepository;
    private final PermissionService permissionService;

    public UUID getCurrentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return user.getId();
    }

    /**
     * Get document tree with Redis caching.
     * Now includes documents owned by the user AND documents shared with them.
     * Cache is evicted when documents are created, updated, moved, or deleted.
     */
    @Cacheable(value = "documentTree", key = "#root.target.getCurrentUserId()")
    public List<DocumentTreeNode> getDocumentTree() {
        UUID userId = getCurrentUserId();

        // Get owned documents
        List<Document> ownedDocuments = documentRepository.findByUserId(userId);

        // Get shared documents (documents explicitly shared with this user)
        List<DocumentPermission> permissions = permissionService.getUserPermissions(userId);
        List<Document> sharedDocuments = permissions.stream()
                .map(perm -> documentRepository.findById(perm.getDocumentId()))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toList());

        // Combine owned and shared documents
        List<Document> allDocuments = new ArrayList<>();
        allDocuments.addAll(ownedDocuments);
        allDocuments.addAll(sharedDocuments);

        return buildTree(allDocuments);
    }

    private List<DocumentTreeNode> buildTree(List<Document> documents) {
        // Create a map for quick lookup
        Map<UUID, DocumentTreeNode> nodeMap = new HashMap<>();
        List<DocumentTreeNode> rootNodes = new ArrayList<>();

        // Convert all documents to tree nodes
        for (Document doc : documents) {
            DocumentTreeNode node = new DocumentTreeNode();
            node.setId(doc.getId());
            node.setParentId(doc.getParentId());
            node.setTitle(doc.getTitle());
            node.setContent(doc.getContent());
            node.setCreatedAt(doc.getCreatedAt());
            node.setUpdatedAt(doc.getUpdatedAt());
            node.setChildren(new ArrayList<>());
            nodeMap.put(doc.getId(), node);
        }

        // Build the tree structure
        for (DocumentTreeNode node : nodeMap.values()) {
            if (node.getParentId() == null) {
                rootNodes.add(node);
            } else {
                DocumentTreeNode parent = nodeMap.get(node.getParentId());
                if (parent != null) {
                    parent.getChildren().add(node);
                }
            }
        }

        return rootNodes;
    }

    public Document getDocument(UUID id) {
        UUID userId = getCurrentUserId();

        // Check if user has at least VIEWER permission
        if (!permissionService.hasPermission(id, userId, PermissionLevel.VIEWER)) {
            throw new ForbiddenException("You don't have permission to view this document");
        }

        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));

        // Try to get Editor.js JSON content from MongoDB
        documentContentRepository.findById(id.toString()).ifPresent(documentContent -> {
            // If MongoDB has JSON content, use it; otherwise use HTML from PostgreSQL
            if (documentContent.getContentJson() != null && !documentContent.getContentJson().isEmpty()) {
                document.setContent(documentContent.getContentJson());
            }
        });

        return document;
    }

    @Transactional
    @CacheEvict(value = "documentTree", key = "#root.target.getCurrentUserId()")
    public Document createDocument(CreateDocumentRequest request) {
        UUID userId = getCurrentUserId();

        // Verify parent exists and user has EDITOR permission if parentId is provided
        if (request.getParentId() != null) {
            Document parent = documentRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent document", "id", request.getParentId()));

            // Check if user has EDITOR permission on parent (required to create children)
            if (!permissionService.hasPermission(request.getParentId(), userId, PermissionLevel.EDITOR)) {
                throw new ForbiddenException("You don't have permission to create documents under this parent");
            }
        }

        Document document = new Document();
        document.setUserId(userId);
        document.setParentId(request.getParentId());
        document.setTitle(request.getTitle());
        document.setContent("");

        Document savedDocument = documentRepository.save(document);
        log.info("saved document is {}", document);

        // Index in Elasticsearch
        DocumentSearchIndex searchIndex = DocumentSearchIndex.fromDocument(savedDocument);
        documentSearchRepository.save(searchIndex);

        return savedDocument;
    }

    @Transactional
    @CacheEvict(value = "documentTree", key = "#root.target.getCurrentUserId()")
    public Document updateDocument(UUID id, UpdateDocumentRequest request) {
        UUID userId = getCurrentUserId();

        // Check if user has EDITOR permission
        if (!permissionService.hasPermission(id, userId, PermissionLevel.EDITOR)) {
            throw new ForbiddenException("You don't have permission to edit this document");
        }

        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));

        if (request.getTitle() != null) {
            document.setTitle(request.getTitle());
        }
        if (request.getContent() != null) {
            // Store Editor.js JSON content in MongoDB
            // Detect if content is JSON (Editor.js format) or HTML (legacy format)
            if (isJsonContent(request.getContent())) {
                DocumentContent documentContent = documentContentRepository
                        .findById(id.toString())
                        .orElse(new DocumentContent());

                documentContent.setId(id.toString());
                documentContent.setUserId(userId.toString());
                documentContent.setContentJson(request.getContent());
                documentContent.setUpdatedAt(java.time.LocalDateTime.now());

                if (documentContent.getCreatedAt() == null) {
                    documentContent.setCreatedAt(java.time.LocalDateTime.now());
                }

                documentContentRepository.save(documentContent);
                log.info("Saved Editor.js JSON content to MongoDB for document: {}", id);

                // Clear PostgreSQL content field - MongoDB is now the source of truth
                document.setContent("");
            } else {
                // For non-JSON content (legacy or edge cases), store in PostgreSQL
                document.setContent(request.getContent());
            }
        }

        Document savedDocument = documentRepository.save(document);
        log.info("updated document is {}", document);

        // Update in Elasticsearch
        DocumentSearchIndex searchIndex = DocumentSearchIndex.fromDocument(savedDocument);
        documentSearchRepository.save(searchIndex);

        return savedDocument;
    }

    /**
     * Helper method to detect if content is JSON format (Editor.js) or HTML
     */
    private boolean isJsonContent(String content) {
        if (content == null || content.trim().isEmpty()) {
            return false;
        }
        String trimmed = content.trim();
        return trimmed.startsWith("{") && trimmed.endsWith("}");
    }

    @Transactional
    @CacheEvict(value = "documentTree", key = "#root.target.getCurrentUserId()")
    public void moveDocument(UUID id, MoveDocumentRequest request) {
        UUID userId = getCurrentUserId();

        // Only owner can move documents
        if (!permissionService.isOwner(id, userId)) {
            throw new ForbiddenException("Only the document owner can move documents");
        }

        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));

        // Verify new parent exists and user has EDITOR permission if provided
        if (request.getNewParentId() != null) {
            Document newParent = documentRepository.findById(request.getNewParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("New parent document", "id", request.getNewParentId()));

            // Check if user has EDITOR permission on new parent
            if (!permissionService.hasPermission(request.getNewParentId(), userId, PermissionLevel.EDITOR)) {
                throw new ForbiddenException("You don't have permission to move documents to this parent");
            }

            // Check for circular reference
            if (wouldCreateCircularReference(id, request.getNewParentId(), userId)) {
                throw new BadRequestException("Moving document would create a circular reference");
            }
        }

        document.setParentId(request.getNewParentId());
        documentRepository.save(document);
    }

    private boolean wouldCreateCircularReference(UUID documentId, UUID newParentId, UUID userId) {
        UUID currentId = newParentId;
        Set<UUID> visited = new HashSet<>();

        while (currentId != null) {
            if (currentId.equals(documentId)) {
                return true;
            }
            if (visited.contains(currentId)) {
                break;
            }
            visited.add(currentId);

            Optional<Document> parent = documentRepository.findByIdAndUserId(currentId, userId);
            if (parent.isEmpty()) {
                break;
            }
            currentId = parent.get().getParentId();
        }

        return false;
    }

    @Transactional
    @CacheEvict(value = "documentTree", key = "#root.target.getCurrentUserId()")
    public void deleteDocument(UUID id) {
        UUID userId = getCurrentUserId();

        // Only owner can delete documents
        if (!permissionService.isOwner(id, userId)) {
            throw new ForbiddenException("Only the document owner can delete documents");
        }

        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));

        documentRepository.delete(document);

        // Delete from MongoDB (if exists)
        try {
            documentContentRepository.deleteById(id.toString());
            log.info("Deleted document content from MongoDB for document: {}", id);
        } catch (Exception e) {
            log.warn("Failed to delete document content from MongoDB: {}", e.getMessage());
        }

        // Delete from Elasticsearch
        documentSearchRepository.deleteById(id.toString());
    }

    /**
     * Search documents using Elasticsearch with fuzzy matching and ranking.
     * Supports pagination and returns results ranked by relevance.
     */
    public SearchResponse searchDocuments(SearchRequest request) {
        UUID userId = getCurrentUserId();

        // Create pageable
        Pageable pageable = PageRequest.of(
                request.getPage(),
                request.getSize()
        );

        // Execute search using Elasticsearch
        Page<DocumentSearchIndex> searchPage = documentSearchRepository.searchByUserIdAndQuery(
                userId.toString(),
                request.getQuery(),
                pageable
        );

        // Convert search results to Document entities
        List<Document> documents = searchPage.getContent().stream()
                .map(this::convertSearchIndexToDocument)
                .collect(Collectors.toList());

        // Build response
        SearchResponse response = new SearchResponse();
        response.setResults(documents);
        response.setTotalResults(searchPage.getTotalElements());
        response.setCurrentPage(searchPage.getNumber());
        response.setPageSize(searchPage.getSize());
        response.setTotalPages(searchPage.getTotalPages());
        response.setHasMore(searchPage.hasNext());

        return response;
    }

    /**
     * Convert DocumentSearchIndex to Document entity.
     */
    private Document convertSearchIndexToDocument(DocumentSearchIndex searchIndex) {
        Document document = new Document();
        document.setId(UUID.fromString(searchIndex.getId()));
        document.setUserId(UUID.fromString(searchIndex.getUserId()));
        document.setParentId(searchIndex.getParentId() != null ? UUID.fromString(searchIndex.getParentId()) : null);
        document.setTitle(searchIndex.getTitle());
        document.setContent(searchIndex.getContent());
        document.setCreatedAt(searchIndex.getCreatedAt());
        document.setUpdatedAt(searchIndex.getUpdatedAt());
        return document;
    }
}
