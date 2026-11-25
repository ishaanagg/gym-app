import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { mergeExercisesWithDefaults } from './backfill';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { DEFAULT_EQUIPMENT, DEFAULT_GYM_ID } from '../data/defaultInventory';
import type {
  AppSettings,
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
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  userName: '',
  gymName: 'My Building Gym',
};

export interface StorageRepository {
  initializeAndLoad(): Promise<LoadedGymState>;
  saveEquipment(item: Equipment): Promise<void>;
  /** Removes a machine plus any custom exercises linked to it. History is kept. */
  deleteEquipment(id: string): Promise<void>;
  saveExercise(exercise: Exercise): Promise<void>;
  saveWorkoutSession(session: WorkoutSession): Promise<void>;
  saveExerciseProgress(entry: ExerciseProgress): Promise<void>;
  saveActiveSession(session: WorkoutSession | null): Promise<void>;
  saveSettings(settings: AppSettings): Promise<void>;
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
const SETTINGS_KEY = 'settings';
/** Set once defaults are seeded so deleting every machine doesn't re-seed them on next load. */
const EQUIPMENT_SEEDED_KEY = 'equipmentSeeded';

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
    const seeded = Boolean((await db.get('meta', EQUIPMENT_SEEDED_KEY))?.value);
    if (equipment.length === 0 && !seeded) {
      const tx = db.transaction('equipment', 'readwrite');
      await Promise.all(DEFAULT_EQUIPMENT.map((item) => tx.store.put(item)));
      await tx.done;
      equipment = DEFAULT_EQUIPMENT;
    }
    if (!seeded) {
      await db.put('meta', { key: EQUIPMENT_SEEDED_KEY, value: true });
    }
    // Backfill schema fields added in v2 for existing local rows
    equipment = equipment.map((item) => ({
      ...item,
      gymId: item.gymId ?? DEFAULT_GYM_ID,
      weightUnit: item.weightUnit ?? 'lbs',
    }));

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

    const settingsMeta = await db.get('meta', SETTINGS_KEY);
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...((settingsMeta?.value as Partial<AppSettings> | undefined) ?? {}),
    };

    return { equipment, exercises, sessions, progress, activeSession, settings };
  }

  async saveEquipment(item: Equipment): Promise<void> {
    const db = await this.getDB();
    await db.put('equipment', item);
  }

  async deleteEquipment(id: string): Promise<void> {
    const db = await this.getDB();
    const defaultIds = new Set(DEFAULT_EXERCISES.map((e) => e.id));
    const linkedCustom = (await db.getAll('exercises')).filter(
      (ex) => ex.equipmentId === id && !defaultIds.has(ex.id)
    );
    const tx = db.transaction(['equipment', 'exercises'], 'readwrite');
    await tx.objectStore('equipment').delete(id);
    for (const ex of linkedCustom) await tx.objectStore('exercises').delete(ex.id);
    await tx.done;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    await db.put('meta', { key: SETTINGS_KEY, value: settings });
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
    const { equipment, exercises, sessions, progress, settings } = await this.initializeAndLoad();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      equipment,
      exercises,
      sessions,
      progress: Object.values(progress),
      settings,
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
    await tx.objectStore('meta').put({ key: EQUIPMENT_SEEDED_KEY, value: true });
    if (data.settings) {
      await tx.objectStore('meta').put({ key: SETTINGS_KEY, value: data.settings });
    }
    await tx.done;
  }
}

export const storageRepo: StorageRepository = new IndexedDBStorageRepository();
