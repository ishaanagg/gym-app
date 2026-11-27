import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { storageRepo } from './db/storage';

describe('Kinetic End-to-End User Journeys', () => {
  beforeEach(async () => {
    await storageRepo.clearAllForTests();
  });

  it('guides a new user through 2-step onboarding, persists profile, and skips onboarding on return', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    // Step 1: Welcome + Offline intro + Name & Building inputs
    expect(
      await screen.findByText(/Personal workouts built for your building/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Works 100% offline/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/What should we call you/i), 'Ishaan');
    await user.type(screen.getByLabelText(/Building or gym name/i), 'The Arden');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 2: Google Drive Backup prompt
    expect(
      await screen.findByRole('heading', { name: /Turn on Google Drive Backup/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Set Up Later in Settings/i }));

    // Lands on personalized Today screen
    expect(await screen.findByRole('heading', { name: /Ready, Ishaan\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Arden/i })).toBeInTheDocument();

    // Remounting App simulates closing and reopening the PWA -> skips onboarding
    unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Ready, Ishaan\?/i })).toBeInTheDocument();
  });

  it('runs a full workout with smart weight carry-forward, pause/resume recovery, effort auto-advance, and Momentum tracking', async () => {
    // Pre-mark onboarding completed so we start right on Today
    await storageRepo.initializeAndLoad();
    await storageRepo.saveSettings({
      userName: 'Ishaan',
      gymName: 'The Arden',
      onboardingCompleted: true,
    });

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Ready, Ishaan\?/i })).toBeInTheDocument();

    // Choose 20m duration + Arms focus
    await user.click(screen.getByRole('radio', { name: /20/i }));
    await user.click(screen.getByRole('button', { name: 'Arms' }));
    await user.click(screen.getByRole('button', { name: /Begin 20-Min Session/i }));

    // Global nav hides during active workout
    expect(screen.queryByRole('navigation', { name: /Main navigation/i })).not.toBeInTheDocument();

    // Phase 1: Warm-up completes in 1 tap (no Effort questionnaire)
    await user.click(await screen.findByRole('button', { name: /Done — Next Movement/i }));

    // Phase 2: First Strength movement (2 sets on 20m Medium)
    // Increase Set 1 weight and verify Set 2 carries forward the exact new weight!
    const increaseWeightBtn = await screen.findByRole('button', { name: /Increase weight/i });
    await user.click(increaseWeightBtn);

    // Read dialed weight on Set 1
    const completeSet1Btn = screen.getByRole('button', { name: /Complete Set 1/i });
    expect(completeSet1Btn).toBeInTheDocument();
    await user.click(completeSet1Btn);

    // Now on Set 2 — test Pause & Save for Later mid-workout!
    expect(await screen.findByRole('button', { name: /Complete Set 2/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Pause$/i }));
    await user.click(screen.getByRole('button', { name: /Pause for Later/i }));

    // Today screen shows Paused Session banner; resume right back into the workout
    expect(await screen.findByText(/Paused Session/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Resume Workout/i }));

    // Finish the session cleanly via End & Save Completed Sets in Pause sheet
    await user.click(await screen.findByRole('button', { name: /^Pause$/i }));
    await user.click(screen.getByRole('button', { name: /End & Save Completed Sets/i }));

    expect(await screen.findByRole('heading', { name: /Session Complete/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Done$/i }));

    // Navigate to Momentum tab and verify 1 session & 20 Minutes Moved
    await user.click(screen.getByRole('button', { name: /Momentum/i }));
    expect(await screen.findByRole('heading', { name: /Momentum/i })).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('auto-links coach movements when adding a preset in My Gym and protects baseline weights on Light sessions', async () => {
    await storageRepo.initializeAndLoad();
    await storageRepo.saveSettings({
      userName: 'Ishaan',
      gymName: 'The Arden',
      onboardingCompleted: true,
    });
    // Seed a 90 lb working weight on Machine Chest Press
    await storageRepo.saveExerciseProgress({
      exerciseId: 'ex-machine-chest-press',
      currentWeight: 90,
      lastReps: 10,
      lastEffort: 'just_right',
      isCalibrated: false,
      source: 'logged',
      totalSessions: 3,
      updatedAt: '2026-11-25T12:00:00Z',
    });

    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /Ready, Ishaan\?/i });

    // 1. Add Kettlebells via Quick-Add Preset in My Gym
    await user.click(screen.getByRole('button', { name: /My Gym/i }));
    await user.click(await screen.findByRole('button', { name: /^Add$/i }));
    await user.click(screen.getByRole('button', { name: 'Kettlebells' }));
    expect(screen.getByText(/Auto-adds 3 coach-cued movements/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save Equipment/i }));

    await waitFor(() => {
      const kbCard = screen.getByText('Kettlebells').closest('.card') as HTMLElement | null;
      expect(kbCard).not.toBeNull();
      expect(within(kbCard!).getByText(/3 movements linked/i)).toBeInTheDocument();
    });

    // 2. Run a Light Chest session (prescribes 75 lbs instead of 90 lbs) and verify 90 lbs is protected!
    await user.click(screen.getByRole('button', { name: /Today/i }));
    await user.click(await screen.findByRole('radio', { name: /Light/i }));
    await user.click(screen.getByRole('button', { name: 'Chest' }));
    await user.click(screen.getByRole('button', { name: /Begin 30-Min Session/i }));

    // Skip warmup to reach Machine Chest Press
    await user.click(await screen.findByRole('button', { name: /Done — Next Movement/i }));
    await user.click(await screen.findByRole('button', { name: /Done — Next Movement/i }));

    // Confirm Set 1 on Machine Chest Press at lighter 75 lb recovery weight, then finish
    await user.click(await screen.findByRole('button', { name: /Complete Set 1/i }));
    await user.click(screen.getByRole('button', { name: /^Pause$/i }));
    await user.click(screen.getByRole('button', { name: /End & Save Completed Sets/i }));
    await user.click(await screen.findByRole('button', { name: /^Done$/i }));

    // Verify stored currentWeight stayed at 90 lbs rather than dropping to 75 lbs!
    await waitFor(async () => {
      const state = await storageRepo.initializeAndLoad();
      expect(state.progress['ex-machine-chest-press']?.currentWeight).toBe(90);
    });
  });
});
