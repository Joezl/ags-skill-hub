import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SkillCard } from '../skill-card';
import type { Skill } from '@/types/skill';

const mockSkill: Skill = {
  id: '1',
  name: 'Test Skill',
  description: 'A test skill for testing purposes',
  category: 'Testing',
  author: 'TestAuthor',
  installUrl: 'https://example.com/test',
  installPrompt: '/skill install test',
  downloads: 1234,
  stars: 567,
  updatedAt: '2024-03-20',
  tags: ['test', 'mock'],
};

describe('SkillCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render skill name', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('Test Skill')).toBeInTheDocument();
  });

  it('should render skill description', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('A test skill for testing purposes')).toBeInTheDocument();
  });

  it('should render author initial', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of TestAuthor
  });

  it('should render category badge', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('Testing')).toBeInTheDocument();
  });

  it('should render formatted download count', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('1.2k')).toBeInTheDocument();
  });

  it('should render tags', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('mock')).toBeInTheDocument();
  });

  it('should copy install prompt when copy button clicked', async () => {
    render(<SkillCard skill={mockSkill} />);
    
    const copyButton = screen.getByText('Copy Install');
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/skill install test');
    });
  });

  it('should have link to install URL', () => {
    render(<SkillCard skill={mockSkill} />);
    
    const link = screen.getByRole('link', { name: /open item/i });
    expect(link).toHaveAttribute('href', 'https://example.com/test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should format large numbers correctly', () => {
    const largeSkill: Skill = {
      ...mockSkill,
      downloads: 1234567,
      stars: 12345,
    };
    
    render(<SkillCard skill={largeSkill} />);
    expect(screen.getByText('123.5w')).toBeInTheDocument();
  });
});
