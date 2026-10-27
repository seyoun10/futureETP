import { useRef } from 'react';
import { CameraView } from 'expo-camera';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontSize, spacing } from '@/theme/tokens';

type Props = {
  // 읽은 QR 내용. 받아들였으면 true를 돌려주고, 그 뒤 들어오는 같은 QR은 무시한다.
  onScanned: (data: string) => boolean;
  // 카메라를 열지 못함(iOS 시뮬레이터 등 카메라 없음)
  onUnavailable: () => void;
  onCancel: () => void;
};

// B-b의 QR 읽기 영역(D-044). 권한은 이 컴포넌트를 띄우기 전에 받는다.
export function QrScanner({ onScanned, onUnavailable, onCancel }: Props) {
  const { t } = useTranslation();
  // 카메라는 QR이 보이는 동안 계속 이벤트를 보내므로 한 번만 넘긴다.
  const accepted = useRef(false);

  return (
    <View style={styles.container}>
      <CameraView
        accessibilityLabel={t('accessKey.scannerLabel')}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (accepted.current) return;
          accepted.current = onScanned(data);
        }}
        onMountError={onUnavailable}
        style={styles.camera}
      />
      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.button}>
        <Text style={styles.buttonText}>{t('common.cancel')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  camera: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: spacing.sm,
    overflow: 'hidden',
  },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSize.body,
  },
});
