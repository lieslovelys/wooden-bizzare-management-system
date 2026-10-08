import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditProjectForm from './EditProjectForm';
import { ToastContext } from '../context/ToastContext';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). Covers PRD B.6's toDateInputValue
// prefill fix and the post-submit setTimeout(onSuccess, 1500) (see ARCHITECTURE_REVIEW.md P2)
// that's cancelled on unmount.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const PROJECT = {
  success: true,
  data: {
    id: 9,
    project_name: 'Bookshelf',
    client_name: 'Maria Santos',
    contact_number: '09171234567',
    date_ordered: '2026-01-05',
    client_payment: '1000',
    priority_level: 'Medium',
    due_date: '2026-02-05',
    variables: [{ variable_name: 'Wood', variable_detail: 'Mahogany' }],
  },
};

// fireEvent.submit(form) is used instead of clicking the submit button — see
// CreateProjectForm.test.jsx's identical comment for why a button-driven submission runs jsdom's
// native constraint validation and silently swallows the click before validateDates() runs.
const submitForm = (container) => fireEvent.submit(container.querySelector('form'));

function renderForm(props = {}, showToast = vi.fn()) {
  return {
    showToast,
    ...render(
      <ToastContext.Provider value={showToast}>
        <EditProjectForm projectId={9} onCancel={vi.fn()} onSuccess={vi.fn()} {...props} />
      </ToastContext.Provider>
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EditProjectForm', () => {
  it('prefills fields from the fetched project, including dates as input values', async () => {
    api.get.mockResolvedValue(PROJECT);
    renderForm();

    await waitFor(() => expect(screen.getByLabelText('Project Name').value).toBe('Bookshelf'));
    expect(screen.getByLabelText('Client Name').value).toBe('Maria Santos');
    expect(screen.getByLabelText('Date Ordered').value).toBe('2026-01-05');
    expect(screen.getByLabelText('Due Date').value).toBe('2026-02-05');
    expect(screen.getByDisplayValue('Wood')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mahogany')).toBeInTheDocument();
  });

  it('falls back to one blank variable row when the project has none', async () => {
    api.get.mockResolvedValue({ success: true, data: { ...PROJECT.data, variables: [] } });
    const { container } = renderForm();

    await waitFor(() => expect(screen.getByLabelText('Project Name').value).toBe('Bookshelf'));
    expect(container.querySelectorAll('.dynamic-row')).toHaveLength(1);
  });

  it('PUTs the form data plus projectDetails on submit', async () => {
    api.get.mockResolvedValue(PROJECT);
    api.put.mockResolvedValue({ success: true });
    const { container } = renderForm();

    await waitFor(() => expect(screen.getByLabelText('Project Name').value).toBe('Bookshelf'));
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Bookshelf V2' } });
    submitForm(container);

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/projects/9', expect.objectContaining({
      projectName: 'Bookshelf V2',
      projectDetails: [{ name: 'Wood', detail: 'Mahogany' }],
    })));
  });

  it('blocks submission and toasts when due date is before date ordered', async () => {
    api.get.mockResolvedValue(PROJECT);
    const { showToast, container } = renderForm();

    await waitFor(() => expect(screen.getByLabelText('Project Name').value).toBe('Bookshelf'));
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-01-01' } });
    submitForm(container);

    expect(showToast).toHaveBeenCalledWith('Due date cannot be earlier than Date Ordered.', 'error');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('toasts success then calls onSuccess after 1500ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.get.mockResolvedValue(PROJECT);
    api.put.mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const showToast = vi.fn();
    const { container } = render(
      <ToastContext.Provider value={showToast}>
        <EditProjectForm projectId={9} onCancel={vi.fn()} onSuccess={onSuccess} />
      </ToastContext.Provider>
    );

    await waitFor(() => expect(screen.getByLabelText('Project Name').value).toBe('Bookshelf'));
    submitForm(container);
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Project successfully updated!', 'success'));

    expect(onSuccess).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('toasts the server error on PUT failure', async () => {
    api.get.mockResolvedValue(PROJECT);
    api.put.mockRejectedValue(new Error('Update failed'));
    const { showToast, container } = renderForm();

    await waitFor(() => expect(screen.getByLabelText('Project Name').value).toBe('Bookshelf'));
    submitForm(container);

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Update failed', 'error'));
  });

  it('calls onCancel when Cancel is clicked', async () => {
    api.get.mockResolvedValue(PROJECT);
    const onCancel = vi.fn();
    renderForm({ onCancel });

    await waitFor(() => expect(screen.getByLabelText('Project Name').value).toBe('Bookshelf'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
