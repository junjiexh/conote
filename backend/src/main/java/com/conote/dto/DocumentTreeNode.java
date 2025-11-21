package com.conote.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentTreeNode {
    private UUID id;
    private UUID parentId;
    private String title;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<DocumentTreeNode> children = new ArrayList<>();
}
