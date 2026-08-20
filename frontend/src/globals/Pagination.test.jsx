import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

describe('Pagination', () => {
  it('renders nothing when there is one page or fewer', () => {
    const { container } = render(
      <Pagination page={1} meta={{ page: 1, limit: 25, total: 3, totalPages: 1 }} onChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an empty result set', () => {
    const { container } = render(
      <Pagination page={1} meta={{ page: 1, limit: 25, total: 0, totalPages: 0 }} onChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the correct range readout for a middle page', () => {
    render(<Pagination page={2} meta={{ page: 2, limit: 25, total: 60, totalPages: 3 }} onChange={vi.fn()} />);
    expect(screen.getByText('Showing 26–50 of 60')).toBeInTheDocument();
  });

  it('clamps the range end on the last, partial page', () => {
    render(<Pagination page={3} meta={{ page: 3, limit: 25, total: 60, totalPages: 3 }} onChange={vi.fn()} />);
    expect(screen.getByText('Showing 51–60 of 60')).toBeInTheDocument();
  });

  it('disables Prev on the first page and Next on the last', () => {
    const { rerender } = render(
      <Pagination page={1} meta={{ page: 1, limit: 25, total: 60, totalPages: 3 }} onChange={vi.fn()} />
    );
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();

    rerender(<Pagination page={3} meta={{ page: 3, limit: 25, total: 60, totalPages: 3 }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('calls onChange with page ± 1', () => {
    const onChange = vi.fn();
    render(<Pagination page={2} meta={{ page: 2, limit: 25, total: 60, totalPages: 3 }} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
