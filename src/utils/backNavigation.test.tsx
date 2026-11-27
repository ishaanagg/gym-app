import { act, fireEvent, render, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useBackGuard } from './backNavigation';

const LayeredHarness: React.FC = () => {
  const [tab, setTab] = useState<'today' | 'gym'>('today');
  const [modalOpen, setModalOpen] = useState(false);

  useBackGuard(tab !== 'today', () => setTab('today'), { priority: 'tab' });
  useBackGuard(modalOpen, () => setModalOpen(false), { priority: 'modal' });

  return (
    <div>
      <span data-testid="tab">{tab}</span>
      <span data-testid="modal">{modalOpen ? 'open' : 'closed'}</span>
      <button type="button" onClick={() => setTab('gym')}>
        Open Gym
      </button>
      <button type="button" onClick={() => setModalOpen(true)}>
        Open Modal
      </button>
      <button type="button" onClick={() => setModalOpen(false)}>
        Close Modal UI
      </button>
      <button type="button" onClick={() => setTab('today')}>
        Go Today UI
      </button>
    </div>
  );
};

describe('useBackGuard (Android Back swipe & iOS edge-swipe handling)', () => {
  it('pops modal first, then secondary tab, and leaves root history clean', async () => {
    const { getByTestId, getByText } = render(<LayeredHarness />);

    expect(window.history.state?.__kineticGuard).toBeUndefined();

    // Navigate to Gym tab + open Modal
    fireEvent.click(getByText('Open Gym'));
    fireEvent.click(getByText('Open Modal'));

    expect(getByTestId('tab')).toHaveTextContent('gym');
    expect(getByTestId('modal')).toHaveTextContent('open');
    expect(window.history.state?.__kineticGuard).toBe(true);

    // System Back #1 -> closes Modal, keeps Gym tab active and re-arms sentinel
    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(getByTestId('modal')).toHaveTextContent('closed');
      expect(getByTestId('tab')).toHaveTextContent('gym');
      expect(window.history.state?.__kineticGuard).toBe(true);
    });

    // System Back #2 -> returns from Gym tab to Today and leaves root history clean
    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(getByTestId('tab')).toHaveTextContent('today');
      expect(window.history.state?.__kineticGuard).toBeUndefined();
    });
  });

  it('closes modal on Escape without switching tabs, and cleans up sentinel on UI navigation', async () => {
    const { getByTestId, getByText } = render(<LayeredHarness />);

    fireEvent.click(getByText('Open Gym'));
    fireEvent.click(getByText('Open Modal'));

    // Escape closes modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getByTestId('modal')).toHaveTextContent('closed');
    expect(getByTestId('tab')).toHaveTextContent('gym');

    // Escape again does NOT switch tab (allowEscape is false for tab guards)
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getByTestId('tab')).toHaveTextContent('gym');

    // Closing via in-app UI button pops the sentinel cleanly
    fireEvent.click(getByText('Go Today UI'));
    await waitFor(() => {
      expect(getByTestId('tab')).toHaveTextContent('today');
      expect(window.history.state?.__kineticGuard).toBeUndefined();
    });
  });
});
