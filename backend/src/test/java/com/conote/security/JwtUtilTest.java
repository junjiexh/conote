package com.conote.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.Date;

import static org.assertj.core.api.Assertions.*;

@DisplayName("JwtUtil Security Tests")
class JwtUtilTest {

    private JwtUtil jwtUtil;
    private static final String TEST_SECRET = "ThisIsAVerySecretKeyForJWTTokenGenerationAndMustBeAtLeast256BitsLong";
    private static final Long TEST_EXPIRATION = 3600000L; // 1 hour in milliseconds

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", TEST_SECRET);
        ReflectionTestUtils.setField(jwtUtil, "expiration", TEST_EXPIRATION);
    }

    @Test
    @DisplayName("Should generate valid JWT token")
    void testGenerateToken() {
        // Arrange
        String username = "test@example.com";

        // Act
        String token = jwtUtil.generateToken(username);

        // Assert
        assertThat(token).isNotNull();
        assertThat(token).isNotEmpty();
        assertThat(token.split("\\.")).hasSize(3); // JWT has 3 parts: header.payload.signature
    }

    @Test
    @DisplayName("Should extract username from token")
    void testExtractUsername() {
        // Arrange
        String username = "test@example.com";
        String token = jwtUtil.generateToken(username);

        // Act
        String extractedUsername = jwtUtil.extractUsername(token);

        // Assert
        assertThat(extractedUsername).isEqualTo(username);
    }

    @Test
    @DisplayName("Should extract expiration date from token")
    void testExtractExpiration() {
        // Arrange
        String token = jwtUtil.generateToken("test@example.com");

        // Act
        Date expiration = jwtUtil.extractExpiration(token);

        // Assert
        assertThat(expiration).isNotNull();
        assertThat(expiration).isAfter(new Date());
        assertThat(expiration.getTime()).isLessThan(System.currentTimeMillis() + TEST_EXPIRATION + 1000);
    }

    @Test
    @DisplayName("Should validate token successfully with correct user")
    void testValidateToken_Success() {
        // Arrange
        String username = "test@example.com";
        String token = jwtUtil.generateToken(username);
        UserDetails userDetails = User.builder()
                .username(username)
                .password("password")
                .authorities(Collections.emptyList())
                .build();

        // Act
        Boolean isValid = jwtUtil.validateToken(token, userDetails);

        // Assert
        assertThat(isValid).isTrue();
    }

    @Test
    @DisplayName("Should reject token with wrong username")
    void testValidateToken_WrongUsername() {
        // Arrange
        String token = jwtUtil.generateToken("user1@example.com");
        UserDetails userDetails = User.builder()
                .username("user2@example.com")
                .password("password")
                .authorities(Collections.emptyList())
                .build();

        // Act
        Boolean isValid = jwtUtil.validateToken(token, userDetails);

        // Assert
        assertThat(isValid).isFalse();
    }

    @Test
    @DisplayName("Should reject expired token")
    void testValidateToken_ExpiredToken() {
        // Arrange - Create util with very short expiration
        JwtUtil shortExpirationUtil = new JwtUtil();
        ReflectionTestUtils.setField(shortExpirationUtil, "secret", TEST_SECRET);
        ReflectionTestUtils.setField(shortExpirationUtil, "expiration", -1000L); // Expired

        String token = shortExpirationUtil.generateToken("test@example.com");

        UserDetails userDetails = User.builder()
                .username("test@example.com")
                .password("password")
                .authorities(Collections.emptyList())
                .build();

        // Act
        Boolean isValid = shortExpirationUtil.validateToken(token, userDetails);

        // Assert
        assertThat(isValid).isFalse();
    }

    @Test
    @DisplayName("Should throw exception for invalid token format")
    void testExtractUsername_InvalidToken() {
        // Arrange
        String invalidToken = "invalid.token.format";

        // Act & Assert
        assertThatThrownBy(() -> jwtUtil.extractUsername(invalidToken))
                .isInstanceOf(MalformedJwtException.class);
    }

    @Test
    @DisplayName("Should throw exception for token with wrong signature")
    void testExtractUsername_WrongSignature() {
        // Arrange
        JwtUtil differentSecretUtil = new JwtUtil();
        ReflectionTestUtils.setField(differentSecretUtil, "secret", "DifferentSecretKeyThatIsAlsoAtLeast256BitsLongForJWTGeneration");
        ReflectionTestUtils.setField(differentSecretUtil, "expiration", TEST_EXPIRATION);

        String token = differentSecretUtil.generateToken("test@example.com");

        // Act & Assert - Verify with original util (different secret)
        assertThatThrownBy(() -> jwtUtil.extractUsername(token))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    @DisplayName("Should generate different tokens for different users")
    void testGenerateToken_DifferentUsers() {
        // Arrange
        String user1 = "user1@example.com";
        String user2 = "user2@example.com";

        // Act
        String token1 = jwtUtil.generateToken(user1);
        String token2 = jwtUtil.generateToken(user2);

        // Assert
        assertThat(token1).isNotEqualTo(token2);
        assertThat(jwtUtil.extractUsername(token1)).isEqualTo(user1);
        assertThat(jwtUtil.extractUsername(token2)).isEqualTo(user2);
    }

    @Test
    @DisplayName("Should generate different tokens for same user at different times")
    void testGenerateToken_DifferentTimes() throws InterruptedException {
        // Arrange
        String username = "test@example.com";

        // Act
        String token1 = jwtUtil.generateToken(username);
        Thread.sleep(10); // Small delay to ensure different timestamp
        String token2 = jwtUtil.generateToken(username);

        // Assert
        assertThat(token1).isNotEqualTo(token2); // Different issued-at time
        assertThat(jwtUtil.extractUsername(token1)).isEqualTo(username);
        assertThat(jwtUtil.extractUsername(token2)).isEqualTo(username);
    }

    @Test
    @DisplayName("Should handle tokens with special characters in username")
    void testGenerateToken_SpecialCharacters() {
        // Arrange
        String username = "user+test@example.com";

        // Act
        String token = jwtUtil.generateToken(username);
        String extractedUsername = jwtUtil.extractUsername(token);

        // Assert
        assertThat(extractedUsername).isEqualTo(username);
    }

    @Test
    @DisplayName("Token should not be expired immediately after generation")
    void testTokenNotExpiredImmediately() {
        // Arrange
        String username = "test@example.com";
        String token = jwtUtil.generateToken(username);

        UserDetails userDetails = User.builder()
                .username(username)
                .password("password")
                .authorities(Collections.emptyList())
                .build();

        // Act
        Boolean isValid = jwtUtil.validateToken(token, userDetails);
        Date expiration = jwtUtil.extractExpiration(token);

        // Assert
        assertThat(isValid).isTrue();
        assertThat(expiration).isAfter(new Date());
    }

    @Test
    @DisplayName("Should reject null token")
    void testExtractUsername_NullToken() {
        // Act & Assert
        assertThatThrownBy(() -> jwtUtil.extractUsername(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Should reject empty token")
    void testExtractUsername_EmptyToken() {
        // Act & Assert
        assertThatThrownBy(() -> jwtUtil.extractUsername(""))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
