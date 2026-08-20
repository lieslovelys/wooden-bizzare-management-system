import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../errors/AppError.js';

// profitService — previously untested (ARCHITECTURE_REVIEW.md P2 "No tests, anywhere").
// `saveProfit` now threads a `recordedBy` argument through to the model, the FR-7 fix for
// `project_profit.recorded_by` never being written by any code path (PRD.md B.6).

vi.mock('../models/profitModel.js', () => ({
  getProfitByProjectId: vi.fn(),
  upsertProfit: vi.fn(),
  deleteProfitByProjectId: vi.fn(),
}));

const profitModel = await import('../models/profitModel.js');
const ProfitService = (await import('../services/profitService.js')).default;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('profitService.getProfit', () => {
  it('passes the model result straight through', async () => {
    profitModel.getProfitByProjectId.mockResolvedValue({ client_payment: 1000 });
    const result = await ProfitService.getProfit(1);
    expect(result).toEqual({ client_payment: 1000 });
    expect(profitModel.getProfitByProjectId).toHaveBeenCalledWith(1);
  });
});

describe('profitService.saveProfit', () => {
  it('forwards recordedBy to the model', async () => {
    profitModel.upsertProfit.mockResolvedValue({ id: 1 });
    const data = { client_payment: 1000, worker_wages: 200, materials_cost: 100, other_expenses: 0 };
    await ProfitService.saveProfit(1, data, 7);
    expect(profitModel.upsertProfit).toHaveBeenCalledWith(1, data, 7);
  });
});

describe('profitService.deleteProfit', () => {
  it('404s when nothing was deleted', async () => {
    profitModel.deleteProfitByProjectId.mockResolvedValue(false);
    await expect(ProfitService.deleteProfit(999)).rejects.toBeInstanceOf(AppError);
    await expect(ProfitService.deleteProfit(999)).rejects.toMatchObject({ status: 404 });
  });

  it('resolves silently on a real delete', async () => {
    profitModel.deleteProfitByProjectId.mockResolvedValue(true);
    await expect(ProfitService.deleteProfit(1)).resolves.toBeUndefined();
  });
});
