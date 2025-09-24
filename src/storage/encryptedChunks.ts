export {
    getActiveEncryptionKey,
    getEncryptionKeyError,
    resolveEncryptionPreference,
    writeChunkToDisk,
    readChunkFromDisk,
    removeChunkArtifacts,
    isChunkEncryptedOnDisk,
    resetEncryptionCacheForTests
} from './encryptedChunks.js';
