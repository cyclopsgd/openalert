import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../Card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders card with children', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('applies default styles', () => {
      const { container } = render(<Card>Test</Card>)
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('rounded-xl')
      expect(card.className).toContain('border')
      expect(card.className).toContain('bg-dark-800')
    })

    it('applies custom className', () => {
      const { container } = render(<Card className="custom-class">Test</Card>)
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('custom-class')
    })

    it('forwards ref', () => {
      const ref = { current: null }
      render(<Card ref={ref as any}>Test</Card>)
      expect(ref.current).not.toBeNull()
    })

    it('accepts HTML div props', () => {
      const { container } = render(
        <Card data-testid="card-element">Test</Card>
      )
      expect(container.querySelector('[data-testid="card-element"]')).toBeInTheDocument()
    })
  })

  describe('CardHeader', () => {
    it('renders header with children', () => {
      render(<CardHeader>Header content</CardHeader>)
      expect(screen.getByText('Header content')).toBeInTheDocument()
    })

    it('applies default styles', () => {
      const { container } = render(<CardHeader>Test</CardHeader>)
      const header = container.firstChild as HTMLElement
      expect(header.className).toContain('flex')
      expect(header.className).toContain('flex-col')
      expect(header.className).toContain('p-6')
    })

    it('applies custom className', () => {
      const { container } = render(
        <CardHeader className="custom-header">Test</CardHeader>
      )
      const header = container.firstChild as HTMLElement
      expect(header.className).toContain('custom-header')
    })

    it('forwards ref', () => {
      const ref = { current: null }
      render(<CardHeader ref={ref as any}>Test</CardHeader>)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('CardTitle', () => {
    it('renders title with text', () => {
      render(<CardTitle>Card Title</CardTitle>)
      expect(screen.getByText('Card Title')).toBeInTheDocument()
    })

    it('renders as h3 element', () => {
      render(<CardTitle>Title</CardTitle>)
      const title = screen.getByText('Title')
      expect(title.tagName).toBe('H3')
    })

    it('applies default styles', () => {
      const { container } = render(<CardTitle>Test</CardTitle>)
      const title = container.firstChild as HTMLElement
      expect(title.className).toContain('font-heading')
      expect(title.className).toContain('font-semibold')
      expect(title.className).toContain('text-dark-50')
    })

    it('applies custom className', () => {
      const { container } = render(
        <CardTitle className="custom-title">Test</CardTitle>
      )
      const title = container.firstChild as HTMLElement
      expect(title.className).toContain('custom-title')
    })

    it('forwards ref', () => {
      const ref = { current: null }
      render(<CardTitle ref={ref as any}>Test</CardTitle>)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('CardDescription', () => {
    it('renders description with text', () => {
      render(<CardDescription>Card description</CardDescription>)
      expect(screen.getByText('Card description')).toBeInTheDocument()
    })

    it('renders as p element', () => {
      render(<CardDescription>Description</CardDescription>)
      const description = screen.getByText('Description')
      expect(description.tagName).toBe('P')
    })

    it('applies default styles', () => {
      const { container } = render(<CardDescription>Test</CardDescription>)
      const description = container.firstChild as HTMLElement
      expect(description.className).toContain('text-sm')
      expect(description.className).toContain('text-dark-400')
    })

    it('applies custom className', () => {
      const { container } = render(
        <CardDescription className="custom-desc">Test</CardDescription>
      )
      const description = container.firstChild as HTMLElement
      expect(description.className).toContain('custom-desc')
    })

    it('forwards ref', () => {
      const ref = { current: null }
      render(<CardDescription ref={ref as any}>Test</CardDescription>)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('CardContent', () => {
    it('renders content with children', () => {
      render(<CardContent>Card content</CardContent>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('applies default styles', () => {
      const { container } = render(<CardContent>Test</CardContent>)
      const content = container.firstChild as HTMLElement
      expect(content.className).toContain('p-6')
      expect(content.className).toContain('pt-0')
    })

    it('applies custom className', () => {
      const { container } = render(
        <CardContent className="custom-content">Test</CardContent>
      )
      const content = container.firstChild as HTMLElement
      expect(content.className).toContain('custom-content')
    })

    it('forwards ref', () => {
      const ref = { current: null }
      render(<CardContent ref={ref as any}>Test</CardContent>)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('CardFooter', () => {
    it('renders footer with children', () => {
      render(<CardFooter>Footer content</CardFooter>)
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })

    it('applies default styles', () => {
      const { container } = render(<CardFooter>Test</CardFooter>)
      const footer = container.firstChild as HTMLElement
      expect(footer.className).toContain('flex')
      expect(footer.className).toContain('items-center')
      expect(footer.className).toContain('p-6')
      expect(footer.className).toContain('pt-0')
    })

    it('applies custom className', () => {
      const { container } = render(
        <CardFooter className="custom-footer">Test</CardFooter>
      )
      const footer = container.firstChild as HTMLElement
      expect(footer.className).toContain('custom-footer')
    })

    it('forwards ref', () => {
      const ref = { current: null }
      render(<CardFooter ref={ref as any}>Test</CardFooter>)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('Card Composition', () => {
    it('renders complete card with all components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>This is a test card</CardDescription>
          </CardHeader>
          <CardContent>Main content goes here</CardContent>
          <CardFooter>Footer actions</CardFooter>
        </Card>
      )

      expect(screen.getByText('Test Card')).toBeInTheDocument()
      expect(screen.getByText('This is a test card')).toBeInTheDocument()
      expect(screen.getByText('Main content goes here')).toBeInTheDocument()
      expect(screen.getByText('Footer actions')).toBeInTheDocument()
    })
  })
})
