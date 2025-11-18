package com.conote.security;

import com.conote.exception.BadRequestException;
import com.conote.grpc.AccountServiceClient;
import com.conote.grpc.account.ValidateTokenResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Autowired
    private AccountServiceClient accountServiceClient;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        logger.info("Processing request: {} {}", request.getMethod(), request.getRequestURI());

        final String authorizationHeader = request.getHeader("Authorization");

        String jwt = null;

        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            jwt = authorizationHeader.substring(7);
            logger.info("JWT token found");
        } else {
            logger.warn("No Authorization header or invalid format");
        }

        if (jwt != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                // Validate token via gRPC account service
                ValidateTokenResponse validateResponse = accountServiceClient.validateToken(jwt);

                if (validateResponse.getValid()) {
                    logger.info("JWT validation successful for: {}", validateResponse.getEmail());

                    // Create UserDetails from validated token
                    UserDetails userDetails = User.builder()
                            .username(validateResponse.getEmail())
                            .password("") // Password not needed for token-based auth
                            .authorities(Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + validateResponse.getRole())))
                            .build();

                    UsernamePasswordAuthenticationToken authenticationToken =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authenticationToken);
                } else {
                    logger.error("JWT validation FAILED: {}", validateResponse.getMessage());
                }
            } catch (Exception e) {
                logger.error("Error validating JWT token via gRPC", e);
            }
        }

        filterChain.doFilter(request, response);
    }
}
