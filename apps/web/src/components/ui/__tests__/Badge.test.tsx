import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Badge,
  SeverityBadge,
  IncidentStatusBadge,
  AlertStatusBadge,
} from '../Badge'

describe('Badge', () => {
  it('renders badge with text', () => {
    render(<Badge>Test Badge</Badge>)
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('applies default variant', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-dark-700')
  })

  it('renders different variants', () => {
    const { rerender, container } = render(<Badge variant="critical">Critical</Badge>)
    let badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-status-critical/10')

    rerender(<Badge variant="high">High</Badge>)
    badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-status-warning/10')

    rerender(<Badge variant="medium">Medium</Badge>)
    badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-accent-secondary/10')

    rerender(<Badge variant="low">Low</Badge>)
    badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-accent-tertiary/10')

    rerender(<Badge variant="info">Info</Badge>)
    badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-accent-primary/10')

    rerender(<Badge variant="success">Success</Badge>)
    badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-status-success/10')
  })

  it('renders pulse indicator when pulse prop is true', () => {
    const { container } = render(<Badge pulse>Pulsing</Badge>)
    const pulseElements = container.querySelectorAll('.animate-ping')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('does not render pulse indicator by default', () => {
    const { container } = render(<Badge>Not Pulsing</Badge>)
    const pulseElements = container.querySelectorAll('.animate-ping')
    expect(pulseElements.length).toBe(0)
  })

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom-class">Custom</Badge>)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Badge ref={ref as any}>With Ref</Badge>)
    expect(ref.current).not.toBeNull()
  })
})

describe('SeverityBadge', () => {
  it('renders critical severity', () => {
    render(<SeverityBadge severity="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders high severity', () => {
    render(<SeverityBadge severity="high" />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('renders medium severity', () => {
    render(<SeverityBadge severity="medium" />)
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('renders low severity', () => {
    render(<SeverityBadge severity="low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders info severity', () => {
    render(<SeverityBadge severity="info" />)
    expect(screen.getByText('Info')).toBeInTheDocument()
  })

  it('pulses for critical severity', () => {
    const { container } = render(<SeverityBadge severity="critical" />)
    const pulseElements = container.querySelectorAll('.animate-ping')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('does not pulse for non-critical severity', () => {
    const { container } = render(<SeverityBadge severity="high" />)
    const pulseElements = container.querySelectorAll('.animate-ping')
    expect(pulseElements.length).toBe(0)
  })
})

describe('IncidentStatusBadge', () => {
  it('renders triggered status', () => {
    render(<IncidentStatusBadge status="triggered" />)
    expect(screen.getByText('Triggered')).toBeInTheDocument()
  })

  it('renders acknowledged status', () => {
    render(<IncidentStatusBadge status="acknowledged" />)
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
  })

  it('renders resolved status', () => {
    render(<IncidentStatusBadge status="resolved" />)
    expect(screen.getByText('Resolved')).toBeInTheDocument()
  })

  it('pulses for triggered status', () => {
    const { container } = render(<IncidentStatusBadge status="triggered" />)
    const pulseElements = container.querySelectorAll('.animate-ping')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('does not pulse for acknowledged status', () => {
    const { container } = render(<IncidentStatusBadge status="acknowledged" />)
    const pulseElements = container.querySelectorAll('.animate-ping')
    expect(pulseElements.length).toBe(0)
  })
})

describe('AlertStatusBadge', () => {
  it('renders firing status', () => {
    render(<AlertStatusBadge status="firing" />)
    expect(screen.getByText('Firing')).toBeInTheDocument()
  })

  it('renders acknowledged status', () => {
    render(<AlertStatusBadge status="acknowledged" />)
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
  })

  it('renders resolved status', () => {
    render(<AlertStatusBadge status="resolved" />)
    expect(screen.getByText('Resolved')).toBeInTheDocument()
  })

  it('renders suppressed status', () => {
    render(<AlertStatusBadge status="suppressed" />)
    expect(screen.getByText('Suppressed')).toBeInTheDocument()
  })

  it('pulses for firing status', () => {
    const { container } = render(<AlertStatusBadge status="firing" />)
    const pulseElements = container.querySelectorAll('.animate-ping')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('does not pulse for resolved status', () => {
    const { container } = render(<AlertStatusBadge status="resolved" />)
    const pulseElements = container.querySelectorAll('.animate-ping')
    expect(pulseElements.length).toBe(0)
  })
})
