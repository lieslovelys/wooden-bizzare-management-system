import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Previously untested (ARCHITECTURE_REVIEW.md item 19/23) — App.jsx's own comment calls its
// /session-user unwrap "the highest-blast-radius site in the app": get the `.data` unwrap wrong
// and userRole is undefined, locking every role out of every ProtectedRoute. The five role shells
// are heavy (each pulls in its own screens); stubbed here so this file is only exercising App.jsx
// itself, matching how heavy a full render would otherwise be for what's under test.
vi.mock('./Admin', () => ({ default: () => <div>Admin shell</div> }));
vi.mock('./ProductionManager', () => ({ default: () => <div>PM shell</div> }));
vi.mock('./Inventory', () => ({ default: () => <div>Inventory shell</div> }));
vi.mock('./QualityChecker', () => ({ default: () => <div>QC shell</div> }));
vi.mock('./Worker', () => ({ default: () => <div>Worker shell</div> }));
vi.mock('./Login', () => ({ default: () => <div>Login page</div> }));

function mockSessionResponse(status, data) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ success: status < 300, data }),
  });
}

function setUrl(path) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  vi.restoreAllMocks();
  setUrl('/');
});

describe('App session bootstrap', () => {
  it('shows the loading state before the session check resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<App />);
    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
  });

  it('calls /api/session-user with credentials included', async () => {
    const fetchMock = vi.fn(() => mockSessionResponse(401, null));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByText('Login page');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/session-user'),
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('a 200 response lands an Admin on the Admin shell, exercising the .data unwrap', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockSessionResponse(200, {
      user_id: 1, username: 'admin1', first_name: 'Juan', middle_name: '', last_name: 'Dela Cruz',
      suffix: '', user_role: 'Admin',
    })));

    render(<App />);

    expect(await screen.findByText('Admin shell')).toBeInTheDocument();
  });

  it('a 401 response renders Login', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockSessionResponse(401, null)));

    render(<App />);

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('a network failure renders Login instead of hanging on the loader', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));

    render(<App />);

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('redirects an already-logged-in user away from /login to their own shell', async () => {
    setUrl('/login');
    vi.stubGlobal('fetch', vi.fn(() => mockSessionResponse(200, {
      user_id: 2, username: 'worker1', first_name: 'Maria', middle_name: '', last_name: 'Santos',
      suffix: '', user_role: 'Worker',
    })));

    render(<App />);

    expect(await screen.findByText('Worker shell')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it("a Worker hitting /admin/* is redirected away, ending on their own shell", async () => {
    setUrl('/admin/dashboard');
    vi.stubGlobal('fetch', vi.fn(() => mockSessionResponse(200, {
      user_id: 2, username: 'worker1', first_name: 'Maria', middle_name: '', last_name: 'Santos',
      suffix: '', user_role: 'Worker',
    })));

    render(<App />);

    // ProtectedRoute's isAllowed={userRole === 'Admin'} gate first redirects to /login; since
    // userRole is already set, /login's own route redirects an already-logged-in user to /,
    // which RoleBasedRedirect sends on to /worker — never actually rendering Admin or Login.
    expect(await screen.findByText('Worker shell')).toBeInTheDocument();
    expect(screen.queryByText('Admin shell')).not.toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});
