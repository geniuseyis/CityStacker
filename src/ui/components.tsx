import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { tapFeedback } from '@/services/feedback';
import { color, font, radius, space } from './tokens';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'number';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: font.black, fontSize: 44, letterSpacing: -1.2, lineHeight: 48 },
  title: { fontFamily: font.bold, fontSize: 26, letterSpacing: -0.5 },
  heading: { fontFamily: font.semibold, fontSize: 17, letterSpacing: -0.2 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: font.semibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  caption: { fontFamily: font.medium, fontSize: 12 },
  number: { fontFamily: font.bold, fontSize: 22, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
};

export function T({
  v = 'body',
  muted,
  faint,
  style,
  ...rest
}: TextProps & { v?: Variant; muted?: boolean; faint?: boolean }) {
  return (
    <Text
      allowFontScaling={v === 'body' || v === 'caption'}
      maxFontSizeMultiplier={1.3}
      style={[variants[v], { color: faint ? color.textFaint : muted ? color.textMuted : color.text }, style]}
      {...rest}
    />
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// basınca hafif küçülen yay animasyonlu basılabilir
export function Press({
  onPress,
  style,
  children,
  disabled,
  label,
  silent,
  hitSlop,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  disabled?: boolean;
  label?: string;
  silent?: boolean;
  hitSlop?: number;
}) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => (sc.value = withSpring(0.95, { damping: 18, stiffness: 420 }))}
      onPressOut={() => (sc.value = withSpring(1, { damping: 14, stiffness: 320 }))}
      onPress={() => {
        if (!silent) tapFeedback();
        onPress?.();
      }}
      style={[a, style, disabled && { opacity: 0.4 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  right,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  right?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = kind === 'primary';
  const fg = primary ? color.accentInk : color.text;
  return (
    <Press
      label={title}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        primary && styles.btnPrimary,
        kind === 'secondary' && styles.btnSecondary,
        kind === 'ghost' && styles.btnGhost,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={20} color={fg} />}
      <T v="heading" style={{ color: fg, fontFamily: primary ? font.bold : font.semibold }}>
        {title}
      </T>
      {right}
    </Press>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 44,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  size?: number;
}) {
  return (
    <Press
      label={label}
      onPress={onPress}
      hitSlop={6}
      style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Ionicons name={icon} size={size * 0.46} color={color.text} />
    </Press>
  );
}

export function Glass({
  style,
  children,
  strong,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  strong?: boolean;
}) {
  return <View style={[styles.glass, strong && styles.glassStrong, style]}>{children}</View>;
}

// jeton: iç halkalı küçük altın para
export function Coin({ size = 16 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.gold,
        borderWidth: Math.max(1, size * 0.09),
        borderColor: '#E39A2D',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size,
          borderWidth: Math.max(1, size * 0.08),
          borderColor: 'rgba(120,64,0,0.45)',
        }}
      />
    </View>
  );
}

export function Pill({
  icon,
  coin,
  text,
  tint,
  label,
  plus,
}: {
  icon?: IconName;
  plus?: boolean;
  coin?: boolean;
  text: string;
  tint?: string;
  label?: string;
}) {
  return (
    <View style={styles.pill} accessible accessibilityLabel={label ?? text}>
      {coin && <Coin size={16} />}
      {icon && <Ionicons name={icon} size={14} color={tint ?? color.gold} />}
      <T v="caption" style={{ fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>
        {text}
      </T>
      {plus && (
        <View style={styles.pillPlus}>
          <Ionicons name="add" size={12} color={color.accentInk} />
        </View>
      )}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));
  // kapalıyken görünür gri iz, açılınca üstüne vurgu rengi solarak gelir
  const track = useAnimatedStyle(() => ({ opacity: x.value }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => {
        tapFeedback();
        onChange(!value);
      }}
      hitSlop={8}
      style={styles.toggle}
    >
      <View style={[StyleSheet.absoluteFill, styles.toggleOff]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.toggleOn, track]} />
      <Animated.View style={[styles.knob, knob]} />
    </Pressable>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.seg} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) {
                tapFeedback();
                onChange(o.key);
              }
            }}
            style={[styles.segItem, on && styles.segOn]}
          >
            <T
              v="caption"
              style={{ fontFamily: on ? font.bold : font.medium, color: on ? color.accentInk : color.textMuted }}
            >
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 58,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  btnPrimary: {
    backgroundColor: color.accent,
    shadowColor: color.accent,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  btnSecondary: {
    backgroundColor: color.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  btnGhost: { backgroundColor: 'transparent' },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,15,26,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  glass: {
    backgroundColor: 'rgba(16,20,34,0.78)',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  glassStrong: { backgroundColor: 'rgba(14,18,30,0.94)' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11,15,26,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  pillPlus: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: -4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.gold,
  },
  toggle: { width: 48, height: 28, borderRadius: 14, overflow: 'hidden', justifyContent: 'center' },
  toggleOn: { backgroundColor: color.accent, borderRadius: 14 },
  toggleOff: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14 },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  segItem: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segOn: { backgroundColor: color.accent },
});
