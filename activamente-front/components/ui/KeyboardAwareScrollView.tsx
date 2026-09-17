// components/ui/KeyboardAwareScrollView.tsx — ScrollView que deja visible el
// campo enfocado cuando aparece el teclado. Con edgeToEdge en Android el
// `adjustResize` ya no achica la ventana, así que el teclado tapaba los campos
// de abajo (p. ej. "Notas" al agendar). Agrega espacio al final igual al alto
// del teclado y desplaza lo justo para que el input quede encima.
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, ScrollViewProps, StyleSheet, TextInput } from "react-native";

const GAP = 24; // aire entre el input y el borde del teclado

export function KeyboardAwareScrollView({ children, contentContainerStyle, onScroll, ...rest }: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
      const keyboardTop = e.endCoordinates.screenY;
      // Esperar un frame a que el padding extra exista antes de desplazar.
      requestAnimationFrame(() => {
        const input = TextInput.State.currentlyFocusedInput();
        if (!input || !ref.current) return;
        input.measureInWindow((_x, y, _w, h) => {
          const overlap = y + h + GAP - keyboardTop;
          if (overlap > 0) ref.current?.scrollTo({ y: offset.current + overlap, animated: true });
        });
      });
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  const base = StyleSheet.flatten(contentContainerStyle) ?? {};
  const basePadding = typeof base.paddingBottom === "number" ? base.paddingBottom : 0;

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...rest}
      onScroll={handleScroll}
      contentContainerStyle={[base, keyboardHeight > 0 && { paddingBottom: basePadding + keyboardHeight }]}
    >
      {children}
    </ScrollView>
  );
}
