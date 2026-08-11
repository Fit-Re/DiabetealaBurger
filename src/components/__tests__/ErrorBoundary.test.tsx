import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  // componentDidCatch registra en console.error; se silencia para no ensuciar la salida.
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('renderiza los hijos cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <Text>contenido ok</Text>
      </ErrorBoundary>
    );

    expect(screen.getByText('contenido ok')).toBeOnTheScreen();
    expect(screen.queryByText('Algo salió mal')).not.toBeOnTheScreen();
  });

  it('muestra la UI de respaldo cuando un hijo lanza al renderizar', () => {
    const ThrowError = (): React.ReactElement => {
      throw new Error('Test error message');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Algo salió mal')).toBeOnTheScreen();
    expect(
      screen.getByText('La aplicación encontró un error inesperado. Intenta nuevamente.')
    ).toBeOnTheScreen();
  });

  it('muestra el mensaje del error capturado', () => {
    const ThrowError = (): React.ReactElement => {
      throw new Error('Specific error occurred');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error:')).toBeOnTheScreen();
    expect(screen.getByText(/Specific error occurred/)).toBeOnTheScreen();
  });

  it('ofrece un botón de reintento', () => {
    const ThrowError = (): React.ReactElement => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Intentar de Nuevo')).toBeOnTheScreen();
  });

  it('limpia el estado de error al pulsar reintentar', () => {
    let shouldThrow = true;

    const ConditionalError = (): React.ReactElement => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <Text>contenido recuperado</Text>;
    };

    render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Algo salió mal')).toBeOnTheScreen();

    // La causa del error desaparece antes de reintentar.
    shouldThrow = false;
    fireEvent.press(screen.getByText('Intentar de Nuevo'));

    expect(screen.queryByText('Algo salió mal')).not.toBeOnTheScreen();
    expect(screen.getByText('contenido recuperado')).toBeOnTheScreen();
  });

  it('sigue mostrando la UI de respaldo si el error persiste tras reintentar', () => {
    const ThrowError = (): React.ReactElement => {
      throw new Error('Error persistente');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Algo salió mal')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Intentar de Nuevo'));

    expect(screen.getByText('Algo salió mal')).toBeOnTheScreen();
  });

  it('no captura errores lanzados fuera del render', () => {
    jest.useFakeTimers();

    const AsyncError = (): React.ReactElement => {
      setTimeout(() => {
        throw new Error('Async error');
      }, 0);
      return <Text>contenido ok</Text>;
    };

    render(
      <ErrorBoundary>
        <AsyncError />
      </ErrorBoundary>
    );

    // El temporizador no se ejecuta: un error asíncrono no lo captura un error boundary.
    expect(screen.getByText('contenido ok')).toBeOnTheScreen();
    expect(screen.queryByText('Algo salió mal')).not.toBeOnTheScreen();

    jest.useRealTimers();
  });

  it('renderiza sin fallar cuando no hay hijos con contenido', () => {
    render(
      <ErrorBoundary>
        <></>
      </ErrorBoundary>
    );

    expect(screen.queryByText('Algo salió mal')).not.toBeOnTheScreen();
  });
});
