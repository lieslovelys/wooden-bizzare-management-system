import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateAccount from './CreateAccount';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). AccountForm and AccountList each have
// their own test file, so they're stubbed here — this file is only about the tab switch.
vi.mock('./AccountForm', () => ({
  default: () => <div>ACCOUNT_FORM_STUB</div>,
}));
vi.mock('./AccountList', () => ({
  default: () => <div>ACCOUNT_LIST_STUB</div>,
}));

describe('CreateAccount', () => {
  it('shows account creation by default and switches to the account list', () => {
    render(<CreateAccount />);

    expect(screen.getByText('ACCOUNT_FORM_STUB')).toBeInTheDocument();
    expect(screen.queryByText('ACCOUNT_LIST_STUB')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Account List'));

    expect(screen.getByText('ACCOUNT_LIST_STUB')).toBeInTheDocument();
    expect(screen.queryByText('ACCOUNT_FORM_STUB')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Account Creation'));

    expect(screen.getByText('ACCOUNT_FORM_STUB')).toBeInTheDocument();
  });
});
