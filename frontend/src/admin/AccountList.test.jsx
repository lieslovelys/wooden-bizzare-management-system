import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountList from './AccountList';
import { ToastContext } from '../context/ToastContext';

// Previously untested (ARCHITECTURE_REVIEW.md item 19/23).
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const ACCOUNTS = [
  { user_id: 1, formatted_id: 'A-01', full_name: 'Juan Dela Cruz', user_role: 'Admin', username: 'juan' },
  { user_id: 2, formatted_id: 'A-02', full_name: 'Maria Santos', user_role: 'Worker', username: 'maria' },
];

function renderWithToast(showToast = vi.fn()) {
  return {
    showToast,
    ...render(
      <ToastContext.Provider value={showToast}>
        <AccountList />
      </ToastContext.Provider>
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ success: true, data: ACCOUNTS });
});

describe('AccountList', () => {
  it('renders accounts fetched from the API', async () => {
    renderWithToast();
    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/users');
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
  });

  it('shows the empty state when there are no accounts', async () => {
    api.get.mockResolvedValue({ success: true, data: [] });
    renderWithToast();
    expect(await screen.findByText('No accounts found.')).toBeInTheDocument();
  });

  it('opens the confirm modal naming the account, and Cancel issues no delete', async () => {
    renderWithToast();
    await screen.findByText('Juan Dela Cruz');

    fireEvent.click(screen.getAllByTitle('Delete Account')[0]);
    expect(screen.getByText('Delete Account?')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz', { selector: 'strong' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete Account?')).not.toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('confirming delete calls the API, toasts success, and refetches', async () => {
    api.delete.mockResolvedValue({ success: true });
    const { showToast } = renderWithToast();
    await screen.findByText('Juan Dela Cruz');

    fireEvent.click(screen.getAllByTitle('Delete Account')[0]);
    fireEvent.click(screen.getByText('Yes, Delete'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/users/1'));
    expect(showToast).toHaveBeenCalledWith('Account deleted successfully!', 'success');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('shows the error message when delete is rejected', async () => {
    api.delete.mockRejectedValue(new Error('Cannot delete your own account'));
    const { showToast } = renderWithToast();
    await screen.findByText('Juan Dela Cruz');

    fireEvent.click(screen.getAllByTitle('Delete Account')[0]);
    fireEvent.click(screen.getByText('Yes, Delete'));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Cannot delete your own account', 'error'));
  });
});
