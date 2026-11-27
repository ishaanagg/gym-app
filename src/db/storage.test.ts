import { describe, expect, it } from 'vitest';
import { DEFAULT_EQUIPMENT, DEFAULT_GYM_ID } from '../data/defaultInventory';
import type { Exercise, GymExportData, WorkoutSession } from '../types/gym';
import { IndexedDBStorageRepository } from './storage';

describe('IndexedDBStorageRepository', () => {
  it('seeds default equipment and exercises on first load', async () => {
    const repo = new IndexedDBStorageRepository('test-seed-db');
    const state = await repo.initializeAndLoad();

    expect(state.equipment.length).toBe(DEFAULT_EQUIPMENT.length);
    expect(state.exercises.length).toBeGreaterThan(20);
    expect(state.activeSession).toBeNull();
    expect(state.settings.gymName).toBe('My Building Gym');
  });

  it('does NOT re-seed defaults if the user intentionally deletes every machine', async () => {
    const repo = new IndexedDBStorageRepository('test-delete-all-db');
    const initial = await repo.initializeAndLoad();

    for (const eq of initial.equipment) {
      await repo.deleteEquipment(eq.id);
    }

    const afterDelete = await repo.initializeAndLoad();
    expect(afterDelete.equipment).toEqual([]);
  });

  it('cascade-deletes custom exercises linked to a removed machine while keeping workout history', async () => {
    const repo = new IndexedDBStorageRepository('test-cascade-db');
    await repo.initializeAndLoad();

    await repo.saveEquipment({
      id: 'eq-custom-1',
      gymId: DEFAULT_GYM_ID,
      name: 'Custom Preacher Bench',
      category: 'machine',
      weightUnit: 'lbs',
      weightOptions: [20, 40, 60],
      isAvailable: true,
    });

    const customEx: Exercise = {
      id: 'ex-custom-preacher',
      name: 'Preacher Curl',
      equipmentId: 'eq-custom-1',
      block: 'strength',
      pattern: 'upper_isolation',
      repRange: [10, 12],
      visualKey: 'arm_curl',
      safetyCues: ['Keep upper arms on pad.', 'Control the lowering phase.'],
    };
    await repo.saveExercise(customEx);

    const loggedSession: WorkoutSession = {
      id: 'sess-1',
      gymId: DEFAULT_GYM_ID,
      status: 'completed',
      createdAt: '2026-11-26T10:00:00Z',
      completedAt: '2026-11-26T10:30:00Z',
      durationMin: 30,
      blocks: [],
    };
    await repo.saveWorkoutSession(loggedSession);

    await repo.deleteEquipment('eq-custom-1');
    const reloaded = await repo.initializeAndLoad();

    expect(reloaded.equipment.find((e) => e.id === 'eq-custom-1')).toBeUndefined();
    expect(reloaded.exercises.find((e) => e.id === 'ex-custom-preacher')).toBeUndefined();
    expect(reloaded.sessions.length).toBe(1);
  });

  it('persists and clears in-progress activeSession for mid-workout crash recovery', async () => {
    const repo = new IndexedDBStorageRepository('test-active-session-db');
    await repo.initializeAndLoad();

    const active: WorkoutSession = {
      id: 'sess-active',
      gymId: DEFAULT_GYM_ID,
      status: 'in_progress',
      createdAt: '2026-11-26T11:00:00Z',
      durationMin: 20,
      blocks: [],
    };
    await repo.saveActiveSession(active);

    const midState = await repo.initializeAndLoad();
    expect(midState.activeSession?.id).toBe('sess-active');

    await repo.saveActiveSession(null);
    const clearedState = await repo.initializeAndLoad();
    expect(clearedState.activeSession).toBeNull();
  });

  it('round-trips exportAll() and importAll() cleanly and marks legacy backups as onboarded', async () => {
    const sourceRepo = new IndexedDBStorageRepository('test-export-src');
    await sourceRepo.initializeAndLoad();
    await sourceRepo.saveSettings({
      userName: 'Ishaan',
      gymName: 'Skyline Gym',
      onboardingCompleted: true,
      driveBackupEnabled: true,
    });
    await sourceRepo.saveExerciseProgress({
      exerciseId: 'ex-machine-chest-press',
      currentWeight: 90,
      lastReps: 10,
      lastEffort: 'just_right',
      isCalibrated: false,
      source: 'logged',
      totalSessions: 4,
      updatedAt: '2026-11-26T12:00:00Z',
    });

    const exported = await sourceRepo.exportAll();

    const targetRepo = new IndexedDBStorageRepository('test-import-dest');
    await targetRepo.importAll(exported);
    const restored = await targetRepo.initializeAndLoad();

    expect(restored.settings.userName).toBe('Ishaan');
    expect(restored.settings.gymName).toBe('Skyline Gym');
    expect(restored.settings.onboardingCompleted).toBe(true);
    expect(restored.progress['ex-machine-chest-press']?.currentWeight).toBe(90);

    // Legacy v1 backup without settings field still sets onboardingCompleted: true
    const legacyBackup: GymExportData = { ...exported, settings: undefined };
    await targetRepo.importAll(legacyBackup);
    const legacyRestored = await targetRepo.initializeAndLoad();
    expect(legacyRestored.settings.onboardingCompleted).toBe(true);

    // Invalid backup version throws cleanly
    await expect(
      targetRepo.importAll({ version: 99 as 1, exportedAt: '', equipment: [], exercises: [], sessions: [], progress: [] })
    ).rejects.toThrow(/Unsupported/);
  });
});
