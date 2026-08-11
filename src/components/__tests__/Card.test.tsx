import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Card } from '../Card';
import { colors, borderRadius } from '../../theme';

describe('Card', () => {
  it('renderiza su contenido', () => {
    render(
      <Card>
        <Text>contenido</Text>
      </Card>
    );

    expect(screen.getByText('contenido')).toBeOnTheScreen();
  });

  it('por defecto usa el fondo secundario y sin borde', () => {
    render(
      <Card testID="card">
        <Text>contenido</Text>
      </Card>
    );

    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: colors.light.bgSecondary,
      borderWidth: 0,
      borderRadius: borderRadius.lg,
    });
  });

  it('la variante outlined dibuja borde sobre el fondo base', () => {
    render(
      <Card variant="outlined" testID="card">
        <Text>contenido</Text>
      </Card>
    );

    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: colors.light.bg,
      borderWidth: 1,
      borderColor: colors.light.border,
    });
  });

  it('la variante elevated aplica sombra', () => {
    render(
      <Card variant="elevated" testID="card">
        <Text>contenido</Text>
      </Card>
    );

    expect(screen.getByTestId('card')).toHaveStyle({ elevation: 4 });
  });

  it('acepta estilos adicionales del llamador', () => {
    render(
      <Card testID="card" style={{ marginTop: 12 }}>
        <Text>contenido</Text>
      </Card>
    );

    expect(screen.getByTestId('card')).toHaveStyle({ marginTop: 12 });
  });
});
