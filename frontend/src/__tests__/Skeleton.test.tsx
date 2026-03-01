/**
 * Unit tests for Skeleton loading placeholder components.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonGrid,
} from '../components/Skeleton';

describe('Skeleton', () => {
  it('renders a div with animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).toContain('animate-pulse');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="my-custom" />);
    expect((container.firstChild as HTMLElement).className).toContain('my-custom');
  });

  it('applies width and height via style', () => {
    const { container } = render(<Skeleton width="100px" height="50px" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100px');
    expect(el.style.height).toBe('50px');
  });
});

describe('SkeletonText', () => {
  it('renders', () => {
    const { container } = render(<SkeletonText />);
    expect(container.firstChild).toBeTruthy();
  });

  it('applies w-full by default', () => {
    const { container } = render(<SkeletonText />);
    expect((container.firstChild as HTMLElement).className).toContain('w-full');
  });

  it('accepts custom width', () => {
    const { container } = render(<SkeletonText width="w-1/2" />);
    expect((container.firstChild as HTMLElement).className).toContain('w-1/2');
  });
});

describe('SkeletonCard', () => {
  it('renders multiple skeleton children', () => {
    const { container } = render(<SkeletonCard />);
    const children = container.querySelectorAll('.animate-pulse');
    expect(children.length).toBeGreaterThan(1);
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonCard className="test-card" />);
    expect((container.firstChild as HTMLElement).className).toContain('test-card');
  });
});

describe('SkeletonTable', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<SkeletonTable />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders custom rows and cols', () => {
    const { container } = render(<SkeletonTable rows={3} cols={2} />);
    // 1 header row × 2 cols + 3 data rows × 2 cols = 8 skeleton elements
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(8);
  });
});

describe('SkeletonGrid', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<SkeletonGrid />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders custom rows and cols', () => {
    const { container } = render(<SkeletonGrid rows={2} cols={3} />);
    // header: 1 + 3 = 4; data: 2 rows × (1 label + 3 cells) = 8; total = 12
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(12);
  });
});
