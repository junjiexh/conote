const Y = require('yjs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const googleProtoFiles = require('google-proto-files');

/**
 * @typedef {import('./proto/collab').ProtoGrpcType} ProtoGrpcType
 */

const GRPC_ADDRESS = process.env.COLLAB_GRPC_ADDRESS || 'localhost:9090';
const PROTO_PATH = path.resolve(__dirname, 'proto/collab/collab.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    includeDirs: [path.dirname(PROTO_PATH), googleProtoFiles.getProtoPath('..')],
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

/** @type {ProtoGrpcType} */
const proto = (grpc.loadPackageDefinition(packageDefinition));
const collabProto = proto.collab;
const snapshotClient = new collabProto.CollaborationSnapshotService(
    GRPC_ADDRESS,
    grpc.credentials.createInsecure(),
);

const documentId = process.argv[2];

if (!documentId) {
    console.error('Usage: node inspect_snapshot.js <documentId>');
    process.exit(1);
}

console.log(`Fetching snapshot for document: ${documentId}...`);

snapshotClient.getSnapshot({ documentId }, (err, response) => {
    if (err) {
        console.error('Error fetching snapshot:', err);
        process.exit(1);
    }

    if (!response.hasSnapshot || !response.snapshot) {
        console.log('No snapshot found for this document.');
        process.exit(0);
    }

    console.log(`Snapshot found (${response.snapshot.length} bytes). Decoding...`);

    const ydoc = new Y.Doc();
    try {
        Y.applyUpdate(ydoc, new Uint8Array(response.snapshot));

        // Tiptap usually stores content in a "prosemirror" XML fragment, but defaults to "default"
        const fragment = ydoc.getXmlFragment('prosemirror');
        const defaultFragment = ydoc.getXmlFragment('default');

        console.log('\n--- Document Content (XML - prosemirror) ---');
        console.log(fragment.toString());

        console.log('\n--- Document Content (XML - default) ---');
        console.log(defaultFragment.toString());

        console.log('\n--- Document Content (JSON - prosemirror) ---');
        console.log(JSON.stringify(fragment.toJSON(), null, 2));

        console.log('\n--- Document Content (JSON - default) ---');
        console.log(JSON.stringify(defaultFragment.toJSON(), null, 2));

        console.log('\n--- State Vector (History Metadata) ---');
        const stateVector = Y.encodeStateVector(ydoc);
        const decodedStateVector = Y.decodeStateVector(stateVector);
        console.log('Client IDs and Clocks:', decodedStateVector);

        console.log('\n--- Deep Structure ---');
        ydoc.share.forEach((item, key) => {
            console.log(`Type: ${key} (${item.constructor.name})`);
            console.log(`  Length: ${item.length}`);
            console.log(`  Content (toString): ${item.toString()}`);
            console.log(`  Content (toJSON): ${JSON.stringify(item.toJSON())}`);
        });

    } catch (e) {
        console.error('Failed to decode snapshot:', e);
    }
});
