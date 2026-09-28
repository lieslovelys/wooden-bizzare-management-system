import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TempSignup from './TempSignup';
import { ToastContext } from './context/ToastContext';

// Previously untested (ARCHITECTURE_REVIEW.md item 25).
vi.mock('./api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('./api/client');

function renderPage(showToast = vi.fn()) {
  return {
    showToast,
    ...render(
      <ToastContext.Provider value={showToast}>
        <TempSignup />
      </ToastContext.Provider>
    ),
  };
}

const submitForm = (container) => fireEvent.submit(container.querySelector('form'));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TempSignup', () => {
  it('posts the signup body and resets the form on success', async () => {
    api.post.mockResolvedValue({ success: true });
    const { showToast, container } = renderPage();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'juan.delacruz' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } });
    submitForm(container);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/signup', {
      username: 'juan.delacruz',
      password: 'hunter2',
      firstName: 'Juan',
      middleName: '',
      lastName: 'Dela Cruz',
      suffix: 'None',
      userRole: 'Admin',
    }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Account successfully created!', 'success'));
    expect(screen.getByLabelText('First Name').value).toBe('');
    expect(screen.getByLabelText('Username').value).toBe('');
  });

  it('strips digits from the name fields as they are typed', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Ju4an99' } });
    fireEvent.change(screen.getByLabelText('Middle Name'), { target: { value: 'Sant0os1' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Cru2z' } });

    expect(screen.getByLabelText('First Name').value).toBe('Juan');
    expect(screen.getByLabelText('Middle Name').value).toBe('Santos');
    expect(screen.getByLabelText('Last Name').value).toBe('Cruz');
  });

  it('toasts the server error on failure and does not reset the form', async () => {
    api.post.mockRejectedValue(new Error('Username taken'));
    const { showToast, container } = renderPage();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'juan.delacruz' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } });
    submitForm(container);

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Username taken', 'error'));
    expect(screen.getByLabelText('First Name').value).toBe('Juan');
  });

  it('selects a role and sends it in the body', async () => {
    api.post.mockResolvedValue({ success: true });
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'maria.santos' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Worker' } });
    submitForm(container);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/signup', expect.objectContaining({
      userRole: 'Worker',
    })));
  });
});
