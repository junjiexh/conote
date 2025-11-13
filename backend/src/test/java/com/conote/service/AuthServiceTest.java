package com.conote.service;

import com.conote.dto.AuthRequest;
import com.conote.dto.AuthResponse;
import com.conote.model.User;
import com.conote.repository.UserRepository;
import com.conote.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService Unit Tests")
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private AuthenticationManager authenticationManager;

    @InjectMocks
    private AuthService authService;

    private AuthRequest validRequest;
    private User testUser;

    @BeforeEach
    void setUp() {
        validRequest = new AuthRequest();
        validRequest.setEmail("test@example.com");
        validRequest.setPassword("password123");

        testUser = new User();
        testUser.setId(UUID.randomUUID());
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("hashedPassword");
    }

    @Test
    @DisplayName("Should register new user successfully")
    void testRegister_Success() {
        // Arrange
        when(userRepository.existsByEmail(validRequest.getEmail())).thenReturn(false);
        when(passwordEncoder.encode(validRequest.getPassword())).thenReturn("hashedPassword");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(jwtUtil.generateToken(validRequest.getEmail())).thenReturn("jwt-token");

        // Act
        AuthResponse response = authService.register(validRequest);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo("jwt-token");

        verify(userRepository).existsByEmail(validRequest.getEmail());
        verify(passwordEncoder).encode(validRequest.getPassword());
        verify(userRepository).save(any(User.class));
        verify(jwtUtil).generateToken(validRequest.getEmail());
    }

    @Test
    @DisplayName("Should throw exception when email already exists")
    void testRegister_EmailAlreadyExists() {
        // Arrange
        when(userRepository.existsByEmail(validRequest.getEmail())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> authService.register(validRequest))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Email already exists");

        verify(userRepository).existsByEmail(validRequest.getEmail());
        verify(passwordEncoder, never()).encode(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should hash password during registration")
    void testRegister_PasswordHashing() {
        // Arrange
        String rawPassword = "mySecretPassword";
        validRequest.setPassword(rawPassword);

        when(userRepository.existsByEmail(validRequest.getEmail())).thenReturn(false);
        when(passwordEncoder.encode(rawPassword)).thenReturn("$2a$10$hashedPassword");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User savedUser = invocation.getArgument(0);
            assertThat(savedUser.getPasswordHash()).isEqualTo("$2a$10$hashedPassword");
            assertThat(savedUser.getPasswordHash()).isNotEqualTo(rawPassword);
            return savedUser;
        });
        when(jwtUtil.generateToken(any())).thenReturn("token");

        // Act
        authService.register(validRequest);

        // Assert
        verify(passwordEncoder).encode(rawPassword);
    }

    @Test
    @DisplayName("Should login successfully with valid credentials")
    void testLogin_Success() {
        // Arrange
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(null); // Authentication succeeds
        when(jwtUtil.generateToken(validRequest.getEmail())).thenReturn("jwt-token");

        // Act
        AuthResponse response = authService.login(validRequest);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo("jwt-token");

        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(jwtUtil).generateToken(validRequest.getEmail());
    }

    @Test
    @DisplayName("Should throw exception when login with invalid credentials")
    void testLogin_InvalidCredentials() {
        // Arrange
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Invalid credentials"));

        // Act & Assert
        assertThatThrownBy(() -> authService.login(validRequest))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid credentials");

        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(jwtUtil, never()).generateToken(any());
    }

    @Test
    @DisplayName("Should authenticate with correct email and password")
    void testLogin_CorrectAuthentication() {
        // Arrange
        String email = "user@example.com";
        String password = "password123";

        validRequest.setEmail(email);
        validRequest.setPassword(password);

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenAnswer(invocation -> {
                    UsernamePasswordAuthenticationToken token = invocation.getArgument(0);
                    assertThat(token.getPrincipal()).isEqualTo(email);
                    assertThat(token.getCredentials()).isEqualTo(password);
                    return null;
                });
        when(jwtUtil.generateToken(email)).thenReturn("token");

        // Act
        authService.login(validRequest);

        // Assert
        verify(authenticationManager).authenticate(argThat(token ->
                token.getPrincipal().equals(email) && token.getCredentials().equals(password)
        ));
    }

    @Test
    @DisplayName("Should generate JWT token for registered user")
    void testRegister_GeneratesToken() {
        // Arrange
        String expectedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(jwtUtil.generateToken(validRequest.getEmail())).thenReturn(expectedToken);

        // Act
        AuthResponse response = authService.register(validRequest);

        // Assert
        assertThat(response.getToken()).isEqualTo(expectedToken);
    }

    @Test
    @DisplayName("Should save user with correct email during registration")
    void testRegister_CorrectUserData() {
        // Arrange
        when(userRepository.existsByEmail(validRequest.getEmail())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            assertThat(user.getEmail()).isEqualTo(validRequest.getEmail());
            assertThat(user.getPasswordHash()).isEqualTo("hashed");
            return user;
        });
        when(jwtUtil.generateToken(anyString())).thenReturn("token");

        // Act
        authService.register(validRequest);

        // Assert
        verify(userRepository).save(argThat(user ->
                user.getEmail().equals(validRequest.getEmail()) &&
                user.getPasswordHash().equals("hashed")
        ));
    }
}
