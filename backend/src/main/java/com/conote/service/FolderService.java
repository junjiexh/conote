package com.conote.service;

import com.conote.exception.BadRequestException;
import com.conote.exception.ConflictException;
import com.conote.exception.NotFoundException;
import com.conote.model.Document;
import com.conote.model.Folder;
import com.conote.repository.DocumentRepository;
import com.conote.repository.FolderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FolderService {

    private final FolderRepository folderRepository;
    private final DocumentRepository documentRepository;

    /**
     * Get all folders for a user.
     *
     * @param userId the user's ID
     * @return list of folders
     */
    public List<Folder> getUserFolders(UUID userId) {
        return folderRepository.findByUserId(userId);
    }

    /**
     * Get a folder by ID, ensuring it belongs to the user.
     *
     * @param folderId the folder ID
     * @param userId the user's ID
     * @return the folder
     * @throws NotFoundException if folder not found or doesn't belong to user
     */
    public Folder getFolderById(UUID folderId, UUID userId) {
        return folderRepository.findByIdAndUserId(folderId, userId)
            .orElseThrow(() -> new NotFoundException("Folder not found with ID: " + folderId));
    }

    /**
     * Create a new folder for a user.
     *
     * @param userId the user's ID
     * @param name the folder name
     * @return the created folder
     * @throws ConflictException if folder name already exists for user
     */
    @Transactional
    public Folder createFolder(UUID userId, String name) {
        // Validate folder name
        if (name == null || name.trim().isEmpty()) {
            throw new BadRequestException("Folder name cannot be empty");
        }

        // Check if folder name already exists for this user
        if (folderRepository.findByUserIdAndName(userId, name).isPresent()) {
            throw new ConflictException("Folder with name '" + name + "' already exists");
        }

        Folder folder = new Folder();
        folder.setUserId(userId);
        folder.setName(name.trim());

        return folderRepository.save(folder);
    }

    /**
     * Create the default "personal" folder for a new user.
     * This is called when a user registers.
     *
     * @param userId the user's ID
     * @return the created personal folder
     */
    @Transactional
    public Folder createDefaultPersonalFolder(UUID userId) {
        // Check if personal folder already exists
        if (folderRepository.findByUserIdAndName(userId, "personal").isPresent()) {
            return folderRepository.findByUserIdAndName(userId, "personal").get();
        }

        Folder folder = new Folder();
        folder.setUserId(userId);
        folder.setName("personal");

        return folderRepository.save(folder);
    }

    /**
     * Update a folder's name.
     *
     * @param folderId the folder ID
     * @param userId the user's ID
     * @param newName the new folder name
     * @return the updated folder
     * @throws NotFoundException if folder not found
     * @throws ConflictException if new name already exists
     * @throws BadRequestException if trying to rename personal folder
     */
    @Transactional
    public Folder updateFolder(UUID folderId, UUID userId, String newName) {
        Folder folder = getFolderById(folderId, userId);

        // Prevent renaming the personal folder
        if ("personal".equals(folder.getName())) {
            throw new BadRequestException("Cannot rename the 'personal' folder");
        }

        // Validate new name
        if (newName == null || newName.trim().isEmpty()) {
            throw new BadRequestException("Folder name cannot be empty");
        }

        // Check if new name already exists for this user
        if (folderRepository.findByUserIdAndName(userId, newName.trim()).isPresent()) {
            throw new ConflictException("Folder with name '" + newName + "' already exists");
        }

        folder.setName(newName.trim());
        return folderRepository.save(folder);
    }

    /**
     * Delete a folder.
     * Documents in the folder will have their folder_id set to null.
     *
     * @param folderId the folder ID
     * @param userId the user's ID
     * @throws NotFoundException if folder not found
     * @throws BadRequestException if trying to delete personal folder
     */
    @Transactional
    public void deleteFolder(UUID folderId, UUID userId) {
        Folder folder = getFolderById(folderId, userId);

        // Prevent deleting the personal folder
        if ("personal".equals(folder.getName())) {
            throw new BadRequestException("Cannot delete the 'personal' folder");
        }

        // Set folder_id to null for all documents in this folder
        List<Document> documents = documentRepository.findByFolderId(folderId);
        for (Document doc : documents) {
            doc.setFolderId(null);
        }
        documentRepository.saveAll(documents);

        // Delete the folder
        folderRepository.delete(folder);
    }

    /**
     * Get all documents in a folder.
     *
     * @param folderId the folder ID
     * @param userId the user's ID
     * @return list of documents
     * @throws NotFoundException if folder not found
     */
    public List<Document> getDocumentsInFolder(UUID folderId, UUID userId) {
        // Verify folder belongs to user
        getFolderById(folderId, userId);
        return documentRepository.findByFolderId(folderId);
    }
}
