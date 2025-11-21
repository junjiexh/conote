package com.conote.service;

import com.conote.exception.ResourceNotFoundException;
import com.conote.model.DocumentSnapshot;
import com.conote.repository.DocumentRepository;
import com.conote.repository.DocumentSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentSnapshotService {

    private final DocumentSnapshotRepository snapshotRepository;
    private final DocumentRepository documentRepository;

    @Transactional(readOnly = true)
    public Optional<byte[]> getSnapshot(UUID documentId) {
        return snapshotRepository.findById(documentId).map(DocumentSnapshot::getSnapshot);
    }

    @Transactional
    public void saveSnapshot(UUID documentId, byte[] snapshotBytes) {
        if (!documentRepository.existsById(documentId)) {
            throw new ResourceNotFoundException("Document", "id", documentId);
        }
        DocumentSnapshot snapshot = snapshotRepository.findById(documentId)
                .orElseGet(() -> {
                    DocumentSnapshot entity = new DocumentSnapshot();
                    entity.setDocumentId(documentId);
                    return entity;
                });
        snapshot.setSnapshot(snapshotBytes);
        snapshotRepository.save(snapshot);
    }
}
