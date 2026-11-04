import { QUIET_MAX_MIN, QUIET_STEP_MIN } from '@futureetp/shared';
import type { Settings } from '@futureetp/shared';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, size, spacing } from '@/theme/tokens';

type QuietTime = Settings['quietTime'];
type Edge = 'startMin' | 'endMin';

// 켤 때 처음 값(screens.md B-a 예시)
const DEFAULT_QUIET_TIME = { startMin: 23 * 60, endMin: 7 * 60 };
const SLOTS = Array.from(
  { length: QUIET_MAX_MIN / QUIET_STEP_MIN + 1 },
  (_, index) => index * QUIET_STEP_MIN,
);

// 현지 자정 기준 분 → 24시간제 HH:MM
export const formatQuietMinute = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

// 알림 거부 시간(D-007, D-026). 끄면 null로 저장한다. 시작·종료는 30분 단위이고 서로 달라야 하므로
// 시각 선택 시트에서 반대쪽 시각은 고를 수 없게 둔다. 자정을 넘기면 종료 시각에 (다음 날)을 붙인다.
export function QuietTimeSection({
  value,
  onChange,
}: {
  value: QuietTime;
  onChange: (value: QuietTime) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Edge | null>(null);

  return (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{t('alertSettings.quietTime')}</Text>
        <Switch
          accessibilityLabel={t('alertSettings.quietTime')}
          value={value !== null}
          onValueChange={(on) => onChange(on ? DEFAULT_QUIET_TIME : null)}
          trackColor={{ true: colors.surfaceSelected, false: colors.surface }}
          thumbColor={colors.text}
        />
      </View>
      {value && (
        <View style={styles.times}>
          <TimeButton
            label={t('alertSettings.quietStart')}
            time={formatQuietMinute(value.startMin)}
            onPress={() => setEditing('startMin')}
          />
          <Text style={styles.tilde}>~</Text>
          <TimeButton
            label={t('alertSettings.quietEnd')}
            time={
              value.startMin > value.endMin
                ? t('alertSettings.quietNextDay', { time: formatQuietMinute(value.endMin) })
                : formatQuietMinute(value.endMin)
            }
            onPress={() => setEditing('endMin')}
          />
        </View>
      )}
      <Text style={styles.note}>{t('alertSettings.quietNote')}</Text>
      {value && editing && (
        <TimeSlotSheet
          title={t(editing === 'startMin' ? 'alertSettings.quietStart' : 'alertSettings.quietEnd')}
          selected={value[editing]}
          blocked={value[editing === 'startMin' ? 'endMin' : 'startMin']}
          onPick={(minute) => {
            setEditing(null);
            if (minute !== value[editing]) onChange({ ...value, [editing]: minute });
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}

function TimeButton({
  label,
  time,
  onPress,
}: {
  label: string;
  time: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${time}`}
      onPress={onPress}
      style={styles.timeButton}
    >
      <Text style={styles.timeText}>{time}</Text>
    </Pressable>
  );
}

// 30분 단위 48칸 중 하나를 누르면 바로 고르고 닫는다. blocked는 반대쪽 시각(시작≠종료)이다.
function TimeSlotSheet({
  title,
  selected,
  blocked,
  onPick,
  onCancel,
}: {
  title: string;
  selected: number;
  blocked: number;
  onPick: (minute: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityLabel={t('common.cancel')}
      />
      <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView contentContainerStyle={styles.grid}>
          {SLOTS.map((minute) => (
            <Pressable
              key={minute}
              accessibilityRole="radio"
              accessibilityState={{ checked: minute === selected, disabled: minute === blocked }}
              disabled={minute === blocked}
              onPress={() => onPick(minute)}
              style={[
                styles.slot,
                minute === selected && styles.slotSelected,
                minute === blocked && styles.slotBlocked,
              ]}
            >
              <Text style={styles.slotText}>{formatQuietMinute(minute)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: size.touchTarget,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
  },
  times: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  tilde: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
  },
  timeButton: {
    minHeight: size.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
  },
  timeText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontVariant: ['tabular-nums'],
  },
  note: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    maxHeight: '60%',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopLeftRadius: spacing.md,
    borderTopRightRadius: spacing.md,
    backgroundColor: colors.surface,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: fontSize.title,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slot: {
    width: '22%',
    minHeight: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.sm,
    backgroundColor: colors.background,
  },
  slotSelected: {
    backgroundColor: colors.surfaceSelected,
  },
  slotBlocked: {
    opacity: 0.3,
  },
  slotText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontVariant: ['tabular-nums'],
  },
});
