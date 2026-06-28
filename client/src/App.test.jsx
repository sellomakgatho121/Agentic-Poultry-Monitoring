/**
 * Boonducks Farm PLF Engine - Frontend Component Tests
 * Tests the Kinetic Industrial Glass Dashboard via Vitest + React Testing Library.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock framer-motion to render children without animations
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag) => {
      return React.forwardRef(({ children, ...props }, ref) => {
        // Filter out framer-specific props
        const domProps = {};
        for (const [key, value] of Object.entries(props)) {
          if (!['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'layout'].includes(key)) {
            domProps[key] = value;
          }
        }
        return React.createElement(tag, { ...domProps, ref }, children);
      });
    },
  }),
  AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
}));

// Mock recharts to render simple containers
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  AreaChart: ({ children }) => React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Area: () => null,
  LineChart: ({ children }) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => null,
  BarChart: ({ children }) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const createIcon = (name) => {
    const Icon = (props) => React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
    Icon.displayName = name;
    return Icon;
  };
  return {
    Activity: createIcon('Activity'),
    Thermometer: createIcon('Thermometer'),
    Droplets: createIcon('Droplets'),
    Wind: createIcon('Wind'),
    TrendingUp: createIcon('TrendingUp'),
    DollarSign: createIcon('DollarSign'),
    AlertTriangle: createIcon('AlertTriangle'),
    CheckCircle: createIcon('CheckCircle'),
    ShieldAlert: createIcon('ShieldAlert'),
    Calendar: createIcon('Calendar'),
    Egg: createIcon('Egg'),
    RefreshCw: createIcon('RefreshCw'),
    Camera: createIcon('Camera'),
    Volume2: createIcon('Volume2'),
    Layers: createIcon('Layers'),
  };
});

// Import App after all mocks are set up
import App from './App';

describe('App Component', () => {
  beforeEach(() => {
    // Reset fetch mock for each test
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve([]),
      })
    );
  });

  it('renders the main header with farm name', () => {
    render(React.createElement(App));
    expect(screen.getByText('BOONDUCKS FARM')).toBeDefined();
  });

  it('renders the PLF Engine version badge', () => {
    render(React.createElement(App));
    expect(screen.getByText('PLF ENGINE v2.0')).toBeDefined();
  });

  it('renders the flock node description', () => {
    render(React.createElement(App));
    expect(screen.getByText(/1,242-Layer Flock Node/)).toBeDefined();
  });

  it('renders the Dashboard Overview tab as active by default', () => {
    render(React.createElement(App));
    expect(screen.getByText('Dashboard Overview')).toBeDefined();
  });

  it('renders all navigation tabs', () => {
    render(React.createElement(App));
    expect(screen.getByText('Dashboard Overview')).toBeDefined();
    expect(screen.getByText('Environmental Telemetry')).toBeDefined();
    expect(screen.getByText('Edge-AI Stress Analytics')).toBeDefined();
    expect(screen.getByText('Financial Protection')).toBeDefined();
  });

  it('renders simulation control buttons', () => {
    render(React.createElement(App));
    expect(screen.getByText('Heat Stress')).toBeDefined();
    expect(screen.getByText('Ammonia Spike')).toBeDefined();
  });

  it('renders coop cards in the overview', () => {
    render(React.createElement(App));
    expect(screen.getByText('Cage Coop A')).toBeDefined();
    expect(screen.getByText('Cage Coop B')).toBeDefined();
    expect(screen.getByText('Litter Coop 1')).toBeDefined();
  });

  it('renders the V.E.R.S. footer', () => {
    render(React.createElement(App));
    expect(screen.getByText('V.E.R.S. Node Ingestion In Sync')).toBeDefined();
  });

  it('switches to the telemetry tab on click', () => {
    render(React.createElement(App));
    const telemetryTab = screen.getByText('Environmental Telemetry');
    fireEvent.click(telemetryTab);
    expect(screen.getByText('Environmental Sensor Grid')).toBeDefined();
  });

  it('switches to the financials tab and shows CapEx', () => {
    render(React.createElement(App));
    const financialsTab = screen.getByText('Financial Protection');
    fireEvent.click(financialsTab);
    expect(screen.getByText('Revenue Protection Dashboard')).toBeDefined();
  });

  it('triggers heat stress simulation alert', () => {
    render(React.createElement(App));
    const heatBtn = screen.getByText('Heat Stress');
    fireEvent.click(heatBtn);
    expect(screen.getByText(/CRITICAL WARNING: HEAT STRESS DETECTED/)).toBeDefined();
    // Reset button should appear
    expect(screen.getByText('Reset')).toBeDefined();
  });

  it('triggers ammonia spike simulation alert', () => {
    render(React.createElement(App));
    const nh3Btn = screen.getByText('Ammonia Spike');
    fireEvent.click(nh3Btn);
    expect(screen.getByText(/WARNING: AMMONIA.*LEVEL ELEVATED/)).toBeDefined();
  });

  it('renders the daily revenue protected KPI', () => {
    render(React.createElement(App));
    expect(screen.getByText('Daily Revenue Protected')).toBeDefined();
  });

  it('renders amortization progress widget', () => {
    render(React.createElement(App));
    expect(screen.getByText('Amortization Progress')).toBeDefined();
    expect(screen.getByText(/7.4/)).toBeDefined();
  });
});
