package com.conote.controller;

import com.conote.dto.CreateDocumentRequest;
import com.conote.dto.DocumentTreeNode;
import com.conote.dto.MoveDocumentRequest;
import com.conote.dto.UpdateDocumentRequest;
import com.conote.model.Document;
import com.conote.security.JwtAuthenticationFilter;
import com.conote.service.DocumentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DocumentController.class)
@DisplayName("DocumentController Integration Tests")
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DocumentService documentService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private UUID testDocId;
    private Document testDocument;
    private DocumentTreeNode testTreeNode;

    @BeforeEach
    void setUp() {
        testDocId = UUID.randomUUID();

        testDocument = new Document();
        testDocument.setId(testDocId);
        testDocument.setUserId(UUID.randomUUID());
        testDocument.setTitle("Test Document");
        testDocument.setContent("Test Content");
        testDocument.setCreatedAt(LocalDateTime.now());
        testDocument.setUpdatedAt(LocalDateTime.now());

        testTreeNode = new DocumentTreeNode();
        testTreeNode.setId(testDocId);
        testTreeNode.setTitle("Test Document");
        testTreeNode.setContent("Test Content");
        testTreeNode.setChildren(Collections.emptyList());
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/documents should return document tree")
    void testGetAllDocuments() throws Exception {
        // Arrange
        List<DocumentTreeNode> tree = Arrays.asList(testTreeNode);
        when(documentService.getDocumentTree()).thenReturn(tree);

        // Act & Assert
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(testDocId.toString()))
                .andExpect(jsonPath("$[0].title").value("Test Document"))
                .andExpect(jsonPath("$[0].content").value("Test Content"));

        verify(documentService).getDocumentTree();
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/documents should return empty array when no documents")
    void testGetAllDocuments_Empty() throws Exception {
        // Arrange
        when(documentService.getDocumentTree()).thenReturn(Collections.emptyList());

        // Act & Assert
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/documents/{id} should return document when found")
    void testGetDocument_Success() throws Exception {
        // Arrange
        when(documentService.getDocument(testDocId)).thenReturn(testDocument);

        // Act & Assert
        mockMvc.perform(get("/api/documents/{id}", testDocId))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").value(testDocId.toString()))
                .andExpect(jsonPath("$.title").value("Test Document"))
                .andExpect(jsonPath("$.content").value("Test Content"));

        verify(documentService).getDocument(testDocId);
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/documents/{id} should return 404 when not found")
    void testGetDocument_NotFound() throws Exception {
        // Arrange
        when(documentService.getDocument(any(UUID.class)))
                .thenThrow(new RuntimeException("Document not found"));

        // Act & Assert
        mockMvc.perform(get("/api/documents/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/documents should create document successfully")
    void testCreateDocument_Success() throws Exception {
        // Arrange
        CreateDocumentRequest request = new CreateDocumentRequest();
        request.setTitle("New Document");
        request.setParentId(null);

        when(documentService.createDocument(any(CreateDocumentRequest.class)))
                .thenReturn(testDocument);

        // Act & Assert
        mockMvc.perform(post("/api/documents")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(testDocId.toString()))
                .andExpect(jsonPath("$.title").value("Test Document"));

        verify(documentService).createDocument(any(CreateDocumentRequest.class));
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/documents should return 400 with invalid title")
    void testCreateDocument_InvalidTitle() throws Exception {
        // Arrange
        CreateDocumentRequest request = new CreateDocumentRequest();
        request.setTitle(""); // Invalid: blank title
        request.setParentId(null);

        // Act & Assert
        mockMvc.perform(post("/api/documents")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(documentService, never()).createDocument(any());
    }

    @Test
    @WithMockUser
    @DisplayName("POST /api/documents should return 400 when parent not found")
    void testCreateDocument_ParentNotFound() throws Exception {
        // Arrange
        CreateDocumentRequest request = new CreateDocumentRequest();
        request.setTitle("New Document");
        request.setParentId(UUID.randomUUID());

        when(documentService.createDocument(any(CreateDocumentRequest.class)))
                .thenThrow(new RuntimeException("Parent document not found"));

        // Act & Assert
        mockMvc.perform(post("/api/documents")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    @DisplayName("PUT /api/documents/{id} should update document successfully")
    void testUpdateDocument_Success() throws Exception {
        // Arrange
        UpdateDocumentRequest request = new UpdateDocumentRequest();
        request.setTitle("Updated Title");
        request.setContent("Updated Content");

        Document updatedDoc = new Document();
        updatedDoc.setId(testDocId);
        updatedDoc.setTitle("Updated Title");
        updatedDoc.setContent("Updated Content");

        when(documentService.updateDocument(eq(testDocId), any(UpdateDocumentRequest.class)))
                .thenReturn(updatedDoc);

        // Act & Assert
        mockMvc.perform(put("/api/documents/{id}", testDocId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated Title"))
                .andExpect(jsonPath("$.content").value("Updated Content"));

        verify(documentService).updateDocument(eq(testDocId), any(UpdateDocumentRequest.class));
    }

    @Test
    @WithMockUser
    @DisplayName("PUT /api/documents/{id} should return 404 when document not found")
    void testUpdateDocument_NotFound() throws Exception {
        // Arrange
        UpdateDocumentRequest request = new UpdateDocumentRequest();
        request.setTitle("Updated Title");

        when(documentService.updateDocument(any(UUID.class), any(UpdateDocumentRequest.class)))
                .thenThrow(new RuntimeException("Document not found"));

        // Act & Assert
        mockMvc.perform(put("/api/documents/{id}", UUID.randomUUID())
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    @DisplayName("PATCH /api/documents/{id}/move should move document successfully")
    void testMoveDocument_Success() throws Exception {
        // Arrange
        UUID newParentId = UUID.randomUUID();
        MoveDocumentRequest request = new MoveDocumentRequest();
        request.setNewParentId(newParentId);

        doNothing().when(documentService).moveDocument(eq(testDocId), any(MoveDocumentRequest.class));

        // Act & Assert
        mockMvc.perform(patch("/api/documents/{id}/move", testDocId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(documentService).moveDocument(eq(testDocId), any(MoveDocumentRequest.class));
    }

    @Test
    @WithMockUser
    @DisplayName("PATCH /api/documents/{id}/move should return 400 on circular reference")
    void testMoveDocument_CircularReference() throws Exception {
        // Arrange
        MoveDocumentRequest request = new MoveDocumentRequest();
        request.setNewParentId(UUID.randomUUID());

        doThrow(new RuntimeException("Moving document would create a circular reference"))
                .when(documentService).moveDocument(any(UUID.class), any(MoveDocumentRequest.class));

        // Act & Assert
        mockMvc.perform(patch("/api/documents/{id}/move", testDocId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    @DisplayName("DELETE /api/documents/{id} should delete document successfully")
    void testDeleteDocument_Success() throws Exception {
        // Arrange
        doNothing().when(documentService).deleteDocument(testDocId);

        // Act & Assert
        mockMvc.perform(delete("/api/documents/{id}", testDocId)
                        .with(csrf()))
                .andExpect(status().isNoContent());

        verify(documentService).deleteDocument(testDocId);
    }

    @Test
    @WithMockUser
    @DisplayName("DELETE /api/documents/{id} should return 404 when not found")
    void testDeleteDocument_NotFound() throws Exception {
        // Arrange
        doThrow(new RuntimeException("Document not found"))
                .when(documentService).deleteDocument(any(UUID.class));

        // Act & Assert
        mockMvc.perform(delete("/api/documents/{id}", UUID.randomUUID())
                        .with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Should require authentication for all endpoints")
    void testRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    @DisplayName("Should handle hierarchical document tree structure")
    void testGetAllDocuments_Hierarchy() throws Exception {
        // Arrange
        DocumentTreeNode child = new DocumentTreeNode();
        child.setId(UUID.randomUUID());
        child.setTitle("Child");
        child.setChildren(Collections.emptyList());

        testTreeNode.setChildren(Arrays.asList(child));

        when(documentService.getDocumentTree()).thenReturn(Arrays.asList(testTreeNode));

        // Act & Assert
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].children", hasSize(1)))
                .andExpect(jsonPath("$[0].children[0].title").value("Child"));
    }
}
