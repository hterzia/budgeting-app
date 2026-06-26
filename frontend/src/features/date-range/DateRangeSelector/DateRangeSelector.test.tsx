import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DateRangeSelector } from './DateRangeSelector';
import { presetSelection } from '../dateRange';

describe('DateRangeSelector', () => {
  it('allows selecting a preset', () => {
    const onSelect = vi.fn();
    render(
      <DateRangeSelector
        value={presetSelection('currentMonth')}
        onChange={onSelect}
      />
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    const last30 = screen.getByText('Last 30 Days');
    fireEvent.click(last30);

    expect(onSelect).toHaveBeenCalledWith(presetSelection('30days'));
  });
});
