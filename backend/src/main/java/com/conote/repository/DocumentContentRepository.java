package com.conote.repository;

import com.conote.model.DocumentContent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * MongoDB repository for DocumentContent
 */
@Repository
public interface DocumentContentRepository extends MongoRepository<DocumentContent, String> {

    Optional<DocumentContent> findById(String id);

    void deleteById(String id);
}
