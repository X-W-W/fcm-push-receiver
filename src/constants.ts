// Processing the version, tag, and size packets (assuming a minimum-length
// size packet). Only used during the login handshake.
export const MCS_VERSION_TAG_AND_SIZE = 0;
// Processing the tag and size packets (assuming a minimum-length size packet).
// Used for normal messages.
export const MCS_TAG_AND_SIZE = 1;
// Processing the size packet alone.
export const MCS_SIZE = 2;
// Processing the protocol buffer bytes for messages with non-zero payloads.
export const MCS_PROTO_BYTES = 3;

// Number of bytes a MCS version packet consumes.
export const kVersionPacketLen = 1;
// Number of bytes a tag packet consumes.
export const kTagPacketLen = 1;
// A Varint32 can consume up to 5 bytes. The protocol currently allows 4 KiB
// payloads, but larger payloads may still appear in practice.
export const kSizePacketLenMin = 1;
export const kSizePacketLenMax = 5;

// The current MCS protocol version.
export const kMCSVersion = 41;

// MCS message tags. The order must remain consistent with the server.
export const kHeartbeatPingTag = 0;
export const kHeartbeatAckTag = 1;
export const kLoginRequestTag = 2;
export const kLoginResponseTag = 3;
export const kCloseTag = 4;
export const kMessageStanzaTag = 5;
export const kPresenceStanzaTag = 6;
export const kIqStanzaTag = 7;
export const kDataMessageStanzaTag = 8;
export const kBatchPresenceStanzaTag = 9;
export const kStreamErrorStanzaTag = 10;
export const kHttpRequestTag = 11;
export const kHttpResponseTag = 12;
export const kBindAccountRequestTag = 13;
export const kBindAccountResponseTag = 14;
export const kTalkMetadataTag = 15;
export const kNumProtoTypes = 16;
