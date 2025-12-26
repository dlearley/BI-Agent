import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalSearch } from '@/components/global-search';

describe('GlobalSearch', () => {
  it('renders search input', () => {
    render(<GlobalSearch />);
    const input = screen.getByPlaceholderText(/search/i);
    expect(input).toBeInTheDocument();
  });

  it('search input is disabled (skeleton)', () => {
    render(<GlobalSearch />);
    const input = screen.getByPlaceholderText(/search/i);
    expect(input).toBeDisabled();
  });
});
