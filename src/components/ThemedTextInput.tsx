import React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { usePalette } from "../hooks/useThemedStyles";

/**
 * TextInput con color de texto y de placeholder tomados de la paleta.
 *
 * React Native no hereda el color del tema en los inputs: sin esto el texto sale
 * negro y el placeholder gris oscuro, ilegibles sobre el fondo del tema oscuro.
 * Los estilos del llamador van al final para que puedan sobrescribir el color.
 */
export const ThemedTextInput = React.forwardRef<TextInput, TextInputProps>(
  function ThemedTextInput({ style, placeholderTextColor, ...rest }, ref) {
    const c = usePalette();

    return (
      <TextInput
        ref={ref}
        style={[{ color: c.text }, style]}
        placeholderTextColor={placeholderTextColor ?? c.textMuted}
        {...rest}
      />
    );
  }
);
