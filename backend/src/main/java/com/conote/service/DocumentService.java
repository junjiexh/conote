package com.conote.service;

import com.conote.dto.*;
import com.conote.exception.BadRequestException;
import com.conote.exception.ResourceNotFoundException;
import com.conote.model.Document;
import com.conote.model.User;
import com.conote.repository.DocumentRepository;
import com.conote.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
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
@Service
public class DocumentService {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private UserRepository userRepository;

    private UUID getCurrentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return user.getId();
    }

    /**
     * Get document tree with Redis caching.
     * Cache is evicted when documents are created, updated, moved, or deleted.
     */
    @Cacheable(value = "documentTree", key = "#root.target.currentUserId")
    public List<DocumentTreeNode> getDocumentTree() {
        UUID userId = getCurrentUserId();
        List<Document> documents = documentRepository.findByUserId(userId);
        return buildTree(documents);
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
        return documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));
    }

    @Transactional
    @CacheEvict(value = "documentTree", key = "#root.target.currentUserId")
    public Document createDocument(CreateDocumentRequest request) {
        UUID userId = getCurrentUserId();

        // Verify parent exists if parentId is provided
        if (request.getParentId() != null) {
            documentRepository.findByIdAndUserId(request.getParentId(), userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent document", "id", request.getParentId()));
        }

        Document document = new Document();
        document.setUserId(userId);
        document.setParentId(request.getParentId());
        document.setTitle(request.getTitle());
        document.setContent("");

        return documentRepository.save(document);
    }

    @Transactional
    @CacheEvict(value = "documentTree", key = "#root.target.currentUserId")
    public Document updateDocument(UUID id, UpdateDocumentRequest request) {
        UUID userId = getCurrentUserId();
        Document document = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));

        if (request.getTitle() != null) {
            document.setTitle(request.getTitle());
        }
        if (request.getContent() != null) {
            document.setContent(request.getContent());
        }

        return documentRepository.save(document);
    }

    @Transactional
    @CacheEvict(value = "documentTree", key = "#root.target.currentUserId")
    public void moveDocument(UUID id, MoveDocumentRequest request) {
        UUID userId = getCurrentUserId();
        Document document = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));

        // Verify new parent exists if provided
        if (request.getNewParentId() != null) {
            documentRepository.findByIdAndUserId(request.getNewParentId(), userId)
                    .orElseThrow(() -> new ResourceNotFoundException("New parent document", "id", request.getNewParentId()));

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
    @CacheEvict(value = "documentTree", key = "#root.target.currentUserId")
    public void deleteDocument(UUID id) {
        UUID userId = getCurrentUserId();
        Document document = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));
        documentRepository.delete(document);
    }

    /**
     * Search documents using PostgreSQL full-text search with ranking.
     * Supports pagination and returns results ranked by relevance.
     */
    public SearchResponse searchDocuments(SearchRequest request) {
        UUID userId = getCurrentUserId();

        // Convert search query to tsquery format (replace spaces with &)
        String tsQuery = formatSearchQuery(request.getQuery());

        // Create pageable
        Pageable pageable = PageRequest.of(
                request.getPage(),
                request.getSize()
        );

        // Execute search
        Page<Document> page = documentRepository.searchDocumentsWithPagination(
                userId,
                tsQuery,
                pageable
        );

        // Build response
        SearchResponse response = new SearchResponse();
        response.setResults(page.getContent());
        response.setTotalResults(page.getTotalElements());
        response.setCurrentPage(page.getNumber());
        response.setPageSize(page.getSize());
        response.setTotalPages(page.getTotalPages());
        response.setHasMore(page.hasNext());

        return response;
    }

    /**
     * Format search query for PostgreSQL to_tsquery.
     * Replaces spaces with & operator and handles special characters.
     */
    private String formatSearchQuery(String query) {
        if (query == null || query.isBlank()) {
            return "";
        }
        // Remove special characters except & and |
        String cleaned = query.replaceAll("[^a-zA-Z0-9\\s&|]", "");
        // Replace multiple spaces with single space
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        // If no operators present, treat as AND search (replace spaces with &)
        if (!cleaned.contains("&") && !cleaned.contains("|")) {
            cleaned = cleaned.replace(" ", " & ");
        }
        return cleaned;
    }
}
