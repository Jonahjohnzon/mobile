import React, { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../constants/theme';

const FALLBACK_IMG = require('../../assets/poster-fallback.png');

const EpisodeRow = ({ episode, onPress }) => {
  const [broken, setBroken] = useState(false);
  const imageBase = process.env.EXPO_PUBLIC_SIZEIMAGE;

  return (
    <Pressable
      onPress={() => onPress(episode)}
      style={{ flexDirection: 'row', marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface }}
    >
      <View style={{ width: 128, height: 80 }}>
        <Image
          source={broken || !episode.still_path ? FALLBACK_IMG : { uri: `${imageBase}${episode.still_path}` }}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        <View
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(11,13,16,0.25)',
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(11,13,16,0.7)',
            }}
          >
            <Feather name="play" size={13} color={colors.ink} />
          </View>
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            paddingHorizontal: 6,
            paddingVertical: 2,
            backgroundColor: 'rgba(11,13,16,0.8)',
            borderTopRightRadius: 8,
          }}
        >
          <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, color: colors.marquee }}>
            E{episode.episode_number}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
        <Text numberOfLines={1} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.ink }}>
          {episode.name}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.inkMuted, marginTop: 2 }}
        >
          {episode.overview || 'No synopsis available.'}
        </Text>
      </View>
    </Pressable>
  );
};

// Port of the web app's List.js — same "only show episodes that have
// actually aired" filter, so upcoming episodes with placeholder data
// don't show a broken/empty play button.
const EpisodeList = ({ episodes = [], onPressEpisode }) => {
  const now = new Date();
  const aired = episodes.filter((e) => {
    const airDate = e?.air_date ? new Date(e.air_date) : null;
    return airDate && airDate < now;
  });

  if (!aired.length) {
    return (
      <Text
        style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.inkFaint, paddingHorizontal: 16 }}
      >
        No aired episodes yet for this season.
      </Text>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {aired.map((ep) => (
        <EpisodeRow key={ep.id ?? ep.episode_number} episode={ep} onPress={onPressEpisode} />
      ))}
    </View>
  );
};

export default EpisodeList;
