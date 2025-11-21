package com.conote.repository;

import com.conote.model.DocumentSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface DocumentSnapshotRepository extends JpaRepository<DocumentSnapshot, UUID> {
}
