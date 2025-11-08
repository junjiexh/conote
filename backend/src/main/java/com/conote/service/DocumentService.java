package com.conote.service;

import com.conote.dto.CreateDocumentRequest;
import com.conote.dto.DocumentTreeNode;
import com.conote.dto.MoveDocumentRequest;
import com.conote.dto.UpdateDocumentRequest;
import com.conote.model.Document;
import com.conote.model.User;
import com.conote.repository.DocumentRepository;
import com.conote.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class DocumentService {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private UserRepository userRepository;

    private UUID getCurrentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

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
                .orElseThrow(() -> new RuntimeException("Document not found"));
    }

    @Transactional
    public Document createDocument(CreateDocumentRequest request) {
        UUID userId = getCurrentUserId();

        // Verify parent exists if parentId is provided
        if (request.getParentId() != null) {
            documentRepository.findByIdAndUserId(request.getParentId(), userId)
                    .orElseThrow(() -> new RuntimeException("Parent document not found"));
        }

        Document document = new Document();
        document.setUserId(userId);
        document.setParentId(request.getParentId());
        document.setTitle(request.getTitle());
        document.setContent("");

        return documentRepository.save(document);
    }

    @Transactional
    public Document updateDocument(UUID id, UpdateDocumentRequest request) {
        UUID userId = getCurrentUserId();
        Document document = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        if (request.getTitle() != null) {
            document.setTitle(request.getTitle());
        }
        if (request.getContent() != null) {
            document.setContent(request.getContent());
        }

        return documentRepository.save(document);
    }

    @Transactional
    public void moveDocument(UUID id, MoveDocumentRequest request) {
        UUID userId = getCurrentUserId();
        Document document = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        // Verify new parent exists if provided
        if (request.getNewParentId() != null) {
            documentRepository.findByIdAndUserId(request.getNewParentId(), userId)
                    .orElseThrow(() -> new RuntimeException("New parent document not found"));

            // Check for circular reference
            if (wouldCreateCircularReference(id, request.getNewParentId(), userId)) {
                throw new RuntimeException("Moving document would create a circular reference");
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
    public void deleteDocument(UUID id) {
        UUID userId = getCurrentUserId();
        Document document = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Document not found"));
        documentRepository.delete(document);
    }
}
