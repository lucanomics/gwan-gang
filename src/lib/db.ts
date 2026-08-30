import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Attempt,
  ConceptNote,
  MockExam,
  Preferences,
  Question,
  ReviewItem,
  StudySession,
} from './types';

export const DB_NAME = 'gwan-gang';
export const DB_VERSION = 1;

interface GwanGangDB extends DBSchema {
  questions: {
    key: string;
    value: Question;
    indexes: { by_subject: string };
  };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { by_question: string; by_time: string };
  };
  reviews: {
    key: string;
    value: ReviewItem;
    indexes: { by_due: string };
  };
  sessions: {
    key: string;
    value: StudySession;
  };
  mocks: {
    key: string;
    value: MockExam;
  };
  notes: {
    key: string;
    value: ConceptNote;
  };
  meta: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<GwanGangDB>> | null = null;

export function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function getDB(): Promise<IDBPDatabase<GwanGangDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GwanGangDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('questions')) {
          const store = db.createObjectStore('questions', { keyPath: 'id' });
          store.createIndex('by_subject', 'subject');
        }
        if (!db.objectStoreNames.contains('attempts')) {
          const store = db.createObjectStore('attempts', { keyPath: 'id' });
          store.createIndex('by_question', 'questionId');
          store.createIndex('by_time', 'attemptedAt');
        }
        if (!db.objectStoreNames.contains('reviews')) {
          const store = db.createObjectStore('reviews', { keyPath: 'questionId' });
          store.createIndex('by_due', 'dueAt');
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('mocks')) {
          db.createObjectStore('mocks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

export interface Snapshot {
  questions: Question[];
  attempts: Attempt[];
  reviews: ReviewItem[];
  sessions: StudySession[];
  mocks: MockExam[];
  notes: ConceptNote[];
  preferences: Preferences | undefined;
  activeSessionId: string | undefined;
  activeMockId: string | undefined;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await getDB();
  const [questions, attempts, reviews, sessions, mocks, notes] = await Promise.all([
    db.getAll('questions'),
    db.getAll('attempts'),
    db.getAll('reviews'),
    db.getAll('sessions'),
    db.getAll('mocks'),
    db.getAll('notes'),
  ]);
  const [preferences, activeSessionId, activeMockId] = await Promise.all([
    db.get('meta', 'preferences') as Promise<Preferences | undefined>,
    db.get('meta', 'activeSessionId') as Promise<string | undefined>,
    db.get('meta', 'activeMockId') as Promise<string | undefined>,
  ]);
  return {
    questions,
    attempts,
    reviews,
    sessions,
    mocks,
    notes,
    preferences,
    activeSessionId,
    activeMockId,
  };
}

export async function putQuestions(questions: Question[]): Promise<void> {
  if (!questions.length) return;
  const db = await getDB();
  const tx = db.transaction('questions', 'readwrite');
  await Promise.all(questions.map((q) => tx.store.put(q)));
  await tx.done;
}

export async function deleteQuestions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDB();
  const tx = db.transaction('questions', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

export async function putAttempt(attempt: Attempt): Promise<void> {
  const db = await getDB();
  await db.put('attempts', attempt);
}

export async function putAttempts(attempts: Attempt[]): Promise<void> {
  if (!attempts.length) return;
  const db = await getDB();
  const tx = db.transaction('attempts', 'readwrite');
  await Promise.all(attempts.map((a) => tx.store.put(a)));
  await tx.done;
}

export async function putReview(item: ReviewItem): Promise<void> {
  const db = await getDB();
  await db.put('reviews', item);
}

export async function putReviews(items: ReviewItem[]): Promise<void> {
  if (!items.length) return;
  const db = await getDB();
  const tx = db.transaction('reviews', 'readwrite');
  await Promise.all(items.map((r) => tx.store.put(r)));
  await tx.done;
}

export async function putSession(session: StudySession): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function putMock(mock: MockExam): Promise<void> {
  const db = await getDB();
  await db.put('mocks', mock);
}

export async function putNote(note: ConceptNote): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  if (value === undefined) {
    await db.delete('meta', key);
  } else {
    await db.put('meta', value, key);
  }
}

/** Wipes performance history. Question bank and notes are preserved separately. */
export async function clearProgress(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['attempts', 'reviews', 'sessions', 'mocks', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('attempts').clear(),
    tx.objectStore('reviews').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('mocks').clear(),
    tx.objectStore('meta').delete('activeSessionId'),
    tx.objectStore('meta').delete('activeMockId'),
  ]);
  await tx.done;
}

export async function clearEverything(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['questions', 'attempts', 'reviews', 'sessions', 'mocks', 'notes', 'meta'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('questions').clear(),
    tx.objectStore('attempts').clear(),
    tx.objectStore('reviews').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('mocks').clear(),
    tx.objectStore('notes').clear(),
    tx.objectStore('meta').clear(),
  ]);
  await tx.done;
}
