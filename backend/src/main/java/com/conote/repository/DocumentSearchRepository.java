package com.conote.repository;

import com.conote.model.DocumentSearchIndex;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentSearchRepository extends ElasticsearchRepository<DocumentSearchIndex, String> {

    /**
     * Search documents by userId and query string in title or content
     * The query searches both title and content fields with boost on title
     */
    @Query("{\"bool\": {\"must\": [{\"match\": {\"userId\": \"?0\"}}, {\"multi_match\": {\"query\": \"?1\", \"fields\": [\"title^2\", \"content\"], \"type\": \"best_fields\", \"fuzziness\": \"AUTO\"}}]}}")
    Page<DocumentSearchIndex> searchByUserIdAndQuery(String userId, String query, Pageable pageable);

    /**
     * Delete all documents for a specific user
     */
    void deleteByUserId(String userId);

    /**
     * Delete a specific document by id
     */
    void deleteById(String id);
}
