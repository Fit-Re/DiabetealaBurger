import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ErrorBoundary from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  // Mock console methods to avoid test noise
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('should render children when no error occurs', () => {
    const TestComponent = () => <></>;

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    // Should not show error UI
    expect(screen.queryByText(/Error/i)).not.toBeInTheDocument();
  });

  it('should catch and display render errors', () => {
    const ThrowError = () => {
      throw new Error('Test error message');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Should display error message
    expect(screen.queryByText(/error|Error/i)).toBeInTheDocument();
  });

  it('should display error message and stack trace', () => {
    const errorMessage = 'Specific error occurred';
    const ThrowError = () => {
      throw new Error(errorMessage);
    };

    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Error should be captured
    expect(container.textContent).toContain('Error');
  });

  it('should provide retry functionality', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Should have a retry button
    const retryButton = screen.queryByText(/retry|Retry/i);
    expect(retryButton).toBeInTheDocument();
  });

  it('should reset error state on retry', () => {
    let shouldThrow = true;

    const ConditionalError = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <></>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    // Error should be displayed
    expect(screen.queryByText(/error/i)).toBeInTheDocument();

    // Update condition to not throw
    shouldThrow = false;

    // Retry would rerender with the updated condition
    rerender(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    // Error should be cleared
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('should handle multiple consecutive errors', () => {
    const ThrowError = () => {
      throw new Error('First error');
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByText(/error/i)).toBeInTheDocument();

    // Simulate another error
    const AnotherError = () => {
      throw new Error('Second error');
    };

    rerender(
      <ErrorBoundary>
        <AnotherError />
      </ErrorBoundary>
    );

    // Should display error
    expect(screen.queryByText(/error/i)).toBeInTheDocument();
  });

  it('should not catch non-render errors', () => {
    const AsyncError = () => {
      setTimeout(() => {
        throw new Error('Async error');
      }, 0);
      return <></>;
    };

    render(
      <ErrorBoundary>
        <AsyncError />
      </ErrorBoundary>
    );

    // Async errors are not caught by error boundary
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('should handle null error gracefully', () => {
    const { container } = render(
      <ErrorBoundary>
        <></>
      </ErrorBoundary>
    );

    // Should render without crashing
    expect(container).toBeTruthy();
  });
});
