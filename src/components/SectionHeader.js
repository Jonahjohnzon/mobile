import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../constants/theme';

const SectionHeader = ({ title, eyebrow }) => (
  <View className="flex-row items-center px-4 mb-3">
    <View
      className="rounded-full mr-2"
      style={{ width: 7, height: 7, backgroundColor: colors.marquee }}
    />
    {eyebrow ? (
      <Text
        className="text-inkFaint mr-2 uppercase"
        style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, letterSpacing: 1 }}
      >
        {eyebrow}
      </Text>
    ) : null}
    <Text
      className="text-ink"
      style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 24, letterSpacing: 0.5 }}
    >
      {title}
    </Text>
  </View>
);

export default SectionHeader;
