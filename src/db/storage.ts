import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { mergeExercisesWithDefaults } from './backfill';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { DEFAULT_EQUIPMENT, DEFAULT_GYM_ID } from '../data/defaultInventory';
import type {
  Equipment,
  Exercise,
  ExerciseProgress,
  GymExportData,
  WorkoutSession,
} from '../types/gym';

export interface LoadedGymState {
  equipment: Equipment[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  progress: Record<string, ExerciseProgress>;
  activeSession: WorkoutSession | null;
}

export interface StorageRepository {
  initializeAndLoad(): Promise<LoadedGymState>;
  saveEquipment(item: Equipment): Promise<void>;
  deleteEquipment(id: string): Promise<void>;
  saveExercise(exercise: Exercise): Promise<void>;
  saveWorkoutSession(session: WorkoutSession): Promise<void>;
  saveExerciseProgress(entry: ExerciseProgress): Promise<void>;
  saveActiveSession(session: WorkoutSession | null): Promise<void>;
  exportAll(): Promise<GymExportData>;
  importAll(data: GymExportData): Promise<void>;
}

interface GymDB extends DBSchema {
  equipment: {
    key: string;
    value: Equipment;
  };
  exercises: {
    key: string;
    value: Exercise;
  };
  sessions: {
    key: string;
    value: WorkoutSession;
  };
  progress: {
    key: string;
    value: ExerciseProgress;
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = 'gym-copilot-db';
const DB_VERSION = 2;
const ACTIVE_SESSION_KEY = 'activeSession';

class IndexedDBStorageRepository implements StorageRepository {
  private dbPromise: Promise<IDBPDatabase<GymDB>> | null = null;

  private getDB(): Promise<IDBPDatabase<GymDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<GymDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('equipment')) {
            db.createObjectStore('equipment', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('exercises')) {
            db.createObjectStore('exercises', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('sessions')) {
            db.createObjectStore('sessions', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('progress')) {
            db.createObjectStore('progress', { keyPath: 'exerciseId' });
          }
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'key' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async initializeAndLoad(): Promise<LoadedGymState> {
    const db = await this.getDB();

    let equipment = await db.getAll('equipment');
    if (equipment.length === 0) {
      const tx = db.transaction('equipment', 'readwrite');
      await Promise.all(DEFAULT_EQUIPMENT.map((item) => tx.store.put(item)));
      await tx.done;
      equipment = DEFAULT_EQUIPMENT;
    } else {
      // Backfill schema fields added in v2 for existing local rows
      equipment = equipment.map((item) => ({
        ...item,
        gymId: item.gymId ?? DEFAULT_GYM_ID,
        weightUnit: item.weightUnit ?? 'lbs',
      }));
    }

    const storedExercises = await db.getAll('exercises');
    const { merged: exercises, changed } = mergeExercisesWithDefaults(
      storedExercises,
      DEFAULT_EXERCISES
    );
    if (changed.length > 0) {
      const tx = db.transaction('exercises', 'readwrite');
      await Promise.all(changed.map((ex) => tx.store.put(ex)));
      await tx.done;
    }

    const sessions = (await db.getAll('sessions'))
      .map((s) => ({
        ...s,
        gymId: s.gymId ?? DEFAULT_GYM_ID,
        status: s.status ?? (s.completedAt ? 'completed' : 'planned'),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const progressList = await db.getAll('progress');
    const progress: Record<string, ExerciseProgress> = {};
    for (const p of progressList) {
      progress[p.exerciseId] = {
        ...p,
        isCalibrated: p.isCalibrated ?? false,
        source: p.source ?? 'logged',
      };
    }

    const activeMeta = await db.get('meta', ACTIVE_SESSION_KEY);
    const activeSession = (activeMeta?.value as WorkoutSession | undefined) ?? null;

    return { equipment, exercises, sessions, progress, activeSession };
  }

  async saveEquipment(item: Equipment): Promise<void> {
    const db = await this.getDB();
    await db.put('equipment', item);
  }

  async deleteEquipment(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('equipment', id);
  }

  async saveExercise(exercise: Exercise): Promise<void> {
    const db = await this.getDB();
    await db.put('exercises', exercise);
  }

  async saveWorkoutSession(session: WorkoutSession): Promise<void> {
    const db = await this.getDB();
    await db.put('sessions', session);
  }

  async saveExerciseProgress(entry: ExerciseProgress): Promise<void> {
    const db = await this.getDB();
    await db.put('progress', entry);
  }

  async saveActiveSession(session: WorkoutSession | null): Promise<void> {
    const db = await this.getDB();
    if (session === null) {
      await db.delete('meta', ACTIVE_SESSION_KEY);
    } else {
      await db.put('meta', { key: ACTIVE_SESSION_KEY, value: session });
    }
  }

  async exportAll(): Promise<GymExportData> {
    const { equipment, exercises, sessions, progress } = await this.initializeAndLoad();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      equipment,
      exercises,
      sessions,
      progress: Object.values(progress),
    };
  }

  async importAll(data: GymExportData): Promise<void> {
    if (!data || data.version !== 1) {
      throw new Error('Unsupported backup file format.');
    }
    const db = await this.getDB();
    const tx = db.transaction(
      ['equipment', 'exercises', 'sessions', 'progress', 'meta'],
      'readwrite'
    );
    await Promise.all([
      tx.objectStore('equipment').clear(),
      tx.objectStore('exercises').clear(),
      tx.objectStore('sessions').clear(),
      tx.objectStore('progress').clear(),
      tx.objectStore('meta').clear(),
    ]);
    for (const item of data.equipment ?? []) await tx.objectStore('equipment').put(item);
    for (const ex of data.exercises ?? []) await tx.objectStore('exercises').put(ex);
    for (const s of data.sessions ?? []) await tx.objectStore('sessions').put(s);
    for (const p of data.progress ?? []) await tx.objectStore('progress').put(p);
    await tx.done;
  }
}

export const storageRepo: StorageRepository = new IndexedDBStorageRepository();
