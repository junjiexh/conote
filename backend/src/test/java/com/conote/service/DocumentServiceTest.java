package com.conote.service;

import com.conote.dto.CreateDocumentRequest;
import com.conote.dto.DocumentTreeNode;
import com.conote.dto.MoveDocumentRequest;
import com.conote.dto.UpdateDocumentRequest;
import com.conote.model.Document;
import com.conote.model.User;
import com.conote.repository.DocumentRepository;
import com.conote.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DocumentService Unit Tests")
class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private DocumentService documentService;

    private User testUser;
    private UUID userId;
    private Document testDocument;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        testUser = new User();
        testUser.setId(userId);
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("hashedPassword");

        // Set up security context
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("test@example.com", null, Collections.emptyList())
        );

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        testDocument = createTestDocument(UUID.randomUUID(), null, "Test Document", "Content");
    }

    private Document createTestDocument(UUID id, UUID parentId, String title, String content) {
        Document doc = new Document();
        doc.setId(id);
        doc.setUserId(userId);
        doc.setParentId(parentId);
        doc.setTitle(title);
        doc.setContent(content);
        doc.setCreatedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());
        return doc;
    }

    @Test
    @DisplayName("Should retrieve document tree with proper hierarchy")
    void testGetDocumentTree() {
        // Arrange
        UUID rootId = UUID.randomUUID();
        UUID childId = UUID.randomUUID();
        UUID grandchildId = UUID.randomUUID();

        Document root = createTestDocument(rootId, null, "Root", "Root content");
        Document child = createTestDocument(childId, rootId, "Child", "Child content");
        Document grandchild = createTestDocument(grandchildId, childId, "Grandchild", "Grandchild content");

        List<Document> documents = Arrays.asList(root, child, grandchild);
        when(documentRepository.findByUserId(userId)).thenReturn(documents);

        // Act
        List<DocumentTreeNode> tree = documentService.getDocumentTree();

        // Assert
        assertThat(tree).hasSize(1);
        DocumentTreeNode rootNode = tree.get(0);
        assertThat(rootNode.getTitle()).isEqualTo("Root");
        assertThat(rootNode.getChildren()).hasSize(1);
        assertThat(rootNode.getChildren().get(0).getTitle()).isEqualTo("Child");
        assertThat(rootNode.getChildren().get(0).getChildren()).hasSize(1);
        assertThat(rootNode.getChildren().get(0).getChildren().get(0).getTitle()).isEqualTo("Grandchild");

        verify(documentRepository).findByUserId(userId);
    }

    @Test
    @DisplayName("Should handle multiple root documents")
    void testGetDocumentTree_MultipleRoots() {
        // Arrange
        Document root1 = createTestDocument(UUID.randomUUID(), null, "Root 1", "Content 1");
        Document root2 = createTestDocument(UUID.randomUUID(), null, "Root 2", "Content 2");

        when(documentRepository.findByUserId(userId)).thenReturn(Arrays.asList(root1, root2));

        // Act
        List<DocumentTreeNode> tree = documentService.getDocumentTree();

        // Assert
        assertThat(tree).hasSize(2);
        assertThat(tree).extracting(DocumentTreeNode::getTitle).containsExactlyInAnyOrder("Root 1", "Root 2");
    }

    @Test
    @DisplayName("Should return empty tree when user has no documents")
    void testGetDocumentTree_EmptyTree() {
        // Arrange
        when(documentRepository.findByUserId(userId)).thenReturn(Collections.emptyList());

        // Act
        List<DocumentTreeNode> tree = documentService.getDocumentTree();

        // Assert
        assertThat(tree).isEmpty();
    }

    @Test
    @DisplayName("Should retrieve document by ID successfully")
    void testGetDocument_Success() {
        // Arrange
        UUID docId = testDocument.getId();
        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.of(testDocument));

        // Act
        Document result = documentService.getDocument(docId);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(docId);
        assertThat(result.getTitle()).isEqualTo("Test Document");
        verify(documentRepository).findByIdAndUserId(docId, userId);
    }

    @Test
    @DisplayName("Should throw exception when document not found")
    void testGetDocument_NotFound() {
        // Arrange
        UUID docId = UUID.randomUUID();
        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> documentService.getDocument(docId))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Document not found");
    }

    @Test
    @DisplayName("Should create root document successfully")
    void testCreateDocument_RootDocument() {
        // Arrange
        CreateDocumentRequest request = new CreateDocumentRequest();
        request.setTitle("New Document");
        request.setParentId(null);

        Document savedDocument = createTestDocument(UUID.randomUUID(), null, "New Document", "");
        when(documentRepository.save(any(Document.class))).thenReturn(savedDocument);

        // Act
        Document result = documentService.createDocument(request);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getTitle()).isEqualTo("New Document");
        assertThat(result.getParentId()).isNull();
        assertThat(result.getContent()).isEmpty();

        verify(documentRepository).save(any(Document.class));
    }

    @Test
    @DisplayName("Should create child document with valid parent")
    void testCreateDocument_ChildDocument() {
        // Arrange
        UUID parentId = UUID.randomUUID();
        Document parentDoc = createTestDocument(parentId, null, "Parent", "Content");

        CreateDocumentRequest request = new CreateDocumentRequest();
        request.setTitle("Child Document");
        request.setParentId(parentId);

        when(documentRepository.findByIdAndUserId(parentId, userId)).thenReturn(Optional.of(parentDoc));

        Document savedDocument = createTestDocument(UUID.randomUUID(), parentId, "Child Document", "");
        when(documentRepository.save(any(Document.class))).thenReturn(savedDocument);

        // Act
        Document result = documentService.createDocument(request);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getTitle()).isEqualTo("Child Document");
        assertThat(result.getParentId()).isEqualTo(parentId);

        verify(documentRepository).findByIdAndUserId(parentId, userId);
        verify(documentRepository).save(any(Document.class));
    }

    @Test
    @DisplayName("Should throw exception when parent document not found")
    void testCreateDocument_ParentNotFound() {
        // Arrange
        UUID parentId = UUID.randomUUID();
        CreateDocumentRequest request = new CreateDocumentRequest();
        request.setTitle("Child Document");
        request.setParentId(parentId);

        when(documentRepository.findByIdAndUserId(parentId, userId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> documentService.createDocument(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Parent document not found");
    }

    @Test
    @DisplayName("Should update document title successfully")
    void testUpdateDocument_Title() {
        // Arrange
        UUID docId = testDocument.getId();
        UpdateDocumentRequest request = new UpdateDocumentRequest();
        request.setTitle("Updated Title");

        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.of(testDocument));
        when(documentRepository.save(testDocument)).thenReturn(testDocument);

        // Act
        Document result = documentService.updateDocument(docId, request);

        // Assert
        assertThat(result.getTitle()).isEqualTo("Updated Title");
        verify(documentRepository).save(testDocument);
    }

    @Test
    @DisplayName("Should update document content successfully")
    void testUpdateDocument_Content() {
        // Arrange
        UUID docId = testDocument.getId();
        UpdateDocumentRequest request = new UpdateDocumentRequest();
        request.setContent("Updated Content");

        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.of(testDocument));
        when(documentRepository.save(testDocument)).thenReturn(testDocument);

        // Act
        Document result = documentService.updateDocument(docId, request);

        // Assert
        assertThat(result.getContent()).isEqualTo("Updated Content");
        verify(documentRepository).save(testDocument);
    }

    @Test
    @DisplayName("Should update both title and content")
    void testUpdateDocument_TitleAndContent() {
        // Arrange
        UUID docId = testDocument.getId();
        UpdateDocumentRequest request = new UpdateDocumentRequest();
        request.setTitle("New Title");
        request.setContent("New Content");

        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.of(testDocument));
        when(documentRepository.save(testDocument)).thenReturn(testDocument);

        // Act
        Document result = documentService.updateDocument(docId, request);

        // Assert
        assertThat(result.getTitle()).isEqualTo("New Title");
        assertThat(result.getContent()).isEqualTo("New Content");
    }

    @Test
    @DisplayName("Should move document to new parent successfully")
    void testMoveDocument_Success() {
        // Arrange
        UUID docId = UUID.randomUUID();
        UUID newParentId = UUID.randomUUID();

        Document doc = createTestDocument(docId, null, "Document", "Content");
        Document newParent = createTestDocument(newParentId, null, "New Parent", "Content");

        MoveDocumentRequest request = new MoveDocumentRequest();
        request.setNewParentId(newParentId);

        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.of(doc));
        when(documentRepository.findByIdAndUserId(newParentId, userId)).thenReturn(Optional.of(newParent));
        when(documentRepository.save(doc)).thenReturn(doc);

        // Act
        documentService.moveDocument(docId, request);

        // Assert
        assertThat(doc.getParentId()).isEqualTo(newParentId);
        verify(documentRepository).save(doc);
    }

    @Test
    @DisplayName("Should move document to root (null parent)")
    void testMoveDocument_ToRoot() {
        // Arrange
        UUID docId = UUID.randomUUID();
        Document doc = createTestDocument(docId, UUID.randomUUID(), "Document", "Content");

        MoveDocumentRequest request = new MoveDocumentRequest();
        request.setNewParentId(null);

        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.of(doc));
        when(documentRepository.save(doc)).thenReturn(doc);

        // Act
        documentService.moveDocument(docId, request);

        // Assert
        assertThat(doc.getParentId()).isNull();
        verify(documentRepository).save(doc);
    }

    @Test
    @DisplayName("Should detect circular reference: direct parent-child cycle")
    void testMoveDocument_CircularReference_Direct() {
        // Arrange
        UUID parentId = UUID.randomUUID();
        UUID childId = UUID.randomUUID();

        Document parent = createTestDocument(parentId, null, "Parent", "Content");
        Document child = createTestDocument(childId, parentId, "Child", "Content");

        // Try to move parent under child (would create A -> B -> A cycle)
        MoveDocumentRequest request = new MoveDocumentRequest();
        request.setNewParentId(childId);

        when(documentRepository.findByIdAndUserId(parentId, userId)).thenReturn(Optional.of(parent));
        when(documentRepository.findByIdAndUserId(childId, userId)).thenReturn(Optional.of(child));

        // Act & Assert
        assertThatThrownBy(() -> documentService.moveDocument(parentId, request))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Moving document would create a circular reference");
    }

    @Test
    @DisplayName("Should detect circular reference: multi-level cycle")
    void testMoveDocument_CircularReference_MultiLevel() {
        // Arrange
        UUID aId = UUID.randomUUID();
        UUID bId = UUID.randomUUID();
        UUID cId = UUID.randomUUID();

        // A -> B -> C, trying to move A under C (would create A -> B -> C -> A)
        Document a = createTestDocument(aId, null, "A", "Content");
        Document b = createTestDocument(bId, aId, "B", "Content");
        Document c = createTestDocument(cId, bId, "C", "Content");

        MoveDocumentRequest request = new MoveDocumentRequest();
        request.setNewParentId(cId);

        when(documentRepository.findByIdAndUserId(aId, userId)).thenReturn(Optional.of(a));
        when(documentRepository.findByIdAndUserId(cId, userId)).thenReturn(Optional.of(c));
        when(documentRepository.findByIdAndUserId(bId, userId)).thenReturn(Optional.of(b));

        // Act & Assert
        assertThatThrownBy(() -> documentService.moveDocument(aId, request))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Moving document would create a circular reference");
    }

    @Test
    @DisplayName("Should allow moving to sibling (no circular reference)")
    void testMoveDocument_ToSibling_Success() {
        // Arrange
        UUID parentId = UUID.randomUUID();
        UUID child1Id = UUID.randomUUID();
        UUID child2Id = UUID.randomUUID();

        Document parent = createTestDocument(parentId, null, "Parent", "Content");
        Document child1 = createTestDocument(child1Id, parentId, "Child 1", "Content");
        Document child2 = createTestDocument(child2Id, parentId, "Child 2", "Content");

        // Move child1 under child2 (valid move)
        MoveDocumentRequest request = new MoveDocumentRequest();
        request.setNewParentId(child2Id);

        when(documentRepository.findByIdAndUserId(child1Id, userId)).thenReturn(Optional.of(child1));
        when(documentRepository.findByIdAndUserId(child2Id, userId)).thenReturn(Optional.of(child2));
        when(documentRepository.save(child1)).thenReturn(child1);

        // Act
        documentService.moveDocument(child1Id, request);

        // Assert
        assertThat(child1.getParentId()).isEqualTo(child2Id);
        verify(documentRepository).save(child1);
    }

    @Test
    @DisplayName("Should throw exception when new parent not found")
    void testMoveDocument_NewParentNotFound() {
        // Arrange
        UUID docId = UUID.randomUUID();
        UUID newParentId = UUID.randomUUID();

        Document doc = createTestDocument(docId, null, "Document", "Content");

        MoveDocumentRequest request = new MoveDocumentRequest();
        request.setNewParentId(newParentId);

        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.of(doc));
        when(documentRepository.findByIdAndUserId(newParentId, userId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> documentService.moveDocument(docId, request))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("New parent document not found");
    }

    @Test
    @DisplayName("Should delete document successfully")
    void testDeleteDocument_Success() {
        // Arrange
        UUID docId = testDocument.getId();
        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.of(testDocument));

        // Act
        documentService.deleteDocument(docId);

        // Assert
        verify(documentRepository).delete(testDocument);
    }

    @Test
    @DisplayName("Should throw exception when deleting non-existent document")
    void testDeleteDocument_NotFound() {
        // Arrange
        UUID docId = UUID.randomUUID();
        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> documentService.deleteDocument(docId))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Document not found");
    }

    @Test
    @DisplayName("Should enforce user isolation in document operations")
    void testUserIsolation() {
        // Arrange
        UUID docId = UUID.randomUUID();

        // Document belongs to different user
        when(documentRepository.findByIdAndUserId(docId, userId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> documentService.getDocument(docId))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Document not found");

        verify(documentRepository).findByIdAndUserId(docId, userId);
    }
}
