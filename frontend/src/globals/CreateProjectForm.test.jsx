import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateProjectForm from './CreateProjectForm';
import { ToastContext } from '../context/ToastContext';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). ProjectFormFields' labels are now
// properly <label htmlFor> associated (item 30) — queried by label text, which is also the test
// that proves the association actually works, not just by `name` attribute.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

function renderForm(showToast = vi.fn()) {
  return {
    showToast,
    ...render(
      <ToastContext.Provider value={showToast}>
        <CreateProjectForm />
      </ToastContext.Provider>
    ),
  };
}

// fireEvent.submit(form) is used instead of clicking the submit button, because jsdom (like a
// real browser) runs native constraint validation on a button-driven submission — the
// `required`/`min` attributes on ProjectFormFields' inputs would silently swallow the click
// before handleSubmit/validateDates ever runs. Dispatching the submit event directly is
// testing-library's documented way around that, and it's what actually exercises the JS-level
// validateDates() rule these tests are about.
const submitForm = (container) => fireEvent.submit(container.querySelector('form'));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateProjectForm', () => {
  it('posts the form data plus projectDetails on submit', async () => {
    api.post.mockResolvedValue({ success: true });
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Cabinet Set' } });
    fireEvent.change(screen.getByLabelText('Client Name'), { target: { value: 'Juan Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-03-01' } });
    submitForm(container);

    expect(api.post).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
      projectName: 'Cabinet Set',
      clientName: 'Juan Dela Cruz',
      dueDate: '2026-03-01',
      projectDetails: [{ name: '', detail: '' }],
    }));
  });

  it('blocks submission and toasts when due date is before date ordered', () => {
    const { showToast, container } = renderForm();

    fireEvent.change(screen.getByLabelText('Date Ordered'), { target: { value: '2026-03-10' } });
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-03-01' } });
    submitForm(container);

    expect(showToast).toHaveBeenCalledWith('Due date cannot be earlier than Date Ordered.', 'error');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('resets the form and toasts success after a successful submit', async () => {
    api.post.mockResolvedValue({ success: true });
    const { showToast, container } = renderForm();

    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Cabinet Set' } });
    submitForm(container);

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Project successfully created!', 'success'));
    expect(screen.getByLabelText('Project Name').value).toBe('');
  });

  it('toasts the server error on failure', async () => {
    api.post.mockRejectedValue(new Error('Server exploded'));
    const { showToast, container } = renderForm();

    submitForm(container);

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Server exploded', 'error'));
  });

  it('adds a variable row, and disables remove at the last row', () => {
    const { container } = renderForm();

    expect(container.querySelectorAll('.dynamic-row')).toHaveLength(1);
    expect(container.querySelector('.btn-remove').disabled).toBe(true);

    fireEvent.click(screen.getByText('+Add Variable'));

    expect(container.querySelectorAll('.dynamic-row')).toHaveLength(2);
    expect(container.querySelector('.btn-remove').disabled).toBe(false);
  });
});
