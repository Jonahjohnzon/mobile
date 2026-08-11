import React from 'react';
import { View, FlatList } from 'react-native';
import SectionHeader from './SectionHeader';
import PosterCard from './PosterCard';

const ContentRow = ({ data, title, eyebrow, type, mode = 'details', showRank = false, onPressItem }) => {
  if (!data?.length) return null;

  return (
    <View className="mb-8">
      <SectionHeader title={title} eyebrow={eyebrow} />
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${item.id ?? item.url ?? i}`}
        style={{ marginLeft: 16, paddingRight: 16 }}
        contentContainerStyle={{  paddingRight: 8 }}
        renderItem={({ item, index }) => (
          <PosterCard
            data={item}
            passType={type}
            mode={mode}
            rank={showRank ? index + 1 : undefined}
            onPress={onPressItem}
          />
        )}
      />
    </View>
  );
};

export default ContentRow;
