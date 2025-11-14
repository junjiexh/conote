package com.conote.service;

import com.conote.dto.*;
import com.conote.exception.BadRequestException;
import com.conote.exception.ResourceNotFoundException;
import com.conote.model.Document;
import com.conote.model.DocumentSearchIndex;
import com.conote.model.User;
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
    private final DocumentSearchRepository documentSearchRepository;
    private final UserRepository userRepository;

    public UUID getCurrentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return user.getId();
    }

    /**
     * Get document tree with Redis caching.
     * Cache is evicted when documents are created, updated, moved, or deleted.
     */
    @Cacheable(value = "documentTree", key = "#root.target.getCurrentUserId()")
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
    @CacheEvict(value = "documentTree", key = "#root.target.getCurrentUserId()")
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
        Document document = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));

        if (request.getTitle() != null) {
            document.setTitle(request.getTitle());
        }
        if (request.getContent() != null) {
            document.setContent(request.getContent());
        }

        Document savedDocument = documentRepository.save(document);
        log.info("updated document is {}", document);

        // Update in Elasticsearch
        DocumentSearchIndex searchIndex = DocumentSearchIndex.fromDocument(savedDocument);
        documentSearchRepository.save(searchIndex);

        return savedDocument;
    }

    @Transactional
    @CacheEvict(value = "documentTree", key = "#root.target.getCurrentUserId()")
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
    @CacheEvict(value = "documentTree", key = "#root.target.getCurrentUserId()")
    public void deleteDocument(UUID id) {
        UUID userId = getCurrentUserId();
        Document document = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));

        documentRepository.delete(document);

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
