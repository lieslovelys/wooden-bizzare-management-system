import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RoleBasedRedirect from './RoleBasedRedirect';
import ProtectedRoute from './ProtectedRoute';

// Both previously untested (ARCHITECTURE_REVIEW.md item 12/19) — the entire post-login routing
// decision (which shell a role lands on) and the entire "am I allowed here" gate had no coverage.

function renderRedirect(role) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<RoleBasedRedirect role={role} />} />
        <Route path="/admin" element={<div>Admin shell</div>} />
        <Route path="/production-manager" element={<div>PM shell</div>} />
        <Route path="/inventory" element={<div>Inventory shell</div>} />
        <Route path="/quality-check" element={<div>QC shell</div>} />
        <Route path="/worker" element={<div>Worker shell</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoleBasedRedirect', () => {
  it.each([
    ['Admin', 'Admin shell'],
    ['Production Manager', 'PM shell'],
    ['Inventory Staff', 'Inventory shell'],
    ['Quality Checker', 'QC shell'],
    ['Worker', 'Worker shell'],
  ])('sends %s to its own shell', (role, expectedText) => {
    renderRedirect(role);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it('sends an unknown role to /login', () => {
    renderRedirect('Some Made-Up Role');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('sends an undefined role to /login', () => {
    renderRedirect(undefined);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});

describe('ProtectedRoute', () => {
  it('redirects to redirectPath when not allowed', () => {
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route path="/secret" element={<ProtectedRoute isAllowed={false} redirectPath="/login"><div>Secret content</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('renders its children when allowed', () => {
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route path="/secret" element={<ProtectedRoute isAllowed={true}><div>Secret content</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });
});
