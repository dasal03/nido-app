import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useT } from '@/providers/Preferences';
import { fonts, radius, spacing, type } from '@/theme';
import { parseInviteCode } from '@/utils/invite';
import { Icon } from './Icon';
import { PressableScale, tap } from './ui';

/** Full-screen camera that scans a partner's Nido QR and returns their code. */
export function QrScanner({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const s = useStyles();
  const { t } = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  const asked = useRef(false);

  // Ask for the camera as soon as the scanner opens (once); if it's blocked, the button opens Settings.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);
  const blocked = !!permission && !permission.granted && !permission.canAskAgain;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        {permission?.granted && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const code = parseInviteCode(data);
              if (!code || handled.current) return;
              handled.current = true;
              tap('success');
              onCode(code);
            }}
          />
        )}
        <SafeAreaView style={s.overlay}>
          <View style={s.header}>
            <PressableScale onPress={onClose} accessibilityLabel={t('common.close')} style={s.close} scaleTo={0.9}>
              <Icon name="close" size={20} color="#FFFFFF" />
            </PressableScale>
          </View>
          <View style={s.center}>
            <Text style={s.title}>{t('invite.scanTitle')}</Text>
            <View style={s.frame} />
            {permission && !permission.granted && (
              <View style={{ alignItems: 'center', gap: spacing.md }}>
                <Text style={s.body}>{t(blocked ? 'invite.scanBlocked' : 'invite.scanDenied')}</Text>
                <PressableScale onPress={() => (blocked ? Linking.openSettings().catch(() => {}) : requestPermission())} style={s.grant}>
                  <Icon name={blocked ? 'settings' : 'camera'} size={18} color="#0A1F5C" />
                  <Text style={s.grantText}>{t(blocked ? 'notifPrompt.openSettings' : 'invite.grant')}</Text>
                </PressableScale>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1, backgroundColor: '#05080F' },
  overlay: { flex: 1 },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  close: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: 20, color: '#FFFFFF', textAlign: 'center' },
  frame: { width: 240, height: 240, borderRadius: radius.lg, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  body: { ...type.body, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  grant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
  },
  grantText: { fontFamily: fonts.bold, fontSize: 15, color: '#0A1F5C' },
}));
