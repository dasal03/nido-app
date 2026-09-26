import { useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { makeStyles, useT } from '@/providers/Preferences';
import { fonts, radius, spacing, type } from '@/theme';
import type { PickedImage } from '@/utils/photo';
import { Icon } from './Icon';
import { PressableScale, tap } from './ui';

const MAX_ZOOM = 4;

interface View3 {
  zoom: number;
  tx: number;
  ty: number;
}

/**
 * Full-screen editor to position a photo inside a circular frame: drag to move, pinch or use
 * the slider to zoom. Returns the crop square in source-image pixels.
 */
export function AvatarCropper({
  image,
  onCancel,
  onConfirm,
}: {
  image: PickedImage;
  onCancel: () => void;
  onConfirm: (rect: { originX: number; originY: number; size: number }) => Promise<void>;
}) {
  const s = useStyles();
  const { t } = useT();
  const { width: screenWidth } = useWindowDimensions();
  const [size] = useState(() => Math.min(screenWidth - spacing.lg * 2, 360));
  const base = size / Math.min(image.width, image.height);
  const [view, setView] = useState<View3>({ zoom: 1, tx: 0, ty: 0 });
  const [saving, setSaving] = useState(false);

  // Gesture handlers are created once and keep the live view in a closure (mirrored into state for rendering).
  const [gestures] = useState(() => {
    const latest = { current: { zoom: 1, tx: 0, ty: 0 } as View3 };
    const clamp = (zoom: number, tx: number, ty: number): View3 => {
      const z = Math.min(Math.max(zoom, 1), MAX_ZOOM);
      const maxX = (image.width * base * z - size) / 2;
      const maxY = (image.height * base * z - size) / 2;
      return { zoom: z, tx: Math.min(Math.max(tx, -maxX), maxX), ty: Math.min(Math.max(ty, -maxY), maxY) };
    };
    const apply = (zoom: number, tx: number, ty: number) => {
      const next = clamp(zoom, tx, ty);
      latest.current = next;
      setView(next);
    };

    let start = { zoom: 1, tx: 0, ty: 0, dx: 0, dy: 0, dist: 0 };
    const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start = { ...latest.current, dx: 0, dy: 0, dist: 0 };
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        if (touches.length >= 2) {
          const dist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
          if (!start.dist) start = { ...latest.current, dx: g.dx, dy: g.dy, dist };
          else apply((start.zoom * dist) / start.dist, latest.current.tx, latest.current.ty);
          return;
        }
        // Coming back from a pinch: restart the pan from the current position.
        if (start.dist) start = { ...latest.current, dx: g.dx, dy: g.dy, dist: 0 };
        apply(start.zoom, start.tx + g.dx - start.dx, start.ty + g.dy - start.dy);
      },
    });

    let trackWidth = 1;
    const zoomFromX = (x: number) => apply(1 + (Math.min(Math.max(x, 0), trackWidth) / trackWidth) * (MAX_ZOOM - 1), latest.current.tx, latest.current.ty);
    const slider = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => zoomFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => zoomFromX(e.nativeEvent.locationX),
    });

    return {
      pan: pan.panHandlers,
      slider: slider.panHandlers,
      setTrackWidth: (w: number) => {
        trackWidth = Math.max(w, 1);
      },
      step: (delta: number) => apply(latest.current.zoom + delta, latest.current.tx, latest.current.ty),
    };
  });

  const scale = base * view.zoom;
  const w = image.width * scale;
  const h = image.height * scale;
  const r = size / 2;
  const fill = (view.zoom - 1) / (MAX_ZOOM - 1);

  const confirm = async () => {
    setSaving(true);
    tap('success');
    try {
      await onConfirm({ originX: ((w - size) / 2 - view.tx) / scale, originY: ((h - size) / 2 - view.ty) / scale, size: size / scale });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <PressableScale onPress={onCancel} accessibilityLabel={t('common.cancel')} style={s.close} scaleTo={0.9}>
            <Icon name="close" size={20} color="#FFFFFF" />
          </PressableScale>
          <Text style={s.title}>{t('photo.cropTitle')}</Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={s.stage}>
          <View style={[s.viewport, { width: size, height: size }]} {...gestures.pan}>
            <Image
              source={{ uri: image.uri }}
              style={{ position: 'absolute', width: w, height: h, left: (size - w) / 2 + view.tx, top: (size - h) / 2 + view.ty }}
              resizeMode="cover"
            />
            <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path
                d={`M0 0H${size}V${size}H0Z M${r} 0A${r} ${r} 0 1 1 ${r} ${size}A${r} ${r} 0 1 1 ${r} 0Z`}
                fill="rgba(5,8,15,0.62)"
                fillRule="evenodd"
              />
              <Circle cx={r} cy={r} r={r - 1} stroke="rgba(255,255,255,0.9)" strokeWidth={2} fill="none" />
            </Svg>
          </View>
          <Text style={s.hint}>{t('photo.cropHint')}</Text>
        </View>

        <View style={s.controls}>
          <View style={s.zoomRow}>
            <PressableScale onPress={() => gestures.step(-0.5)} haptic={false} scaleTo={0.85} accessibilityLabel="Zoom out" style={s.zoomButton}>
              <Icon name="zoom-out" size={20} color="#FFFFFF" />
            </PressableScale>
            <View style={s.track} onLayout={(e) => gestures.setTrackWidth(e.nativeEvent.layout.width)} {...gestures.slider}>
              <View style={s.trackLine} pointerEvents="none">
                <View style={[s.trackFill, { width: `${fill * 100}%` }]} />
              </View>
              <View style={[s.thumb, { left: `${fill * 100}%` }]} pointerEvents="none" />
            </View>
            <PressableScale onPress={() => gestures.step(0.5)} haptic={false} scaleTo={0.85} accessibilityLabel="Zoom in" style={s.zoomButton}>
              <Icon name="zoom-in" size={20} color="#FFFFFF" />
            </PressableScale>
          </View>
          <PressableScale onPress={confirm} disabled={saving} style={s.confirm}>
            {saving ? <ActivityIndicator color="#0A1433" /> : <Icon name="check" size={18} color="#0A1433" strokeWidth={2.6} />}
            <Text style={s.confirmText}>{t('photo.use')}</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: '#05080F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { ...type.h3, color: '#FFFFFF' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  viewport: { overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#111723' },
  hint: { ...type.small, color: 'rgba(255,255,255,0.6)' },
  controls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  zoomButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 40, justifyContent: 'center' },
  trackLine: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: '#FFFFFF' },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  confirm: {
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  confirmText: { fontFamily: fonts.bold, fontSize: 16, color: '#0A1433' },
}));
