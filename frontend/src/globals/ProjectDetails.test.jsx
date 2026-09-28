import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectDetails from './ProjectDetails';

// Previously untested (ARCHITECTURE_REVIEW.md item 25).
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const PROJECT = {
  success: true,
  data: {
    id: 7,
    project_name: 'Dining Table',
    date_ordered: '2026-01-01',
    due_date: '2026-02-01',
    priority_level: 'High',
    variables: [{ variable_name: 'Wood', variable_detail: 'Narra' }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectDetails', () => {
  it('renders the header, info boxes, and variables', async () => {
    api.get.mockResolvedValue(PROJECT);
    render(<ProjectDetails projectId={7} onBack={vi.fn()} />);

    expect(await screen.findByText('WB-07')).toBeInTheDocument();
    expect(screen.getByText('Dining Table')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Wood')).toBeInTheDocument();
    expect(screen.getByText('Narra')).toBeInTheDocument();
  });

  it('shows the empty-variables fallback when there are none', async () => {
    api.get.mockResolvedValue({ success: true, data: { ...PROJECT.data, variables: [] } });
    render(<ProjectDetails projectId={7} onBack={vi.fn()} />);

    expect(await screen.findByText('No variable details found for this project.')).toBeInTheDocument();
  });

  it('shows "Project not found." when the fetch fails', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    render(<ProjectDetails projectId={7} onBack={vi.fn()} />);

    expect(await screen.findByText('Project not found.')).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    api.get.mockResolvedValue(PROJECT);
    const onBack = vi.fn();
    render(<ProjectDetails projectId={7} onBack={onBack} />);

    fireEvent.click(await screen.findByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });
});
