import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';
import { colors, MIN_TOUCH_TARGET } from '../../theme';

describe('Button', () => {
  it('muestra la etiqueta recibida', () => {
    render(<Button label="Guardar" onPress={jest.fn()} />);

    expect(screen.getByText('Guardar')).toBeOnTheScreen();
  });

  it('invoca onPress al pulsarlo', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no invoca onPress cuando está deshabilitado', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} disabled />);

    fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('expone el estado deshabilitado a accesibilidad', () => {
    render(<Button label="Guardar" onPress={jest.fn()} disabled />);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('respeta el mínimo táctil accesible en el tamaño más pequeño', () => {
    render(<Button label="Guardar" onPress={jest.fn()} size="sm" testID="btn" />);

    expect(screen.getByTestId('btn')).toHaveStyle({ minHeight: MIN_TOUCH_TARGET });
  });

  it('usa el color de acento en la variante primaria', () => {
    render(<Button label="Guardar" onPress={jest.fn()} testID="btn" />);

    expect(screen.getByTestId('btn')).toHaveStyle({
      backgroundColor: colors.light.accent,
    });
  });

  it('la variante outline es transparente y con borde de acento', () => {
    render(
      <Button label="Guardar" onPress={jest.fn()} variant="outline" testID="btn" />
    );

    expect(screen.getByTestId('btn')).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: colors.light.accent,
    });
  });
});
