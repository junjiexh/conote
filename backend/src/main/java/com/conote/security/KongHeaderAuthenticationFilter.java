package com.conote.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Authentication filter that trusts Kong Gateway's JWT validation.
 * Kong validates the JWT and injects X-User-Id and X-User-Email headers.
 * This filter extracts those headers and sets up the Spring Security context.
 */
@Component
public class KongHeaderAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(KongHeaderAuthenticationFilter.class);
    private static final String HEADER_USER_ID = "X-User-Id";
    private static final String HEADER_USER_EMAIL = "X-User-Email";

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        logger.debug("Processing request: {} {}", request.getMethod(), request.getRequestURI());

        // Extract user information from Kong's headers
        final String userId = request.getHeader(HEADER_USER_ID);
        final String email = request.getHeader(HEADER_USER_EMAIL);

        // If Kong has validated the user and injected headers, set up authentication
        if (email != null && !email.isEmpty() && SecurityContextHolder.getContext().getAuthentication() == null) {
            logger.info("Kong authentication headers found - User ID: {}, Email: {}", userId, email);

            try {
                // Load user details from database
                UserDetails userDetails = this.userDetailsService.loadUserByUsername(email);

                // Create authentication token
                UsernamePasswordAuthenticationToken authenticationToken =
                        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // Set authentication in Spring Security context
                SecurityContextHolder.getContext().setAuthentication(authenticationToken);
                logger.info("Authentication successful for user: {}", email);

            } catch (Exception e) {
                logger.error("Failed to authenticate user from Kong headers: {}", email, e);
            }
        } else if (email == null || email.isEmpty()) {
            logger.debug("No Kong authentication headers found");
        }

        filterChain.doFilter(request, response);
    }
}
