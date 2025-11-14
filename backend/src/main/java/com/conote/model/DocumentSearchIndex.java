package com.conote.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.*;
import org.springframework.data.elasticsearch.annotations.Document;

import java.time.LocalDateTime;
import java.util.UUID;

@Document(indexName = "documents")
@Setting(settingPath = "elasticsearch-settings.json")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentSearchIndex {
    @Id
    private String id; // UUID as string

    @Field(type = FieldType.Keyword)
    private String userId;

    @Field(type = FieldType.Keyword)
    private String parentId;

    @Field(type = FieldType.Keyword)
    private String folderId;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String title;

    @Field(type = FieldType.Text, analyzer = "html_strip_analyzer")
    private String content;

    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second_millis)
    private LocalDateTime createdAt;

    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second_millis)
    private LocalDateTime updatedAt;

    // Factory method to create from JPA Document entity
    public static DocumentSearchIndex fromDocument(com.conote.model.Document document) {
        DocumentSearchIndex index = new DocumentSearchIndex();
        index.setId(document.getId().toString());
        index.setUserId(document.getUserId().toString());
        index.setParentId(document.getParentId() != null ? document.getParentId().toString() : null);
        index.setFolderId(document.getFolderId() != null ? document.getFolderId().toString() : null);
        index.setTitle(document.getTitle());
        index.setContent(document.getContent());
        index.setCreatedAt(document.getCreatedAt());
        index.setUpdatedAt(document.getUpdatedAt());
        return index;
    }
}
