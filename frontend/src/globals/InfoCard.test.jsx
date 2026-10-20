import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InfoCard from './InfoCard';
import { formatCurrency } from '../utils/format';

// ARCHITECTURE_REVIEW.md item 37 — InfoCard was previously untested (named in CLAUDE.md's
// "deliberately untested" list, exercised only indirectly by each dashboard's own tests).

describe('InfoCard', () => {
  it('renders the label and value', () => {
    render(<InfoCard label="ACTIVE PROJECTS" value={5} variant="green" />);
    expect(screen.getByText('ACTIVE PROJECTS')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders the sub line when given one', () => {
    render(<InfoCard label="MONTHLY PROFIT" value="₱0.00" sub="October 2026" variant="blue" />);
    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });

  it('omits the sub line when none is given', () => {
    const { container } = render(<InfoCard label="TOTAL WORKER" value={12} variant="gold" />);
    expect(container.querySelector('.info-card-sub')).toBeNull();
  });

  it('maps each variant to its border class', () => {
    const { container: green } = render(<InfoCard label="L" value={1} variant="green" />);
    expect(green.querySelector('.info-card')).toHaveClass('info-card-green');

    const { container: gold } = render(<InfoCard label="L" value={1} variant="gold" />);
    expect(gold.querySelector('.info-card')).toHaveClass('info-card-gold');

    const { container: blue } = render(<InfoCard label="L" value={1} variant="blue" />);
    expect(blue.querySelector('.info-card')).toHaveClass('info-card-blue');
  });

  it('does not shrink a short count value', () => {
    const { container } = render(<InfoCard label="ACTIVE PROJECTS" value={5} variant="green" />);
    const valueEl = container.querySelector('.info-card-value');
    expect(valueEl).not.toHaveClass('info-card-value--long');
  });

  it('shrinks a long formatted-currency value so it fits the card', () => {
    const value = formatCurrency(1234567.89);
    const { container } = render(<InfoCard label="MONTHLY PROFIT" value={value} variant="blue" />);
    const valueEl = container.querySelector('.info-card-value');
    expect(valueEl).toHaveClass('info-card-value--long');
    expect(valueEl).toHaveTextContent(value);
  });
});
