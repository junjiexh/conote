package com.conote.controller;

import com.conote.dto.CreateDocumentRequest;
import com.conote.dto.DocumentTreeNode;
import com.conote.dto.MoveDocumentRequest;
import com.conote.dto.UpdateDocumentRequest;
import com.conote.model.Document;
import com.conote.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    @Autowired
    private DocumentService documentService;

    @GetMapping
    public ResponseEntity<List<DocumentTreeNode>> getAllDocuments() {
        List<DocumentTreeNode> tree = documentService.getDocumentTree();
        return ResponseEntity.ok(tree);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Document> getDocument(@PathVariable UUID id) {
        try {
            Document document = documentService.getDocument(id);
            return ResponseEntity.ok(document);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<Document> createDocument(@Valid @RequestBody CreateDocumentRequest request) {
        try {
            Document document = documentService.createDocument(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(document);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Document> updateDocument(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateDocumentRequest request) {
        try {
            Document document = documentService.updateDocument(id, request);
            return ResponseEntity.ok(document);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{id}/move")
    public ResponseEntity<Void> moveDocument(
            @PathVariable UUID id,
            @Valid @RequestBody MoveDocumentRequest request) {
        try {
            documentService.moveDocument(id, request);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID id) {
        try {
            documentService.deleteDocument(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
