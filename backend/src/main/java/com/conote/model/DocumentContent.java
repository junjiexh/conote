package com.conote.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;

/**
 * MongoDB document for storing Editor.js JSON content
 */
@Document(collection = "document_contents")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentContent {

    @Id
    private String id; // This will be the same as the PostgreSQL UUID (as string)

    @Field("user_id")
    private String userId;

    @Field("content_json")
    private String contentJson; // Editor.js JSON as string

    @Field("created_at")
    private LocalDateTime createdAt;

    @Field("updated_at")
    private LocalDateTime updatedAt;
}
