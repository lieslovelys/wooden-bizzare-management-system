import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';

// Login.jsx — previously untested (ARCHITECTURE_REVIEW.md item 12/19).
vi.mock('./api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('./api/client');

beforeEach(() => {
  vi.clearAllMocks();
  // Login.jsx reloads the page on success — jsdom doesn't implement real navigation, so this
  // is stubbed rather than left to throw.
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: vi.fn() },
    writable: true,
  });
});

describe('Login', () => {
  it('logs in with the entered credentials and reloads on success', async () => {
    api.post.mockResolvedValue(null);
    const login = vi.fn().mockResolvedValue();

    render(<Login login={login} />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'jkjuralbal' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/login', {
      username: 'jkjuralbal',
      password: 'hunter2',
    }));
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('shows a single incorrect-credentials message on a rejected login, without calling login()', async () => {
    api.post.mockRejectedValue(new Error('Invalid credentials'));
    const login = vi.fn();

    render(<Login login={login} />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'jkjuralbal' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Username or password is incorrect')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
