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
     * Search documents by userId and query string in title.
     */
    @Query("{\"bool\": {\"must\": [{\"match\": {\"userId\": \"?0\"}}, {\"match\": {\"title\": {\"query\": \"?1\", \"fuzziness\": \"AUTO\"}}}]}}")
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
