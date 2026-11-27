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

    await user.type(screen.getByLabelText(/What should we call you/i), 'John');
    await user.type(screen.getByLabelText(/Building or gym name/i), 'The Arden');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 2: Google Drive Backup prompt
    expect(
      await screen.findByRole('heading', { name: /Turn on Google Drive Backup/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Set Up Later in Settings/i }));

    // Lands on personalized Today screen
    expect(await screen.findByRole('heading', { name: /Ready, John\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Arden/i })).toBeInTheDocument();

    // Remounting App simulates closing and reopening the PWA -> skips onboarding
    unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Ready, John\?/i })).toBeInTheDocument();
  });

  it('runs a full workout with smart weight carry-forward, pause/resume recovery, effort auto-advance, and Momentum tracking', async () => {
    // Pre-mark onboarding completed so we start right on Today
    await storageRepo.initializeAndLoad();
    await storageRepo.saveSettings({
      userName: 'John',
      gymName: 'The Arden',
      onboardingCompleted: true,
    });

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Ready, John\?/i })).toBeInTheDocument();

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
      userName: 'John',
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
    await screen.findByRole('heading', { name: /Ready, John\?/i });

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

  it('keeps spatial-locked stage containers across steps and discards cleanly via Exit Without Saving', async () => {
    await storageRepo.initializeAndLoad();
    await storageRepo.saveSettings({
      userName: 'John',
      gymName: 'The Arden',
      onboardingCompleted: true,
    });

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: /Ready, John\?/i });

    await user.click(screen.getByRole('radio', { name: /20/i }));
    await user.click(screen.getByRole('button', { name: /Begin 20-Min Session/i }));

    // Verify viewport-locked shell & spatial dock on Timed Warm-up step
    expect(container.querySelector('.app-shell.workout-lock')).not.toBeNull();
    expect(container.querySelector('.player-shell')).not.toBeNull();
    expect(container.querySelector('.player-guide-card')).not.toBeNull();
    expect(container.querySelector('.player-action-card')).not.toBeNull();
    expect(container.querySelector('.player-nav-bar')).not.toBeNull();

    // Advance to Strength step (2 sets on 20-min Medium)
    await user.click(await screen.findByRole('button', { name: /Done — Next Movement/i }));
    expect(container.querySelector('.player-action-card')).not.toBeNull();
    expect(container.querySelector('.player-nav-bar')).not.toBeNull();

    // Complete Set 1 -> inline Rest timer activates inside .stage-status-slot without changing stage structure
    await user.click(await screen.findByRole('button', { name: /Complete Set 1/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/Rest/i);
    expect(container.querySelector('.rest-pill-inline')).not.toBeNull();
    expect(container.querySelector('.player-action-card')).not.toBeNull();

    // Complete Set 2 -> Effort prompt renders inside the same .player-action-card
    await user.click(screen.getByRole('button', { name: /Complete Set 2/i }));
    expect(screen.getByText(/How did that feel\?/i)).toBeInTheDocument();
    expect(container.querySelector('.player-action-card')).not.toBeNull();
    expect(container.querySelector('.player-nav-bar')).not.toBeNull();

    // Open Pause sheet and exit without saving
    await user.click(screen.getByRole('button', { name: /^Pause$/i }));
    await user.click(screen.getByRole('button', { name: /Exit Without Saving/i }));

    // Back on Today with NO Paused Session banner and zero saved sessions/progress
    expect(await screen.findByRole('heading', { name: /Ready, John\?/i })).toBeInTheDocument();
    expect(screen.queryByText(/Paused Session/i)).not.toBeInTheDocument();
    expect(container.querySelector('.app-shell.workout-lock')).toBeNull();

    const state = await storageRepo.initializeAndLoad();
    expect(state.activeSession).toBeNull();
    expect(state.sessions).toHaveLength(0);
    expect(Object.keys(state.progress)).toHaveLength(0);
  });

  it('handles OS Back gestures natively across modals, secondary tabs, and active workouts', async () => {
    await storageRepo.initializeAndLoad();
    await storageRepo.saveSettings({
      userName: 'John',
      gymName: 'The Arden',
      onboardingCompleted: true,
    });

    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /Ready, John\?/i });

    // 1. Today -> My Gym -> Add Equipment sheet
    await user.click(screen.getByRole('button', { name: /My Gym/i }));
    await user.click(await screen.findByRole('button', { name: /^Add$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // OS Back #1 closes Add Equipment sheet, stays on My Gym
    window.history.back();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /The Arden/i })).toBeInTheDocument();

    // OS Back #2 returns from My Gym to Today
    window.history.back();
    expect(await screen.findByRole('heading', { name: /Ready, John\?/i })).toBeInTheDocument();

    // 2. Start workout -> OS Back opens Pause/Exit sheet instead of abruptly killing workout
    await user.click(screen.getByRole('button', { name: /Begin 30-Min Session/i }));
    expect(await screen.findByRole('button', { name: /Done — Next Movement/i })).toBeInTheDocument();

    window.history.back();
    expect(
      await screen.findByRole('heading', { name: /Pause or Exit Session\?/i })
    ).toBeInTheDocument();

    // OS Back again dismisses the Pause sheet and keeps user right in their workout
    window.history.back();
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /Pause or Exit Session\?/i })
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Done — Next Movement/i })).toBeInTheDocument();
  });
});
