package com.conote.grpc;

import com.conote.grpc.account.AccountServiceGrpc;
import com.conote.grpc.account.LoginRequest;
import com.conote.grpc.account.LoginResponse;
import com.conote.grpc.account.RegisterRequest;
import com.conote.grpc.account.RegisterResponse;
import com.conote.grpc.account.ValidateTokenRequest;
import com.conote.grpc.account.ValidateTokenResponse;
import com.conote.grpc.account.PasswordResetRequest;
import com.conote.grpc.account.PasswordResetResponse;
import com.conote.grpc.account.PasswordResetConfirmRequest;
import com.conote.grpc.account.PasswordResetConfirmResponse;
import com.conote.grpc.account.GetUserRequest;
import com.conote.grpc.account.GetUserResponse;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Service;

@Service
public class AccountServiceClient {

    @GrpcClient("account-service")
    private AccountServiceGrpc.AccountServiceBlockingStub accountServiceStub;

    public RegisterResponse register(String email, String password) {
        RegisterRequest request = RegisterRequest.newBuilder()
                .setEmail(email)
                .setPassword(password)
                .build();
        return accountServiceStub.register(request);
    }

    public LoginResponse login(String email, String password) {
        LoginRequest request = LoginRequest.newBuilder()
                .setEmail(email)
                .setPassword(password)
                .build();
        return accountServiceStub.login(request);
    }

    public ValidateTokenResponse validateToken(String token) {
        ValidateTokenRequest request = ValidateTokenRequest.newBuilder()
                .setToken(token)
                .build();
        return accountServiceStub.validateToken(request);
    }

    public PasswordResetResponse requestPasswordReset(String email) {
        PasswordResetRequest request = PasswordResetRequest.newBuilder()
                .setEmail(email)
                .build();
        return accountServiceStub.requestPasswordReset(request);
    }

    public PasswordResetConfirmResponse confirmPasswordReset(String token, String newPassword) {
        PasswordResetConfirmRequest request = PasswordResetConfirmRequest.newBuilder()
                .setToken(token)
                .setNewPassword(newPassword)
                .build();
        return accountServiceStub.confirmPasswordReset(request);
    }

    public GetUserResponse getUser(String userId) {
        GetUserRequest request = GetUserRequest.newBuilder()
                .setUserId(userId)
                .build();
        return accountServiceStub.getUser(request);
    }
}
