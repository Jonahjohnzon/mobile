import React, { useState } from 'react';
import { Text, Pressable } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Clamps text to 3 lines with a "Read more" / "Show less" toggle. The
 * toggle only renders if the text actually overflows 3 lines — measured
 * via onTextLayout rather than assumed, so short overviews don't show a
 * pointless "Read more" that has nothing left to reveal.
 */
const ReadMoreText = ({ children, style, numberOfLines = 3 }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [measured, setMeasured] = useState(false);

  const onTextLayout = (e) => {
    if (measured) return;
    setMeasured(true);
    if (e.nativeEvent.lines.length > numberOfLines) setOverflows(true);
  };

  return (
    <>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : numberOfLines}
        onTextLayout={onTextLayout}
      >
        {children}
      </Text>
      {overflows && (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} style={{ marginTop: 4 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.marquee }}>
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </Pressable>
      )}
    </>
  );
};

export default ReadMoreText;
