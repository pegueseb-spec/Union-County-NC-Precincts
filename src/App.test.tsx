import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/ChoroplethMap', () => ({
  ChoroplethMap: () => <div data-testid="choropleth-map">Mock Choropleth Map</div>,
}));

vi.mock('./components/HowToPanel', () => ({
  HowToPanel: () => <div>How-To Panel Content</div>,
}));

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the upload screen by default', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /loading data|reload built-in dataset/i })).toBeInTheDocument();
    expect(screen.getByText(/voter registration/i)).toBeInTheDocument();
    expect(screen.getByText(/voter history/i)).toBeInTheDocument();
    expect(screen.getByText(/census cvap/i)).toBeInTheDocument();
  });

  it('auto-loads built-in data and opens the dashboard', async () => {
    render(<App />);

    await screen.findByText(/turnout choropleth map/i);
    expect(screen.getByLabelText(/election year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/precinct/i)).toBeInTheDocument();
    expect(screen.getByText(/reg \/ cvap/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /precinct insights/i })).toBeInTheDocument();
  });

  it('shows the how-to tab content', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /how-to/i }));

    await waitFor(() => {
      expect(screen.getByText(/how-to panel content/i)).toBeInTheDocument();
    });
  });
});