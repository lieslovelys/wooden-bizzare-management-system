import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateProject from './CreateProject';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). CreateProjectForm/ProjectList each have
// their own test file, so they're stubbed here — this file is only about the tab switch.
vi.mock('../globals/CreateProjectForm', () => ({
  default: () => <div>CREATE_PROJECT_FORM_STUB</div>,
}));
vi.mock('../globals/ProjectList', () => ({
  default: () => <div>PROJECT_LIST_STUB</div>,
}));

describe('CreateProject', () => {
  it('shows the create form by default and switches to the project list', () => {
    render(<CreateProject />);

    expect(screen.getByText('CREATE_PROJECT_FORM_STUB')).toBeInTheDocument();
    expect(screen.queryByText('PROJECT_LIST_STUB')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Project List'));

    expect(screen.getByText('PROJECT_LIST_STUB')).toBeInTheDocument();
    expect(screen.queryByText('CREATE_PROJECT_FORM_STUB')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Create Project'));

    expect(screen.getByText('CREATE_PROJECT_FORM_STUB')).toBeInTheDocument();
  });
});
