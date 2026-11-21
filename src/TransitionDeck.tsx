import React, { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

// Shared motion values keep navigation consistent throughout the app.
export const navigationMotion = {
  duration: 260,
  easing: Easing.out(Easing.cubic),
} as const;

type Scene = { key: string; content: ReactNode };
type Transition = { current: Scene; leaving: Scene | null; sign: number; id: number };
type Props = {
  sceneKey: string;
  children: ReactNode;
  direction: (from: string, to: string) => 'forward' | 'back';
};

/** Two scenes slide together; departing screens cannot receive touches or accessibility focus. */
export function TransitionDeck({ sceneKey, children, direction }: Props) {
  const { width } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);
  const [transition, setTransition] = useState<Transition>(() => ({
    current: { key: sceneKey, content: children }, leaving: null, sign: 1, id: 0,
  }));

  // Capture the latest rendered scene before switching keys, so both screens can move together.
  if (transition.current.key !== sceneKey) {
    setTransition({
      current: { key: sceneKey, content: children },
      leaving: transition.current,
      sign: direction(transition.current.key, sceneKey) === 'forward' ? 1 : -1,
      id: transition.id + 1,
    });
  } else if (transition.current.content !== children || (reduceMotion && transition.leaving)) {
    setTransition({ ...transition, current: { key: sceneKey, content: children }, leaving: reduceMotion ? null : transition.leaving });
  }

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useLayoutEffect(() => {
    if (transition.id === 0) return;
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, { ...navigationMotion, toValue: 1, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
      if (finished) setTransition(previous => previous.id === transition.id ? { ...previous, leaving: null } : previous);
    });
    return () => progress.stopAnimation();
  }, [progress, reduceMotion, transition.id]);

  const incoming = progress.interpolate({ inputRange: [0, 1], outputRange: [transition.sign * width, 0] });
  const outgoing = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -transition.sign * width] });
  return <View style={styles.deck}>
    {transition.leaving && !reduceMotion && <Animated.View key={transition.leaving.key} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.scene, { transform: [{ translateX: outgoing }] }]}>{transition.leaving.content}</Animated.View>}
    <Animated.View key={transition.current.key} style={[styles.scene, { transform: [{ translateX: transition.leaving && !reduceMotion ? incoming : 0 }] }]}>{transition.current.content}</Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  deck: { flex: 1, overflow: 'hidden' },
  scene: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
});
