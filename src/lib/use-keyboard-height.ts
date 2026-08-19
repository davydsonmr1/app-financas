import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Altura atual do teclado, em pixels (0 quando fechado).
 *
 * Por quê não usar `KeyboardAvoidingView` aqui: essa tela vive dentro de
 * `<Tabs>` com header customizado — nessa estrutura aninhada (Stack dentro
 * de Tabs, react-native-screens), o redimensionamento nativo do Android
 * (`adjustResize`) não chega de forma confiável até o conteúdo da tela, e
 * o `KeyboardAvoidingView` assume que ele chega. Resultado: testamos
 * `behavior="height"`, `"padding"` e nenhum funcionou de verdade. Isto aqui
 * não depende de resize nativo nenhum — escuta o evento do teclado direto e
 * devolve a altura exata, pra aplicar como padding onde for preciso.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
