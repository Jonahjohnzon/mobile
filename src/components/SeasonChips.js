import React from 'react';
import { ScrollView, Pressable, Text } from 'react-native';
import { colors } from '../constants/theme';

// The web version used a dropdown with a click-outside-to-close handler,
// which has no real equivalent on mobile (no document to listen on, and a
// dropdown menu is a worse touch target than a row of chips anyway). This
// is the same "pick a season" job, done the way a phone UI actually does it.
const SeasonChips = ({ seasons = [], selected, onSelect }) => {
  if (!seasons.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 0, gap: 8 }}
      style={{ marginBottom: 14 }}
    >
      {seasons.map((s) => {
        const active = s === selected;
        return (
          <Pressable
            key={s}
            onPress={() => onSelect(s)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: active ? colors.marquee : colors.surface,
              borderWidth: 1,
              borderColor: active ? colors.marquee : colors.line,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 12,
                color: active ? colors.bg : colors.inkMuted,
              }}
            >
              Season {s}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

export default SeasonChips;
