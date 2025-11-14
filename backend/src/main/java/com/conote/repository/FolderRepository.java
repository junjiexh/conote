package com.conote.repository;

import com.conote.model.Folder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<Folder, UUID> {
    List<Folder> findByUserId(UUID userId);
    Optional<Folder> findByIdAndUserId(UUID id, UUID userId);
    Optional<Folder> findByUserIdAndName(UUID userId, String name);
    void deleteByIdAndUserId(UUID id, UUID userId);
}
