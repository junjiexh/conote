package com.conote.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Configuration to enable asynchronous execution.
 * Used for audit logging to avoid blocking main operations.
 */
@Configuration
@EnableAsync
public class AsyncConfiguration {
    // Spring will automatically configure a default executor
    // for @Async methods if no custom executor is defined
}
