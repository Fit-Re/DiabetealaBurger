import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemedTextInput } from '../ThemedTextInput';
import { colors } from '../../theme';

describe('ThemedTextInput', () => {
  it('aplica el color de texto de la paleta', () => {
    render(<ThemedTextInput testID="input" value="hola" onChangeText={jest.fn()} />);

    expect(screen.getByTestId('input')).toHaveStyle({ color: colors.light.text });
  });

  it('usa un placeholder legible por defecto', () => {
    render(<ThemedTextInput testID="input" placeholder="Email" />);

    expect(screen.getByTestId('input').props.placeholderTextColor).toBe(
      colors.light.textMuted
    );
  });

  it('respeta un placeholderTextColor explícito', () => {
    render(
      <ThemedTextInput testID="input" placeholder="Email" placeholderTextColor="#ff0000" />
    );

    expect(screen.getByTestId('input').props.placeholderTextColor).toBe('#ff0000');
  });

  it('deja que el llamador sobrescriba el color', () => {
    render(<ThemedTextInput testID="input" style={{ color: '#00ff00' }} />);

    expect(screen.getByTestId('input')).toHaveStyle({ color: '#00ff00' });
  });

  it('propaga los eventos de cambio', () => {
    const onChangeText = jest.fn();
    render(<ThemedTextInput testID="input" onChangeText={onChangeText} />);

    fireEvent.changeText(screen.getByTestId('input'), 'nuevo valor');

    expect(onChangeText).toHaveBeenCalledWith('nuevo valor');
  });
});
