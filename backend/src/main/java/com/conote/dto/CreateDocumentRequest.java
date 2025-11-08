package com.conote.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateDocumentRequest {
    @NotBlank(message = "Title is required")
    private String title;

    private UUID parentId;
}
