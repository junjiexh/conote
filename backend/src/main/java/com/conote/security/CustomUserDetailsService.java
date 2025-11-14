package com.conote.security;

import com.conote.model.User;
import com.conote.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.UUID;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private static final Logger logger = LoggerFactory.getLogger(CustomUserDetailsService.class);

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        logger.info("loadUserByUsername called with email: {}", email);

        try {
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

            logger.info("User loaded successfully: {}", user.getEmail());
            return new org.springframework.security.core.userdetails.User(
                    user.getEmail(),
                    user.getPasswordHash(),
                    new ArrayList<>()
            );
        } catch (IllegalArgumentException e) {
            logger.error("Failed to parse userId as UUID: {}", email, e);
            throw new UsernameNotFoundException("Invalid userId format: " + email, e);
        } catch (Exception e) {
            logger.error("Unexpected error loading user: {}", email, e);
            throw e;
        }
    }
}
