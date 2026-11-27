import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { EQUIPMENT_ARCHETYPES } from '../data/knowledgeBase';
import { backfillExercise } from '../db/backfill';
import type { Exercise } from '../types/gym';
import { FormVisual } from './FormVisual';

describe('FormVisual 2-step anatomical exercise guides', () => {
  it('gives distinct, accurate 2-step visual guides to Cat-Cow, World’s Greatest Stretch, Dead Bug, Glute Bridge, and Figure-4', () => {
    const byId = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e]));

    expect(byId.get('ex-cat-cow-thoracic')!.visualKey).toBe('cat_cow');
    expect(byId.get('ex-worlds-greatest')!.visualKey).toBe('worlds_greatest');
    expect(byId.get('ex-dead-bug')!.visualKey).toBe('dead_bug');
    expect(byId.get('ex-bw-glute-bridge')!.visualKey).toBe('glute_bridge');
    expect(byId.get('ex-figure-four-stretch')!.visualKey).toBe('figure_four');
    expect(byId.get('ex-childs-pose-lat')!.visualKey).toBe('childs_pose');
    expect(byId.get('ex-hip-flexor-stretch')!.visualKey).toBe('hip_flexor_stretch');

    render(<FormVisual visualKey="cat_cow" label="Cat-Cow" />);
    expect(screen.getByText(/Cow Arch/i)).toBeInTheDocument();
    expect(screen.getByText(/Cat Round/i)).toBeInTheDocument();
  });

  it('renders a distinct 2-panel Start -> Action guide for every exercise in DEFAULT_EXERCISES and EQUIPMENT_ARCHETYPES', () => {
    const allKeys = new Set([
      ...DEFAULT_EXERCISES.map((e) => e.visualKey),
      ...EQUIPMENT_ARCHETYPES.flatMap((a) => a.exercises.map((e) => e.visualKey)),
    ]);

    for (const key of allKeys) {
      cleanup();
      const { container } = render(<FormVisual visualKey={key} />);
      const svgs = container.querySelectorAll('svg.guide-svg');
      const captions = container.querySelectorAll('.guide-caption');
      expect(svgs.length).toBe(2);
      expect(captions.length).toBe(2);
      expect(captions[0].textContent).not.toBe(captions[1].textContent);
    }
  });

  it('upgrades existing IndexedDB rows with outdated visualKeys automatically via backfillExercise', () => {
    const defaultsById = new Map(DEFAULT_EXERCISES.map((d) => [d.id, d]));
    const staleCatCow: Exercise = {
      ...defaultsById.get('ex-cat-cow-thoracic')!,
      visualKey: 'mobility_flow',
    };

    const upgraded = backfillExercise(staleCatCow, defaultsById);
    expect(upgraded.visualKey).toBe('cat_cow');
  });
});
