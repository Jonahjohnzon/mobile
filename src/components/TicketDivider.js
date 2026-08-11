import React from 'react';
import { View } from 'react-native';
import { colors } from '../constants/theme';

/**
 * The one signature flourish in this app: a torn-ticket-stub perforation
 * line. A row of small notches punched into the surface, exactly like the
 * dotted tear line on a physical cinema ticket, marking the seam between
 * the hero "now showing" banner and everything below it.
 */
const TicketDivider = () => {
  const notches = Array.from({ length: 22 });
  return (
    <View className="flex-row items-center px-4 -mt-3 mb-2">
      <View
        className="rounded-full"
        style={{ width: 10, height: 20, backgroundColor: colors.bg, marginLeft: -14 }}
      />
      <View className="flex-1 flex-row justify-between">
        {notches.map((_, i) => (
          <View
            key={i}
            style={{
              width: 3,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.inkFaint,
              opacity: 0.7,
            }}
          />
        ))}
      </View>
      <View
        className="rounded-full"
        style={{ width: 10, height: 20, backgroundColor: colors.bg, marginRight: -14 }}
      />
    </View>
  );
};

export default TicketDivider;
