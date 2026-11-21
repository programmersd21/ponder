import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import {
  type Explanation,
  type ExplorationDepth,
  type ExplorationThread,
  type ExplorationTurn,
  type SavedExplorationItem,
  type SharedSnapshot,
  validateExplanationPayload,
} from './schema.ts';
import type { SoundIntensity } from './soundEngine.ts';
import type { ThemePreference } from './storage.ts';

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Timestamp)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function sanitizeExplanationForFirestore(exp: Explanation): Record<string, unknown> {
  const safe: Record<string, unknown> = {
    question: exp.question.slice(0, 1000),
    title: exp.title.slice(0, 160),
    shortAnswer: exp.shortAnswer.slice(0, 1200),
    sections: exp.sections.slice(0, 8),
    keyTakeaway: exp.keyTakeaway.slice(0, 500),
    suggestedFollowUps: (exp.suggestedFollowUps ?? []).slice(0, 6).map((s) => s.slice(0, 200)),
    visualisation: exp.visualisation ? stripUndefined(exp.visualisation) : null,
  };
  if (exp.keyTakeaways && exp.keyTakeaways.length > 0) {
    safe.keyTakeaways = exp.keyTakeaways.slice(0, 5);
  }
  if (exp.depth) safe.depth = exp.depth;
  if (exp.glossary && exp.glossary.length > 0) safe.glossary = exp.glossary.slice(0, 10);
  if (exp.understandingChecks && exp.understandingChecks.length > 0) {
    safe.understandingChecks = exp.understandingChecks.slice(0, 4);
  }
  if (exp.citations && exp.citations.length > 0) safe.citations = exp.citations.slice(0, 15);
  if (exp.media) safe.media = stripUndefined(exp.media);
  if (exp.generationMeta) safe.generationMeta = stripUndefined(exp.generationMeta);
  return stripUndefined(safe);
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return Date.now();
}

export function generateSafeId(prefix = 'id'): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

export function generateShareToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `sh_${b64}`; // 27 chars, URL-safe, unpredictable
}

export async function syncUserProfileOnLogin(
  user: User,
  defaults: {
    theme: ThemePreference;
    preferredDepth: ExplorationDepth;
    soundEnabled: boolean;
    soundVolume: number;
    soundIntensity: SoundIntensity;
  }
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const displayName = (user.displayName ?? 'Learner').slice(0, 80);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        theme: defaults.theme,
        preferredDepth: defaults.preferredDepth,
        soundEnabled: defaults.soundEnabled,
        soundVolume: defaults.soundVolume,
        soundIntensity: defaults.soundIntensity,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }

  try {
    const privateRef = doc(db, 'users', user.uid, 'private', 'info');
    const payload: Record<string, unknown> = {
      uid: user.uid,
      email: (user.email ?? `${user.uid}@users.ponder`).slice(0, 254),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) {
      payload.photoURL = user.photoURL.slice(0, 1024);
    }
    await setDoc(privateRef, payload, { merge: false });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privatePath);
  }
}

export async function fetchUserConversations(ownerUid: string, maxItems = 40): Promise<ExplorationThread[]> {
  const convPath = 'conversations';
  try {
    const q = query(
      collection(db, 'conversations'),
      where('ownerUid', '==', ownerUid),
      orderBy('updatedAt', 'desc'),
      limit(maxItems)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: String(data.title ?? 'Untitled exploration'),
        pinned: Boolean(data.pinned),
        depth: (data.depth as ExplorationDepth) ?? 'standard',
        turns: [],
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, convPath);
  }
}

export async function fetchConversationTurns(
  ownerUid: string,
  conversationId: string
): Promise<ExplorationTurn[]> {
  const msgPath = `conversations/${conversationId}/messages`;
  try {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      where('ownerUid', '==', ownerUid),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        try {
          const validated = validateExplanationPayload(data.explanation, String(data.question ?? ''));
          return {
            id: d.id,
            question: String(data.question ?? validated.question),
            explanation: validated,
            depth: (data.depth as ExplorationDepth) ?? 'standard',
            createdAt: toMillis(data.createdAt),
          } as ExplorationTurn;
        } catch {
          return null;
        }
      })
      .filter((t): t is ExplorationTurn => t !== null);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, msgPath);
  }
}

export async function persistConversationTurn(
  ownerUid: string,
  conversationId: string | null,
  turn: ExplorationTurn,
  existingTitle?: string,
  existingMessageCount = 0
): Promise<{ conversationId: string; title: string }> {
  const convId = conversationId ?? generateSafeId('conv');
  const title = (existingTitle || turn.explanation.title).slice(0, 160);
  const depth: ExplorationDepth = turn.depth ?? turn.explanation.depth ?? 'standard';
  const convRef = doc(db, 'conversations', convId);

  try {
    if (!conversationId) {
      await setDoc(convRef, {
        id: convId,
        ownerUid,
        title,
        pinned: false,
        depth,
        messageCount: 1,
        lastQuestion: turn.question.slice(0, 1000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(convRef, {
        title,
        lastQuestion: turn.question.slice(0, 1000),
        messageCount: Math.min(500, existingMessageCount + 1),
        depth,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `conversations/${convId}`);
  }

  const msgId = turn.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || generateSafeId('msg');
  const msgRef = doc(db, 'conversations', convId, 'messages', msgId);
  try {
    await setDoc(msgRef, {
      id: msgId,
      conversationId: convId,
      ownerUid,
      question: turn.question.slice(0, 1000),
      depth,
      explanation: sanitizeExplanationForFirestore(turn.explanation),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `conversations/${convId}/messages/${msgId}`);
  }

  return { conversationId: convId, title };
}

export async function renameConversationInFirestore(
  conversationId: string,
  newTitle: string
): Promise<void> {
  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      title: newTitle.trim().slice(0, 160),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function togglePinConversationInFirestore(
  conversationId: string,
  pinned: boolean
): Promise<void> {
  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      pinned,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteConversationInFirestore(
  ownerUid: string,
  conversationId: string
): Promise<void> {
  const msgPath = `conversations/${conversationId}/messages`;
  try {
    const msgs = await getDocs(
      query(
        collection(db, 'conversations', conversationId, 'messages'),
        where('ownerUid', '==', ownerUid)
      )
    );
    const batch = writeBatch(db);
    msgs.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, msgPath);
  }

  // Delete associated note if it exists
  try {
    await deleteDoc(doc(db, 'notes', conversationId));
  } catch {
    // Note may not exist
  }

  try {
    await deleteDoc(doc(db, 'conversations', conversationId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `conversations/${conversationId}`);
  }
}

export async function fetchSavedExplorations(ownerUid: string): Promise<SavedExplorationItem[]> {
  try {
    const q = query(
      collection(db, 'savedExplorations'),
      where('ownerUid', '==', ownerUid),
      orderBy('savedAt', 'desc'),
      limit(60)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        conversationId: String(data.conversationId),
        turnId: String(data.turnId),
        title: String(data.title),
        question: String(data.question),
        savedAt: toMillis(data.savedAt),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'savedExplorations');
  }
}

export async function saveExplorationBookmark(
  ownerUid: string,
  item: Omit<SavedExplorationItem, 'savedAt'>
): Promise<SavedExplorationItem> {
  const safeId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `savedExplorations/${safeId}`;
  try {
    await setDoc(doc(db, 'savedExplorations', safeId), {
      id: safeId,
      ownerUid,
      conversationId: item.conversationId,
      turnId: item.turnId,
      title: item.title.slice(0, 160),
      question: item.question.slice(0, 1000),
      savedAt: serverTimestamp(),
    });
    return { ...item, id: safeId, savedAt: Date.now() };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function removeSavedExplorationBookmark(savedId: string): Promise<void> {
  const path = `savedExplorations/${savedId}`;
  try {
    await deleteDoc(doc(db, 'savedExplorations', savedId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchPrivateNote(conversationId: string): Promise<string> {
  const path = `notes/${conversationId}`;
  try {
    const snap = await getDoc(doc(db, 'notes', conversationId));
    if (!snap.exists()) return '';
    return String(snap.data().content ?? '');
  } catch {
    // Note might not exist yet -> permission check on non-existent note returns permission-denied when resource.data is checked on read!
    return '';
  }
}

export async function savePrivateNote(
  ownerUid: string,
  conversationId: string,
  content: string
): Promise<void> {
  const path = `notes/${conversationId}`;
  const noteRef = doc(db, 'notes', conversationId);
  const safeContent = content.slice(0, 10000);
  try {
    let exists = false;
    try {
      const existing = await getDoc(noteRef);
      exists = existing.exists();
    } catch {
      exists = false;
    }

    if (exists) {
      await updateDoc(noteRef, {
        content: safeContent,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(noteRef, {
        id: conversationId,
        ownerUid,
        conversationId,
        content: safeContent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createPublicShareSnapshot(
  ownerUid: string,
  turn: ExplorationTurn
): Promise<string> {
  const shareId = generateShareToken();
  const path = `shares/${shareId}`;
  try {
    // Strictly sanitized snapshot: NO private notes, NO conversationId, NO PII
    const cleanExplanation = sanitizeExplanationForFirestore(turn.explanation);
    await setDoc(doc(db, 'shares', shareId), {
      id: shareId,
      ownerUid,
      question: turn.question.slice(0, 1000),
      title: turn.explanation.title.slice(0, 160),
      explanation: cleanExplanation,
      schemaVersion: 1,
      createdAt: serverTimestamp(),
    });
    return shareId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchPublicShareSnapshot(shareId: string): Promise<{
  status: 'found' | 'not_found' | 'invalid' | 'version_mismatch';
  snapshot?: SharedSnapshot;
}> {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(shareId)) {
    return { status: 'invalid' };
  }
  const path = `shares/${shareId}`;
  try {
    const snap = await getDoc(doc(db, 'shares', shareId));
    if (!snap.exists()) {
      return { status: 'not_found' };
    }
    const data = snap.data();
    const version = Number(data.schemaVersion ?? 1);
    if (version !== 1) {
      return { status: 'version_mismatch' };
    }
    const validated = validateExplanationPayload(data.explanation, String(data.question ?? ''));
    return {
      status: 'found',
      snapshot: {
        id: snap.id,
        question: String(data.question ?? validated.question),
        title: String(data.title ?? validated.title),
        explanation: validated,
        schemaVersion: version,
        createdAt: toMillis(data.createdAt),
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export type GuestMigrationResult = {
  conversations: number;
  saved: number;
  notes: number;
};

/**
 * Promote a guest ("temp") workspace into the signed-in account.
 *
 * Guest threads/saves/notes live only in localStorage under client-generated
 * IDs. This writes each of them into the owner-scoped Firestore collections,
 * remapping guest IDs to the new cloud conversation IDs so bookmarks and
 * notes still point at the right conversations.
 *
 * Idempotency is handled by the caller via a localStorage marker keyed by uid.
 */
export async function migrateGuestDataToAccount(
  ownerUid: string,
  guestThreads: ExplorationThread[],
  guestSaved: SavedExplorationItem[],
  guestNotes: Record<string, string>
): Promise<GuestMigrationResult> {
  const result: GuestMigrationResult = { conversations: 0, saved: 0, notes: 0 };

  // guest thread id -> new cloud conversation id
  const conversationIdMap = new Map<string, string>();
  // `${guest conversation id}:${guest turn id}` -> new cloud message id
  const turnIdMap = new Map<string, string>();

  for (const thread of guestThreads) {
    if (!thread.turns.length) continue;
    let cloudConversationId: string | null = null;
    let messageCount = 0;

    for (const turn of thread.turns) {
      try {
        const { conversationId } = await persistConversationTurn(
          ownerUid,
          cloudConversationId,
          turn,
          thread.title,
          messageCount
        );
        if (!cloudConversationId) {
          cloudConversationId = conversationId;
          conversationIdMap.set(thread.id, conversationId);
          result.conversations += 1;
        }
        turnIdMap.set(`${thread.id}:${turn.id}`, turn.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128));
        messageCount += 1;
      } catch (err) {
        console.error('[ponder] failed to migrate guest turn:', err);
      }
    }

    const note = guestNotes[thread.id];
    if (cloudConversationId && note && note.trim()) {
      try {
        await savePrivateNote(ownerUid, cloudConversationId, note);
        result.notes += 1;
      } catch (err) {
        console.error('[ponder] failed to migrate guest note:', err);
      }
    }
  }

  for (const item of guestSaved) {
    const cloudConversationId = conversationIdMap.get(item.conversationId);
    if (!cloudConversationId) continue;
    const cloudTurnId = turnIdMap.get(`${item.conversationId}:${item.turnId}`) ?? item.turnId;
    try {
      await saveExplorationBookmark(ownerUid, {
        ...item,
        conversationId: cloudConversationId,
        turnId: cloudTurnId,
      });
      result.saved += 1;
    } catch (err) {
      console.error('[ponder] failed to migrate guest bookmark:', err);
    }
  }

  return result;
}

export async function deleteAllAccountDataInFirestore(ownerUid: string): Promise<void> {
  const convSnap = await getDocs(
    query(collection(db, 'conversations'), where('ownerUid', '==', ownerUid))
  );
  for (const cDoc of convSnap.docs) {
    await deleteConversationInFirestore(ownerUid, cDoc.id);
  }

  const savedSnap = await getDocs(
    query(collection(db, 'savedExplorations'), where('ownerUid', '==', ownerUid))
  );
  const notesSnap = await getDocs(
    query(collection(db, 'notes'), where('ownerUid', '==', ownerUid))
  );
  const sharesSnap = await getDocs(
    query(collection(db, 'shares'), where('ownerUid', '==', ownerUid))
  );

  const batch = writeBatch(db);
  savedSnap.docs.forEach((d) => batch.delete(d.ref));
  notesSnap.docs.forEach((d) => batch.delete(d.ref));
  sharesSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'users', ownerUid, 'private', 'info'));
  batch.delete(doc(db, 'users', ownerUid));
  await batch.commit();
}
