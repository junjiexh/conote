package com.conote.repository;

import com.conote.model.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest
@DisplayName("DocumentRepository Database Tests")
class DocumentRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private DocumentRepository documentRepository;

    private UUID user1Id;
    private UUID user2Id;

    @BeforeEach
    void setUp() {
        user1Id = UUID.randomUUID();
        user2Id = UUID.randomUUID();
    }

    private Document createDocument(UUID userId, UUID parentId, String title) {
        Document doc = new Document();
        doc.setUserId(userId);
        doc.setParentId(parentId);
        doc.setTitle(title);
        return doc;
    }

    @Test
    @DisplayName("Should save and retrieve document")
    void testSaveAndRetrieve() {
        // Arrange
        Document document = createDocument(user1Id, null, "Test Document");

        // Act
        Document saved = documentRepository.save(document);
        Document retrieved = entityManager.find(Document.class, saved.getId());

        // Assert
        assertThat(retrieved).isNotNull();
        assertThat(retrieved.getId()).isEqualTo(saved.getId());
        assertThat(retrieved.getTitle()).isEqualTo("Test Document");
        assertThat(retrieved.getUserId()).isEqualTo(user1Id);
    }

    @Test
    @DisplayName("Should find all documents by user ID")
    void testFindByUserId() {
        // Arrange
        Document doc1 = createDocument(user1Id, null, "Doc 1");
        Document doc2 = createDocument(user1Id, null, "Doc 2");
        Document doc3 = createDocument(user2Id, null, "Doc 3");

        entityManager.persist(doc1);
        entityManager.persist(doc2);
        entityManager.persist(doc3);
        entityManager.flush();

        // Act
        List<Document> user1Docs = documentRepository.findByUserId(user1Id);

        // Assert
        assertThat(user1Docs).hasSize(2);
        assertThat(user1Docs).extracting(Document::getTitle)
                .containsExactlyInAnyOrder("Doc 1", "Doc 2");
    }

    @Test
    @DisplayName("Should find document by ID and user ID")
    void testFindByIdAndUserId() {
        // Arrange
        Document document = createDocument(user1Id, null, "Test Document");
        Document saved = entityManager.persistAndFlush(document);

        // Act
        Optional<Document> found = documentRepository.findByIdAndUserId(saved.getId(), user1Id);

        // Assert
        assertThat(found).isPresent();
        assertThat(found.get().getTitle()).isEqualTo("Test Document");
    }

    @Test
    @DisplayName("Should not find document with wrong user ID")
    void testFindByIdAndUserId_WrongUser() {
        // Arrange
        Document document = createDocument(user1Id, null, "Test Document");
        Document saved = entityManager.persistAndFlush(document);

        // Act
        Optional<Document> found = documentRepository.findByIdAndUserId(saved.getId(), user2Id);

        // Assert
        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("Should return empty list when user has no documents")
    void testFindByUserId_NoDocuments() {
        // Act
        List<Document> documents = documentRepository.findByUserId(UUID.randomUUID());

        // Assert
        assertThat(documents).isEmpty();
    }

    @Test
    @DisplayName("Should handle parent-child relationships")
    void testParentChildRelationship() {
        // Arrange
        Document parent = createDocument(user1Id, null, "Parent");
        Document savedParent = entityManager.persistAndFlush(parent);

        Document child = createDocument(user1Id, savedParent.getId(), "Child");
        Document savedChild = entityManager.persistAndFlush(child);

        // Act
        Document retrievedChild = documentRepository.findById(savedChild.getId()).orElseThrow();

        // Assert
        assertThat(retrievedChild.getParentId()).isEqualTo(savedParent.getId());
    }

    @Test
    @DisplayName("Should handle multi-level hierarchy")
    void testMultiLevelHierarchy() {
        // Arrange
        Document root = createDocument(user1Id, null, "Root");
        Document savedRoot = entityManager.persistAndFlush(root);

        Document level1 = createDocument(user1Id, savedRoot.getId(), "Level 1");
        Document savedLevel1 = entityManager.persistAndFlush(level1);

        Document level2 = createDocument(user1Id, savedLevel1.getId(), "Level 2");
        Document savedLevel2 = entityManager.persistAndFlush(level2);

        // Act
        List<Document> allDocs = documentRepository.findByUserId(user1Id);

        // Assert
        assertThat(allDocs).hasSize(3);

        // Verify hierarchy
        Document rootDoc = allDocs.stream()
                .filter(d -> d.getParentId() == null)
                .findFirst()
                .orElseThrow();
        assertThat(rootDoc.getTitle()).isEqualTo("Root");

        Document level1Doc = allDocs.stream()
                .filter(d -> d.getParentId() != null && d.getParentId().equals(rootDoc.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(level1Doc.getTitle()).isEqualTo("Level 1");

        Document level2Doc = allDocs.stream()
                .filter(d -> d.getParentId() != null && d.getParentId().equals(level1Doc.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(level2Doc.getTitle()).isEqualTo("Level 2");
    }

    @Test
    @DisplayName("Should delete document by ID")
    void testDeleteDocument() {
        // Arrange
        Document document = createDocument(user1Id, null, "Test Document");
        Document saved = entityManager.persistAndFlush(document);
        UUID docId = saved.getId();

        // Act
        documentRepository.deleteById(docId);
        entityManager.flush();

        // Assert
        Optional<Document> found = documentRepository.findById(docId);
        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("Should update document content")
    void testUpdateDocument() {
        // Arrange
        Document document = createDocument(user1Id, null, "Original Title");
        Document saved = entityManager.persistAndFlush(document);

        // Act
        saved.setTitle("Updated Title");
        documentRepository.save(saved);
        entityManager.flush();
        entityManager.clear();

        // Assert
        Document updated = documentRepository.findById(saved.getId()).orElseThrow();
        assertThat(updated.getTitle()).isEqualTo("Updated Title");
    }

    @Test
    @DisplayName("Should isolate documents between users")
    void testUserIsolation() {
        // Arrange
        Document user1Doc = createDocument(user1Id, null, "User 1 Doc");
        Document user2Doc = createDocument(user2Id, null, "User 2 Doc");

        entityManager.persist(user1Doc);
        entityManager.persist(user2Doc);
        entityManager.flush();

        // Act
        List<Document> user1Docs = documentRepository.findByUserId(user1Id);
        List<Document> user2Docs = documentRepository.findByUserId(user2Id);

        // Assert
        assertThat(user1Docs).hasSize(1);
        assertThat(user1Docs.get(0).getTitle()).isEqualTo("User 1 Doc");

        assertThat(user2Docs).hasSize(1);
        assertThat(user2Docs.get(0).getTitle()).isEqualTo("User 2 Doc");
    }

    @Test
    @DisplayName("Should handle moving document to different parent")
    void testMoveDocument() {
        // Arrange
        Document parent1 = createDocument(user1Id, null, "Parent 1");
        Document parent2 = createDocument(user1Id, null, "Parent 2");
        Document savedParent1 = entityManager.persistAndFlush(parent1);
        Document savedParent2 = entityManager.persistAndFlush(parent2);

        Document child = createDocument(user1Id, savedParent1.getId(), "Child");
        Document savedChild = entityManager.persistAndFlush(child);

        // Act - Move child from parent1 to parent2
        savedChild.setParentId(savedParent2.getId());
        documentRepository.save(savedChild);
        entityManager.flush();

        // Assert
        Document movedChild = documentRepository.findById(savedChild.getId()).orElseThrow();
        assertThat(movedChild.getParentId()).isEqualTo(savedParent2.getId());
    }

    @Test
    @DisplayName("Should handle moving document to root level")
    void testMoveDocumentToRoot() {
        // Arrange
        Document parent = createDocument(user1Id, null, "Parent");
        Document savedParent = entityManager.persistAndFlush(parent);

        Document child = createDocument(user1Id, savedParent.getId(), "Child");
        Document savedChild = entityManager.persistAndFlush(child);

        // Act - Move child to root
        savedChild.setParentId(null);
        documentRepository.save(savedChild);
        entityManager.flush();

        // Assert
        Document movedChild = documentRepository.findById(savedChild.getId()).orElseThrow();
        assertThat(movedChild.getParentId()).isNull();
    }

    @Test
    @DisplayName("Should persist timestamps automatically")
    void testTimestamps() {
        // Arrange
        Document document = createDocument(user1Id, null, "Test Document");

        // Act
        Document saved = documentRepository.save(document);
        entityManager.flush();

        // Assert
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("Should find multiple children of same parent")
    void testMultipleChildren() {
        // Arrange
        Document parent = createDocument(user1Id, null, "Parent");
        Document savedParent = entityManager.persistAndFlush(parent);

        Document child1 = createDocument(user1Id, savedParent.getId(), "Child 1");
        Document child2 = createDocument(user1Id, savedParent.getId(), "Child 2");
        Document child3 = createDocument(user1Id, savedParent.getId(), "Child 3");

        entityManager.persist(child1);
        entityManager.persist(child2);
        entityManager.persist(child3);
        entityManager.flush();

        // Act
        List<Document> allDocs = documentRepository.findByUserId(user1Id);
        List<Document> children = allDocs.stream()
                .filter(d -> savedParent.getId().equals(d.getParentId()))
                .toList();

        // Assert
        assertThat(children).hasSize(3);
        assertThat(children).extracting(Document::getTitle)
                .containsExactlyInAnyOrder("Child 1", "Child 2", "Child 3");
    }

    @Test
    @DisplayName("Should handle UUID primary keys correctly")
    void testUUIDPrimaryKey() {
        // Arrange
        Document document = createDocument(user1Id, null, "Test Document");

        // Act
        Document saved = documentRepository.save(document);

        // Assert
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getId()).isInstanceOf(UUID.class);
    }

}
