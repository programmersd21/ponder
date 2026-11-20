# ponder Firestore Security Specification

## Data Invariants
1. **Strict Ownership**: Every `Conversation`, `ConversationMessage`, `SavedExploration`, and `PrivateNote` belongs strictly to one `ownerUid == request.auth.uid` with a verified email (`request.auth.token.email_verified == true`).
2. **PII Isolation**: User email and avatar URL live only under `/users/{userId}/private/{docId}` and are readable/writable exclusively by that user.
3. **Master Gate Relational Sync**: `/conversations/{conversationId}/messages/{messageId}` verifies parent conversation ownership on single-document reads and all writes via `get()`, while `list` enforces `resource.data.ownerUid == request.auth.uid` directly without `get()` cost amplification.
4. **Orphan Prevention**: `SavedExploration` and `PrivateNote` creation require `exists()` and ownership check on `/conversations/{conversationId}`.
5. **Immutable Identity & Server Timestamps**: `ownerUid`, `id`, `conversationId`, `createdAt`/`savedAt` cannot change after creation, and creation/update timestamps must equal `request.time`.
6. **Public Share Privacy Boundary**: `/shares/{shareId}` allows anonymous single-document `get` ONLY for high-entropy IDs (`size >= 16`) and explicitly forbids public `list` scraping, while excluding private notes and PII.

## Dirty Dozen Adversarial Payloads
1. **Shadow Field Injection on Conversation Create**: Adding `isAdmin: true` or `ghostField: "x"` to `conversations/{id}` -> rejected by `keys().hasOnly(...)`.
2. **Owner Spoofing on Conversation Create**: Setting `ownerUid` to another user's UID -> rejected by `data.ownerUid == request.auth.uid`.
3. **Client Timestamp Forgery**: Setting `createdAt` to a backdated or future timestamp (`!= request.time`) -> rejected by `incoming().createdAt == request.time`.
4. **ID Poisoning**: Creating `/conversations/` with 500-char ID or invalid characters -> rejected by `isValidId(conversationId)`.
5. **Owner Mutation on Update**: Changing `ownerUid` or `createdAt` during conversation rename -> rejected by immutability invariants and `affectedKeys().hasOnly(['title', 'updatedAt'])`.
6. **Cross-Tenant Note Hijack**: Creating a note referencing another user's `conversationId` -> rejected by `get(.../conversations/$(conversationId)).data.ownerUid == request.auth.uid`.
7. **Unverified Email Write**: Attempting write when `request.auth.token.email_verified == false` -> rejected by `isVerifiedUser()`.
8. **PII Read Leak**: Reading `/users/{otherUid}/private/info` as a different authenticated user -> rejected by `isOwner(userId)`.
9. **Blanket Collection Enumeration**: Listing `/conversations`, `/notes`, or `/shares` without `ownerUid == request.auth.uid` filter -> rejected by `allow list` `resource.data.ownerUid == request.auth.uid`.
10. **Short Predictable Share ID**: Creating `/shares/abc` (`size < 16`) -> rejected by `isValidShareId(shareId)`.
11. **Public Share Tampering**: Another user attempting `update` or `delete` on `/shares/{shareId}` -> rejected (shares are immutable snapshots, only owner can delete).
12. **Oversized Denial-of-Wallet Payload**: Injecting >1000 char `question` or >10000 char `note.content` or >160 char `title` -> rejected by mandatory `.size()` bounds.
