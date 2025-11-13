package com.conote.repository;

import com.conote.model.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {
    List<Document> findByUserId(UUID userId);
    Optional<Document> findByIdAndUserId(UUID id, UUID userId);
    void deleteByIdAndUserId(UUID id, UUID userId);

    /**
     * Full-text search using PostgreSQL tsvector with ranking.
     * Searches both title (weight A) and content (weight B).
     */
    @Query(value = """
        SELECT d.* FROM documents d
        WHERE d.user_id = :userId
        AND d.search_vector @@ to_tsquery('english', :query)
        ORDER BY ts_rank(d.search_vector, to_tsquery('english', :query)) DESC
        """, nativeQuery = true)
    List<Document> searchDocuments(@Param("userId") UUID userId, @Param("query") String query);

    /**
     * Search with pagination support.
     */
    @Query(value = """
        SELECT d.* FROM documents d
        WHERE d.user_id = :userId
        AND d.search_vector @@ to_tsquery('english', :query)
        ORDER BY ts_rank(d.search_vector, to_tsquery('english', :query)) DESC
        """,
        countQuery = """
        SELECT COUNT(*) FROM documents d
        WHERE d.user_id = :userId
        AND d.search_vector @@ to_tsquery('english', :query)
        """,
        nativeQuery = true)
    Page<Document> searchDocumentsWithPagination(@Param("userId") UUID userId,
                                                   @Param("query") String query,
                                                   Pageable pageable);
}
