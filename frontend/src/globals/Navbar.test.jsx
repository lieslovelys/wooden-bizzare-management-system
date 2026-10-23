import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import { UserContext } from '../context/UserContext';
import { NotificationContext } from '../context/NotificationContext';

// Previously untested (ARCHITECTURE_REVIEW.md item 19/23), along with the Logout confirm modal
// it mounts.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const TABS = [
  { name: 'Dashboard', url: 'dashboard', key: 'db', icon: 'fas fa-th-large' },
  { name: 'Notification', url: 'notification', key: 'nt', icon: 'fas fa-bell', showUnreadBadge: true },
];

function renderNavbar({ route = '/admin/dashboard', unreadCount = 0, userRole = 'Admin' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <UserContext.Provider value={{ userRole, firstName: 'Juan', lastName: 'Dela Cruz' }}>
        <NotificationContext.Provider value={{ unreadCount, arrivals: 0, refreshUnread: () => {} }}>
          <Routes>
            <Route path="/admin/*" element={<Navbar tabs={TABS} accountType="Admin" />} />
          </Routes>
        </NotificationContext.Provider>
      </UserContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Navbar', () => {
  it('shows initials (falling back to the role abbreviation) and the name from UserContext', () => {
    renderNavbar();
    // ARCHITECTURE_REVIEW.md item 44 — the avatar now shows initials from the name, not the role
    // abbreviation (the role itself is printed as its own label below).
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
  });

  it('links each tab to /<accountType>/<url>', () => {
    renderNavbar();
    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/admin/dashboard');
    expect(screen.getByText('Notification').closest('a')).toHaveAttribute('href', '/admin/notification');
  });

  it('marks the matching tab active by pathname', () => {
    renderNavbar({ route: '/admin/notification' });
    const dashboardItem = screen.getByText('Dashboard').closest('.nav-item');
    const notifItem = screen.getByText('Notification').closest('.nav-item');
    expect(dashboardItem).not.toHaveClass('active');
    expect(notifItem).toHaveClass('active');
  });

  it('falls back the bare role path to the dashboard tab', () => {
    renderNavbar({ route: '/admin' });
    expect(screen.getByText('Dashboard').closest('.nav-item')).toHaveClass('active');
  });

  it('shows the unread badge only on a showUnreadBadge tab with a count above 0', () => {
    renderNavbar({ unreadCount: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
    // Dashboard has no showUnreadBadge — its icon wrapper carries no badge span.
    const dashboardIconWrap = screen.getByText('Dashboard').closest('.nav-item').querySelector('.nav-icon-wrap');
    expect(dashboardIconWrap.querySelector('.nav-badge')).not.toBeInTheDocument();
  });

  it('caps the badge display at 99+', () => {
    renderNavbar({ unreadCount: 150 });
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('hides the badge entirely at a zero count', () => {
    renderNavbar({ unreadCount: 0 });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('opens the mobile menu and closes it via the close button', () => {
    const { container } = renderNavbar();
    expect(container.querySelector('.wooden-navbar')).not.toHaveClass('mobile-active');

    fireEvent.click(container.querySelector('.mobile-menu-btn'));
    expect(container.querySelector('.wooden-navbar')).toHaveClass('mobile-active');

    // ARCHITECTURE_REVIEW.md item 44 — the close button is now a real 44px button with an icon
    // (found by its accessible name) rather than a bare "&times;" text glyph.
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(container.querySelector('.wooden-navbar')).not.toHaveClass('mobile-active');
  });

  describe('Logout', () => {
    it('opens the confirm modal, and Cancel closes it without logging out', () => {
      renderNavbar();
      fireEvent.click(screen.getByText('Logout'));

      expect(screen.getByText('Confirm Logout')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText('Confirm Logout')).not.toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('"Yes, Logout" posts /api/logout and reloads the page', async () => {
      api.post.mockResolvedValue({ success: true });
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: vi.fn() },
        writable: true,
      });

      renderNavbar();
      fireEvent.click(screen.getByText('Logout'));
      fireEvent.click(screen.getByRole('button', { name: 'Yes, Logout' }));

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/logout'));
      expect(window.location.reload).toHaveBeenCalled();
    });
  });
});
