import {
  RARE_LEVEL_COUNT,
  RARE_LEVEL_MAX,
  RARE_LEVEL_MIN,
  rareLevelSchema,
  settingsPatchSchema,
} from '@futureetp/shared';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontSize, spacing } from '@/theme/tokens';

type Props = {
  // 조회 중이면 undefined(입력 막음)
  levels: readonly number[] | undefined;
  onSave: (levels: number[]) => void;
};

type Problem = 'invalid' | 'duplicate';

// 기기에 따라 소수점이 쉼표로 들어온다
const parseLevel = (text: string) => {
  const normalized = text.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
};

const findProblem = (values: number[]): Problem | undefined => {
  if (values.some((value) => !rareLevelSchema.safeParse(value).success)) return 'invalid';
  if (new Set(values).size !== values.length) return 'duplicate';
  return undefined;
};

// rare-level 5칸(screens.md B). 칸을 벗어날 때 5개 모두 맞으면 정렬해 저장하고, 아니면 오류를 보여 주고 저장하지 않는다.
export function RareLevelsInput({ levels, onSave }: Props) {
  const { t } = useTranslation();
  // 고치는 중인 값. null이면 서버 값을 보여 준다(저장 뒤 정렬된 값으로 돌아간다).
  const [draft, setDraft] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<Problem>();
  const texts = draft ?? levels?.map(String) ?? Array<string>(RARE_LEVEL_COUNT).fill('');
  const range = { min: RARE_LEVEL_MIN, max: RARE_LEVEL_MAX, count: RARE_LEVEL_COUNT };

  const change = (index: number, text: string) => {
    setDraft(texts.map((value, i) => (i === index ? text : value)));
    setProblem(undefined);
  };

  const commit = () => {
    if (draft === null || levels === undefined) return;
    const values = draft.map(parseLevel);
    const found = findProblem(values);
    if (found) {
      setProblem(found);
      return;
    }
    const sorted = settingsPatchSchema.parse({ rareLevels: values }).rareLevels ?? values;
    setDraft(null);
    if (sorted.some((value, i) => value !== levels[i])) onSave(sorted);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{t('settings.rareLevels')}</Text>
        {texts.map((text, index) => (
          <TextInput
            // 칸 순서가 곧 정체성이다
            key={index}
            value={text}
            onChangeText={(value) => change(index, value)}
            onEndEditing={commit}
            accessibilityLabel={t('settings.rareLevelField', { index: index + 1 })}
            keyboardType="decimal-pad"
            maxLength={4}
            editable={levels !== undefined}
            selectTextOnFocus
            style={styles.input}
          />
        ))}
      </View>
      <Text style={[styles.hint, problem && styles.problem]}>
        {problem === 'invalid'
          ? t('settings.rareLevelInvalid', range)
          : problem === 'duplicate'
            ? t('settings.rareLevelDuplicate', range)
            : t('settings.rareLevelHint', range)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
  },
  input: {
    width: 48,
    minHeight: 36,
    paddingHorizontal: spacing.xs,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  hint: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    textAlign: 'right',
  },
  problem: {
    color: colors.text,
  },
});
