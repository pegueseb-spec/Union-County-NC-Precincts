import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/ChoroplethMap', () => ({
  ChoroplethMap: () => <div data-testid="choropleth-map">Mock Choropleth Map</div>,
}));

vi.mock('./components/HowToPanel', () => ({
  HowToPanel: () => <div>How-To Panel Content</div>,
}));

// Minimal NCSBE rows that pass normalizeVoterRecord / normalizeHistoryRecord
const MOCK_VOTER_ROW = {
  county_desc: 'UNION', precinct_abbrv: '01', party_cd: 'REP',
  race_code: 'W', ethnic_code: 'NL', sex_code: 'M', total_voters: 10,
  election_date: '2024-11-05', stats_type: 'A', age: 'Age 26 - 40', update_date: '2024-11-25',
};
const MOCK_HISTORY_ROW = {
  county_desc: 'UNION', precinct_abbrv: '01', party_cd: 'REP',
  race_code: 'W', ethnic_code: 'NL', sex_code: 'M', total_voters: 8,
  election_date: '2024-11-05', voting_method: 'EV', voted_party_cd: 'REP',
  stats_type: 'history', age: 'Age 26 - 40', update_date: '2024-11-25',
};
const MOCK_HISTORY_ROW_PREV = {
  county_desc: 'UNION', precinct_abbrv: '01', party_cd: 'REP',
  race_code: 'W', ethnic_code: 'NL', sex_code: 'M', total_voters: 5,
  election_date: '2023-11-07', voting_method: 'EV', voted_party_cd: 'REP',
  stats_type: 'history', age: 'Age 26 - 40', update_date: '2023-11-25',
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const body = url.includes('union_voter_stats') ? [MOCK_VOTER_ROW]
        : url.includes('union_history_stats') ? [MOCK_HISTORY_ROW_PREV, MOCK_HISTORY_ROW]
        : null;
      if (!body) return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
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
    expect(screen.getByLabelText(/^precinct$/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /scenario planner/i })).toBeInTheDocument();
    expect(screen.getByText(/confidence band \(estimated additional ballots\)/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /opportunity targets/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/opportunity action filter/i)).toBeInTheDocument();
    expect(screen.getByText(/data quality alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/recommended action/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export targets csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy assumptions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export planning bundle csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export scenario csv/i })).toBeInTheDocument();
    expect(screen.getByText(/reg \/ cvap/i)).toBeInTheDocument();
    expect(screen.getByText(/data quality and provenance/i)).toBeInTheDocument();
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

  it('shows trend signals with year-over-year turnout deltas', async () => {
    render(<App />);

    await screen.findByText(/trend signals \(2024 vs 2023\)/i);
    expect(screen.getByText(/county turnout Δ:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\+30.00 pts/i).length).toBeGreaterThan(0);
  });

  it('restores persisted dashboard controls from localStorage', async () => {
    window.localStorage.setItem('uci:selectedYear', '2023');
    window.localStorage.setItem('uci:selectedPrecinct', '01');
    window.localStorage.setItem('uci:scenarioTurnoutLiftPct', '12');
    window.localStorage.setItem('uci:opportunityActionFilter', 'GOTV Chase');

    render(<App />);

    await screen.findByText(/turnout choropleth map/i);

    const yearSelect = screen.getByLabelText(/election year/i) as HTMLSelectElement;
    const precinctSelect = screen.getByLabelText(/^precinct$/i) as HTMLSelectElement;
    const actionFilterSelect = screen.getByLabelText(/opportunity action filter/i) as HTMLSelectElement;
    const scenarioSlider = screen.getByLabelText(/modeled turnout lift across selected year and precinct filter/i) as HTMLInputElement;

    expect(yearSelect.value).toBe('2023');
    expect(precinctSelect.value).toBe('01');
    expect(actionFilterSelect.value).toBe('GOTV Chase');
    expect(scenarioSlider.value).toBe('12');
  });

  it('rejects unsupported upload file types', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/turnout choropleth map/i);
    await user.click(screen.getByRole('button', { name: /data upload/i }));

    const fileInputs = await screen.findAllByLabelText(/select file/i);
    const invalidFile = new File(['malformed'], 'payload.exe', { type: 'application/octet-stream' });

    fireEvent.change(fileInputs[0], { target: { files: [invalidFile] } });

    expect(await screen.findByText(/upload rejected: only .txt and .csv files are accepted/i)).toBeInTheDocument();
  });

  it('shows focused field packet export when a precinct is selected', async () => {
    render(<App />);

    await screen.findByText(/turnout choropleth map/i);
    const precinctSelect = screen.getByLabelText(/^precinct$/i);
    fireEvent.change(precinctSelect, { target: { value: '01' } });

    expect(await screen.findByRole('button', { name: /export field packet/i })).toBeInTheDocument();
  });
});