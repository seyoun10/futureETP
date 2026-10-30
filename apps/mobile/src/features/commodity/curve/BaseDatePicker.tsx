import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { formatFullDate, fromPickerDate, toPickerDate } from './curveModel';

// 기준일 선택(screens.md C-b 기준일 선택 시트). 범위 밖 날짜는 OS 피커가 막고, 휴장일은 서버가 옮긴다(D-090).
export type BaseDateRange = {
  value: string;
  minBaseDate: string;
  maxBaseDate: string;
};

type Callbacks = {
  onConfirm: (date: string) => void;
  onCancel: () => void;
};

type T = ReturnType<typeof useTranslation>['t'];

// Android는 년·월·일 spinner가 든 OS 다이얼로그다. 취소·바깥 누름은 onDismiss로 온다.
export function openAndroidBaseDatePicker(
  t: T,
  range: BaseDateRange,
  { onConfirm, onCancel }: Callbacks,
) {
  DateTimePickerAndroid.open({
    value: toPickerDate(range.value),
    mode: 'date',
    display: 'spinner',
    minimumDate: toPickerDate(range.minBaseDate),
    maximumDate: toPickerDate(range.maxBaseDate),
    // spinner 버튼 글자색은 라이브러리가 액티비티 테마(라이트)에서 읽어 어둡게 칠하므로 직접 준다
    positiveButton: { label: t('common.confirm'), textColor: colors.text },
    negativeButton: { label: t('common.cancel'), textColor: colors.text },
    onValueChange: (_, date) => onConfirm(fromPickerDate(date)),
    onDismiss: onCancel,
  });
}

// iOS는 바텀 시트 안 spinner. 확인을 눌러야 바뀐다.
export function BaseDateSheet({
  range,
  onConfirm,
  onCancel,
}: { range: BaseDateRange } & Callbacks) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(() => toPickerDate(range.value));

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityLabel={t('common.cancel')}
        testID="base-date-backdrop"
      />
      <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
        <Text style={styles.title}>{t('curve.pickTitle')}</Text>
        <DateTimePicker
          value={date}
          mode="date"
          display="spinner"
          themeVariant="dark"
          textColor={colors.text}
          locale={i18n.language}
          minimumDate={toPickerDate(range.minBaseDate)}
          maximumDate={toPickerDate(range.maxBaseDate)}
          onValueChange={(_, next) => setDate(next)}
          testID="base-date-picker"
        />
        <Text style={styles.range}>
          {t('curve.pickRange', {
            min: formatFullDate(range.minBaseDate),
            max: formatFullDate(range.maxBaseDate),
          })}
        </Text>
        <View style={styles.buttons}>
          <SheetButton label={t('common.cancel')} onPress={onCancel} />
          <SheetButton
            label={t('common.confirm')}
            onPress={() => onConfirm(fromPickerDate(date))}
          />
        </View>
      </View>
    </Modal>
  );
}

function SheetButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopLeftRadius: spacing.md,
    borderTopRightRadius: spacing.md,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.title,
  },
  range: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    minWidth: 96,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSize.body,
  },
});
