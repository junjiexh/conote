package com.conote.grpc;

import com.conote.exception.ResourceNotFoundException;
import com.conote.grpc.collab.CollaborationSnapshotServiceGrpc;
import com.conote.grpc.collab.GetSnapshotRequest;
import com.conote.grpc.collab.GetSnapshotResponse;
import com.conote.grpc.collab.SaveSnapshotRequest;
import com.conote.service.DocumentSnapshotService;
import com.google.protobuf.ByteString;
import com.google.protobuf.Empty;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;

import java.util.UUID;

@GrpcService
@RequiredArgsConstructor
@Slf4j
public class CollaborationSnapshotGrpcService extends CollaborationSnapshotServiceGrpc.CollaborationSnapshotServiceImplBase {

    private final DocumentSnapshotService snapshotService;

    @Override
    public void getSnapshot(GetSnapshotRequest request, StreamObserver<GetSnapshotResponse> responseObserver) {
        try {
            UUID documentId = UUID.fromString(request.getDocumentId());
            GetSnapshotResponse.Builder builder = GetSnapshotResponse.newBuilder();
            snapshotService.getSnapshot(documentId)
                    .ifPresentOrElse(
                            snapshot -> builder.setSnapshot(ByteString.copyFrom(snapshot)).setHasSnapshot(true),
                            () -> builder.setHasSnapshot(false)
                    );
            responseObserver.onNext(builder.build());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid document_id received for snapshot fetch: {}", request.getDocumentId(), ex);
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid document_id: " + request.getDocumentId())
                    .withCause(ex)
                    .asRuntimeException());
        } catch (Exception ex) {
            log.error("Failed to load snapshot", ex);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Failed to load snapshot")
                    .withCause(ex)
                    .asRuntimeException());
        }
    }

    @Override
    public void saveSnapshot(SaveSnapshotRequest request, StreamObserver<Empty> responseObserver) {
        try {
            UUID documentId = UUID.fromString(request.getDocumentId());
            byte[] snapshotBytes = request.getSnapshot().toByteArray();
            snapshotService.saveSnapshot(documentId, snapshotBytes);
            responseObserver.onNext(Empty.getDefaultInstance());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid document_id received for snapshot save: {}", request.getDocumentId(), ex);
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid document_id: " + request.getDocumentId())
                    .withCause(ex)
                    .asRuntimeException());
        } catch (ResourceNotFoundException notFound) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription(notFound.getMessage())
                    .asRuntimeException());
        } catch (Exception ex) {
            log.error("Failed to persist snapshot", ex);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Failed to persist snapshot")
                    .withCause(ex)
                    .asRuntimeException());
        }
    }
}
