package com.conote.security;

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
    void testGenerateTokenSimple() {
        // Arrange
        String username = "test@example.com";

        // Act
        String token = jwtUtil.generateTokenSimple(username);

        // Assert
        assertThat(token).isNotNull();
        assertThat(token).isNotEmpty();
        assertThat(token.split("\\.")).hasSize(3); // JWT has 3 parts: header.payload.signature
    }

    @Test
    @DisplayName("Should extract username from token")
    void testExtractUserId() {
        // Arrange
        String username = "test@example.com";
        String token = jwtUtil.generateTokenSimple(username);

        // Act
        String extractedUsername = jwtUtil.extractUserId(token);

        // Assert
        assertThat(extractedUsername).isEqualTo(username);
    }

    @Test
    @DisplayName("Should extract expiration date from token")
    void testExtractExpiration() {
        // Arrange
        String token = jwtUtil.generateTokenSimple("test@example.com");

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
        String token = jwtUtil.generateTokenSimple(username);
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
        String token = jwtUtil.generateTokenSimple("user1@example.com");
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

        String token = shortExpirationUtil.generateTokenSimple("test@example.com");

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
    void testExtractUserId_InvalidToken() {
        // Arrange
        String invalidToken = "invalid.token.format";

        // Act & Assert
        assertThatThrownBy(() -> jwtUtil.extractUserId(invalidToken))
                .isInstanceOf(MalformedJwtException.class);
    }

    @Test
    @DisplayName("Should throw exception for token with wrong signature")
    void testExtractUserId_WrongSignature() {
        // Arrange
        JwtUtil differentSecretUtil = new JwtUtil();
        ReflectionTestUtils.setField(differentSecretUtil, "secret", "DifferentSecretKeyThatIsAlsoAtLeast256BitsLongForJWTGeneration");
        ReflectionTestUtils.setField(differentSecretUtil, "expiration", TEST_EXPIRATION);

        String token = differentSecretUtil.generateTokenSimple("test@example.com");

        // Act & Assert - Verify with original util (different secret)
        assertThatThrownBy(() -> jwtUtil.extractUserId(token))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    @DisplayName("Should generate different tokens for different users")
    void testGenerateToken_Simple_DifferentUsers() {
        // Arrange
        String user1 = "user1@example.com";
        String user2 = "user2@example.com";

        // Act
        String token1 = jwtUtil.generateTokenSimple(user1);
        String token2 = jwtUtil.generateTokenSimple(user2);

        // Assert
        assertThat(token1).isNotEqualTo(token2);
        assertThat(jwtUtil.extractUserId(token1)).isEqualTo(user1);
        assertThat(jwtUtil.extractUserId(token2)).isEqualTo(user2);
    }

    @Test
    @DisplayName("Should generate different tokens for same user at different times")
    void testGenerateToken_Simple_DifferentTimes() throws InterruptedException {
        // Arrange
        String username = "test@example.com";

        // Act
        String token1 = jwtUtil.generateTokenSimple(username);
        Thread.sleep(10); // Small delay to ensure different timestamp
        String token2 = jwtUtil.generateTokenSimple(username);

        // Assert
        assertThat(token1).isNotEqualTo(token2); // Different issued-at time
        assertThat(jwtUtil.extractUserId(token1)).isEqualTo(username);
        assertThat(jwtUtil.extractUserId(token2)).isEqualTo(username);
    }

    @Test
    @DisplayName("Should handle tokens with special characters in username")
    void testGenerateToken_Simple_SpecialCharacters() {
        // Arrange
        String username = "user+test@example.com";

        // Act
        String token = jwtUtil.generateTokenSimple(username);
        String extractedUsername = jwtUtil.extractUserId(token);

        // Assert
        assertThat(extractedUsername).isEqualTo(username);
    }

    @Test
    @DisplayName("Token should not be expired immediately after generation")
    void testTokenNotExpiredImmediately() {
        // Arrange
        String username = "test@example.com";
        String token = jwtUtil.generateTokenSimple(username);

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
    void testExtractUserId_NullToken() {
        // Act & Assert
        assertThatThrownBy(() -> jwtUtil.extractUserId(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Should reject empty token")
    void testExtractUserId_EmptyToken() {
        // Act & Assert
        assertThatThrownBy(() -> jwtUtil.extractUserId(""))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
