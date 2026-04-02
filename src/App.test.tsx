import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/ChoroplethMap', () => ({
  ChoroplethMap: () => <div data-testid="choropleth-map">Mock Choropleth Map</div>,
}));

vi.mock('./components/HowToPanel', () => ({
  HowToPanel: () => <div>How-To Panel Content</div>,
}));

const demoFiles = {
  voter: `county_desc,precinct_abbrv,party_cd,race_code,sex_code,total_voters\nUNION,01,REP,W,M,10\nUNION,01,DEM,B,F,5\n`,
  history: `county_desc,precinct_abbrv,party_cd,race_code,sex_code,election_date,total_voters\nUNION,01,REP,W,M,2024-11-05,6\nUNION,01,DEM,B,F,2024-11-05,3\n`,
  cvap: `county_desc,precinct_abbrv,year,cvap_total\nUNION,01,2024,30\n`,
};

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = String(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

      if (url.includes('demo-voter.csv')) {
        return Promise.resolve(new Response(demoFiles.voter, { status: 200 }));
      }

      if (url.includes('demo-history.csv')) {
        return Promise.resolve(new Response(demoFiles.history, { status: 200 }));
      }

      if (url.includes('demo-cvap.csv')) {
        return Promise.resolve(new Response(demoFiles.cvap, { status: 200 }));
      }

      return Promise.resolve(new Response('', { status: 404 }));
    }));
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
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
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