import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../errors/AppError.js';

// FR-4 (PRD.md C.1): adminNotifService now forwards the caller's identity (userId/role) into
// every model call, which is what scopes visibility (target_role) and read/dismiss state
// (notification_receipts) to that one user — see models/adminNotifModel.js. This suite covers
// that forwarding and the 404-on-not-visible guard; the actual SQL scoping is covered by
// tests/adminNotifModel.test.js.

vi.mock('../models/adminNotifModel.js', () => ({
  getAllNotifications: vi.fn(),
  countUnread: vi.fn(),
  markAllAsRead: vi.fn(),
  dismissAllNotifications: vi.fn(),
  dismissNotification: vi.fn(),
  markOneAsRead: vi.fn(),
}));

const notifModel = await import('../models/adminNotifModel.js');
const NotifService = (await import('../services/adminNotifService.js')).default;

const PM = { user_id: 2, user_role: 'Production Manager' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminNotifService.getNotifications', () => {
  it('forwards the caller identity alongside pagination/type', async () => {
    notifModel.getAllNotifications.mockResolvedValue({ rows: [], total: 0 });
    await NotifService.getNotifications(PM, { page: 1, limit: 25, offset: 0, type: 'project' });
    expect(notifModel.getAllNotifications).toHaveBeenCalledWith({
      userId: PM.user_id,
      role: PM.user_role,
      page: 1,
      limit: 25,
      offset: 0,
      type: 'project',
    });
  });
});

describe('adminNotifService.getUnreadCount', () => {
  it('forwards the caller identity', async () => {
    notifModel.countUnread.mockResolvedValue(4);
    const result = await NotifService.getUnreadCount(PM);
    expect(result).toBe(4);
    expect(notifModel.countUnread).toHaveBeenCalledWith({ userId: PM.user_id, role: PM.user_role });
  });
});

describe('adminNotifService.markAllAsRead / clearAllNotifications', () => {
  it('forwards the caller identity and type', async () => {
    notifModel.markAllAsRead.mockResolvedValue([]);
    await NotifService.markAllAsRead(PM, 'verification');
    expect(notifModel.markAllAsRead).toHaveBeenCalledWith({
      userId: PM.user_id,
      role: PM.user_role,
      type: 'verification',
    });

    notifModel.dismissAllNotifications.mockResolvedValue(undefined);
    await NotifService.clearAllNotifications(PM, null);
    expect(notifModel.dismissAllNotifications).toHaveBeenCalledWith({
      userId: PM.user_id,
      role: PM.user_role,
      type: null,
    });
  });
});

describe('adminNotifService.markOneAsRead', () => {
  it('resolves when the model finds and updates a visible row', async () => {
    notifModel.markOneAsRead.mockResolvedValue({ notification_id: 5 });
    await expect(NotifService.markOneAsRead(PM, 5)).resolves.toBeUndefined();
    expect(notifModel.markOneAsRead).toHaveBeenCalledWith(5, { userId: PM.user_id, role: PM.user_role });
  });

  // Empty result means the id doesn't exist or isn't visible to this caller's role — either way,
  // the caller never observes a false "it worked" (CLAUDE.md's rule against returning
  // error-shaped values applies equally to silently succeeding on someone else's notification).
  it('throws AppError(404) when the model finds no visible row', async () => {
    notifModel.markOneAsRead.mockResolvedValue(undefined);
    await expect(NotifService.markOneAsRead(PM, 5)).rejects.toThrow(AppError);
    await expect(NotifService.markOneAsRead(PM, 5)).rejects.toMatchObject({ status: 404 });
  });
});

describe('adminNotifService.deleteNotification', () => {
  it('resolves when the model dismisses a visible row', async () => {
    notifModel.dismissNotification.mockResolvedValue({ notification_id: 5 });
    await expect(NotifService.deleteNotification(PM, 5)).resolves.toBeUndefined();
    expect(notifModel.dismissNotification).toHaveBeenCalledWith(5, { userId: PM.user_id, role: PM.user_role });
  });

  it('throws AppError(404) when the model finds no visible row', async () => {
    notifModel.dismissNotification.mockResolvedValue(undefined);
    await expect(NotifService.deleteNotification(PM, 5)).rejects.toMatchObject({ status: 404 });
  });
});
